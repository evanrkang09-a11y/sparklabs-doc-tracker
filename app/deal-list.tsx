"use client";

import Link from "next/link";
import type { Deal } from "@/lib/deals";
import { T } from "@/lib/i18n";
import { useLang } from "./lang-provider";

export type DealSummary = Pick<Deal, "id" | "companyKo" | "companyEn" | "market"> & {
  requiredCount: number;
};

export default function DealList({ deals }: { deals: DealSummary[] }) {
  const { lang, t } = useLang();

  return (
    <>
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{t(T.appName)}</h1>
        <p className="mt-1 text-neutral-500">{t(T.appTagline)}</p>
      </header>

      <p className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
        {t(T.homeIntro)}
        <span className="mt-2 block text-neutral-500">{t(T.homeInternalWarning)}</span>
      </p>

      <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {deals.map((deal) => (
          <li key={deal.id} className="flex items-center justify-between gap-4 py-4">
            <Link
              href={`/deal/${deal.id}`}
              className="min-w-0 transition-opacity hover:opacity-70"
            >
              <p className="font-medium">
                {lang === "ko" ? deal.companyKo : deal.companyEn}
              </p>
              <p className="text-sm text-neutral-500">
                {lang === "ko" ? deal.companyEn : deal.companyKo} &middot;{" "}
                {t(deal.market === "overseas" ? T.overseasCompany : T.domesticCompany)}{" "}
                &middot; {t(T.requiredCount)} {deal.requiredCount}
                {t(T.items)}
              </p>
            </Link>

            <Link
              href={`/diligence/${deal.id}`}
              className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              {t(T.tabDiligence)}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
