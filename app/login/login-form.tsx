"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useLang } from "../lang-provider";

type Mode = "choose" | "employee" | "startup";

export default function LoginForm({
  domain,
  error,
  next,
}: {
  domain: string;
  error?: string;
  next?: string;
}) {
  const { lang, setLang } = useLang();
  const ko = lang === "ko";
  const [mode, setMode] = useState<Mode>("choose");
  const [busy, setBusy] = useState(false);

  function startSignIn(callbackUrl: string) {
    setBusy(true);
    signIn("google", { callbackUrl });
  }

  // ── Choice screen ─────────────────────────────────────────────────────────
  if (mode === "choose") {
    return (
      <div className="flex min-h-screen flex-col">
        {/* Top strip */}
        <div className="flex items-center justify-between px-6 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">S</span>
          <button
            type="button"
            onClick={() => setLang(lang === "ko" ? "en" : "ko")}
            className="text-xs text-neutral-400 underline underline-offset-2 hover:text-neutral-600"
          >
            {ko ? "English" : "한국어"}
          </button>
        </div>

        {/* Two-card layout */}
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12 sm:flex-row sm:items-stretch sm:gap-8">
          {/* SparkLabs employee */}
          <button
            type="button"
            onClick={() => setMode("employee")}
            className="group flex w-full max-w-xs flex-col items-center justify-center gap-4 rounded-2xl border-2 border-indigo-200 bg-white p-8 text-left shadow-sm transition-all hover:border-indigo-400 hover:shadow-md active:scale-[0.99] dark:border-indigo-900 dark:bg-neutral-900 dark:hover:border-indigo-600"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-600 text-2xl font-bold text-white shadow">
              S
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-neutral-900 dark:text-white">
                {ko ? "SparkLabs 임직원" : "SparkLabs Employee"}
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                @{domain}
              </p>
            </div>
          </button>

          {/* Portfolio company */}
          <button
            type="button"
            onClick={() => setMode("startup")}
            className="group flex w-full max-w-xs flex-col items-center justify-center gap-4 rounded-2xl border-2 border-emerald-200 bg-white p-8 text-left shadow-sm transition-all hover:border-emerald-400 hover:shadow-md active:scale-[0.99] dark:border-emerald-900 dark:bg-neutral-900 dark:hover:border-emerald-600"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-600 text-2xl font-bold text-white shadow">
              &#9651;
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-neutral-900 dark:text-white">
                {ko ? "포트폴리오 기업" : "Portfolio Company"}
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                {ko ? "SparkLabs 투자 기업" : "SparkLabs investee"}
              </p>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // ── Sign-in screen (employee or startup) ─────────────────────────────────
  const isEmployee = mode === "employee";
  const accent = isEmployee ? "indigo" : "emerald";

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <button
        type="button"
        onClick={() => setMode("choose")}
        className="mb-6 self-start text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
      >
        ← {ko ? "뒤로" : "Back"}
      </button>

      <div className="mb-8 flex flex-col items-center text-center">
        <div
          className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white shadow-sm ${
            isEmployee ? "bg-indigo-600" : "bg-emerald-600"
          }`}
        >
          {isEmployee ? "S" : "▲"}
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {isEmployee
            ? ko ? "임직원 로그인" : "Employee Sign-in"
            : ko ? "기업 로그인" : "Company Sign-in"}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {isEmployee
            ? ko ? "SparkLabs Google 계정으로 로그인하세요" : `Sign in with your @${domain} account`
            : ko ? "SparkLabs에서 안내받은 Google 계정으로 로그인하세요" : "Sign in with the Google account registered by SparkLabs"}
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        {error && (
          <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error === "AccessDenied"
              ? ko ? "이 계정은 접근 권한이 없습니다." : "This account is not authorised."
              : ko ? "로그인 중 오류가 발생했습니다." : "Something went wrong during sign-in."}
          </p>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => startSignIn(next || "/")}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-900 transition-all hover:bg-neutral-50 hover:shadow-sm active:scale-[0.99] disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:hover:bg-neutral-800"
        >
          <GoogleMark />
          {busy ? "…" : ko ? "Google로 로그인" : "Sign in with Google"}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setLang(lang === "ko" ? "en" : "ko")}
        className="mt-8 self-center text-xs text-neutral-400 underline underline-offset-2 hover:text-neutral-600 dark:hover:text-neutral-300"
      >
        {ko ? "English" : "한국어"}
      </button>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}
