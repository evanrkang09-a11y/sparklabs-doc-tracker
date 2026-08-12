"use client";

/**
 * The bar across the top of every page: home, tabs, account, language.
 *
 * Both tabs show everywhere. That's safe because every user is SparkLabs staff
 * - companies email their documents in and an employee uploads them, so no
 * outsider ever loads these pages.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { T } from "@/lib/i18n";
import { useLang } from "./lang-provider";

export default function SiteHeader({
  dealId,
  companyKo,
  companyEn,
  userEmail,
}: {
  dealId?: string;
  companyKo?: string;
  companyEn?: string;
  userEmail?: string | null;
}) {
  const { lang, setLang, t } = useLang();
  const pathname = usePathname();

  const onDiligence = pathname?.startsWith("/diligence") ?? false;
  const company = lang === "ko" ? companyKo : companyEn;

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/85 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/85">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="min-w-0 transition-opacity hover:opacity-70">
          <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
            {t(T.org)}
          </p>
          <p className="truncate text-sm font-semibold">
            {company ?? t(T.appName)}
          </p>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          {userEmail && (
            <span
              title={userEmail}
              className="hidden max-w-[14rem] truncate text-xs text-neutral-500 sm:block"
            >
              {userEmail}
            </span>
          )}

          <Link
            href="/"
            className="rounded-lg px-2.5 py-1.5 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            {t(T.home)}
          </Link>

          <button
            type="button"
            onClick={() => setLang(lang === "ko" ? "en" : "ko")}
            aria-label="Switch language"
            className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {t(T.langToggle)}
          </button>

          {userEmail && (
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-lg px-2.5 py-1.5 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              {t(T.signOut)}
            </button>
          )}
        </div>
      </div>

      {dealId && (
        <nav className="mx-auto flex max-w-3xl gap-1 px-6">
          <Tab href={`/deal/${dealId}`} active={!onDiligence}>
            {t(T.tabDocuments)}
          </Tab>
          <Tab href={`/diligence/${dealId}`} active={onDiligence}>
            {t(T.tabDiligence)}
          </Tab>
        </nav>
      )}
    </header>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-neutral-900 text-neutral-900 dark:border-white dark:text-white"
          : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
      }`}
    >
      {children}
    </Link>
  );
}
