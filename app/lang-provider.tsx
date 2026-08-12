"use client";

/**
 * Holds the Korean/English choice for the whole app.
 *
 * Kept on the client and mirrored into localStorage so the choice survives a
 * refresh. Korean is the default because that's who the tool is for; English
 * is there so someone who can't read Korean can still use it.
 *
 * The server always renders Korean. To avoid the flash of Korean-then-English
 * that would cause, the saved choice is read in an effect and applied after
 * mount - so the first paint matches the server and nothing hydration-warns.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Lang, Phrase } from "@/lib/i18n";
import { tr } from "@/lib/i18n";

const STORAGE_KEY = "sparklabs-lang";

type LangContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Shorthand so components can write t(T.home) instead of tr(T.home, lang). */
  t: (phrase: Phrase) => string;
};

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ko");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "ko" || saved === "en") setLangState(saved);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    // Keeps screen readers and browser translation prompts honest.
    document.documentElement.lang = next;
  }, []);

  const t = useCallback((phrase: Phrase) => tr(phrase, lang), [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>
  );
}

export function useLang(): LangContextValue {
  const value = useContext(LangContext);
  if (!value) throw new Error("useLang must be used inside <LangProvider>");
  return value;
}
