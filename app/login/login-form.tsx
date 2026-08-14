"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { T } from "@/lib/i18n";
import { useLang } from "../lang-provider";

export default function LoginForm({
  domain,
  error,
  next,
}: {
  domain: string;
  error?: string;
  next?: string;
}) {
  const { lang, setLang, t } = useLang();
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <div className="mb-8 flex flex-col items-center text-center">
        <span
          aria-hidden
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white shadow-sm"
        >
          S
        </span>
        <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
          {t(T.org)}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t(T.appName)}</h1>
        <p className="mt-1 text-sm text-neutral-500">{t(T.internalOnly)}</p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        {error && (
          <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {t(error === "AccessDenied" ? T.signInRefused : T.signInError)}
          </p>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            signIn("google", { callbackUrl: next || "/" });
          }}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-900 transition-all hover:bg-neutral-50 hover:shadow-sm active:scale-[0.99] disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:hover:bg-neutral-800"
        >
          <GoogleMark />
          {busy ? "…" : t(T.signInWithGoogle)}
        </button>

        <p className="mt-4 text-center text-sm text-neutral-600 dark:text-neutral-400">
          <span className="font-mono">@{domain}</span> {t(T.signInDomainNote)}
        </p>
      </div>

      <p className="mt-6 text-center text-xs text-neutral-400">{t(T.signInNoPassword)}</p>

      <button
        type="button"
        onClick={() => setLang(lang === "ko" ? "en" : "ko")}
        className="mt-8 self-center text-xs text-neutral-400 underline underline-offset-2 hover:text-neutral-600 dark:hover:text-neutral-300"
      >
        {t(T.langToggle)}
      </button>
    </div>
  );
}

/** Google's mark, so the button reads as the real thing rather than a lookalike. */
function GoogleMark() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 18 18">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
