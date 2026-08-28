"use client";

/**
 * Holds the Korean/English choice for the whole app.
 *
 * Kept on the client and mirrored into localStorage so the choice survives a
 * refresh. Korean is the default because that's who the tool is for; English
 * is there so someone who can't read Korean can still use it.
 *
 * The server always renders Korean, and a saved English choice is applied after
 * mount. That keeps the first paint identical to the server (no hydration
 * warning) at the cost of a brief flash of Korean on load. Moving the choice
 * into a cookie would let the server render the right language outright and
 * remove the flash - worth doing if this ever gets more than a handful of
 * users.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Lang, Phrase } from "@/lib/i18n";
import { both as pickBoth, pick as pickOne } from "@/lib/i18n";

const STORAGE_KEY = "sparklabs-lang";

type LangContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Shorthand so components can write t(T.home) instead of tr(T.home, lang). */
  t: (phrase: Phrase) => string;
  /** For content that carries its languages as separate Ko/En fields. */
  pick: (ko: string, en: string) => string;
  /** [chosen language, the other one] - for the primary/secondary pairs. */
  both: (ko: string, en: string) => [string, string];
};

const LangContext = createContext<LangContextValue | null>(null);

/** Single place that knows the choice has to reach the DOM as well as React. */
function applyToDocument(lang: Lang) {
  document.documentElement.lang = lang;
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved !== "ko" && saved !== "en") return;

    setLangState(saved);
    // Also on restore, not just on click - otherwise a returning English
    // reader gets English text under <html lang="ko">, which is what screen
    // readers and translation prompts actually go by.
    applyToDocument(saved);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyToDocument(next);
  }, []);

  // Memoised together: the callbacks are only worth stabilising if the object
  // holding them is stable too, otherwise every consumer re-renders regardless.
  const value = useMemo<LangContextValue>(
    () => ({
      lang,
      setLang,
      t: (phrase) => phrase[lang],
      pick: (ko, en) => pickOne(lang, ko, en),
      both: (ko, en) => pickBoth(lang, ko, en),
    }),
    [lang, setLang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const value = useContext(LangContext);
  if (!value) throw new Error("useLang must be used inside <LangProvider>");
  return value;
}
