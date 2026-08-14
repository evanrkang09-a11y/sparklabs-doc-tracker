"use client";

import Link from "next/link";
import type { DealSummary } from "./deal-list";
import { useLang } from "./lang-provider";

/**
 * The one place that answers "what should I do right now?" across every deal.
 *
 * The dashboard below shows how complete each deal is; this surfaces the
 * time-sensitive and blocking items, most urgent first — payment-document
 * deadlines (a hard 30-day bank limit that is otherwise buried inside each
 * deal's execution tab), missing documents, and outstanding diligence.
 *
 * Computed on the client so "today" matches the viewer's clock rather than the
 * server's render time.
 */

type Tone = "red" | "amber" | "blue" | "neutral";

type Item = {
  dealId: string;
  name: string;
  href: string;
  labelKo: string;
  labelEn: string;
  badge: string;
  tone: Tone;
  priority: number;
};

const DAY_MS = 1000 * 60 * 60 * 24;

export default function ActionCenter({ deals }: { deals: DealSummary[] }) {
  const { lang, both } = useLang();
  const ko = lang === "ko";

  const active = deals.filter((d) => !d.archived);
  const now = Date.now();
  const items: Item[] = [];

  for (const deal of active) {
    const [name] = both(deal.companyKo, deal.companyEn);

    // Payment-document deadline (30-day hard bank limit from the payment date).
    if (deal.paymentDate) {
      const base = new Date(deal.paymentDate);
      if (!Number.isNaN(base.getTime())) {
        const hard = base.getTime() + 30 * DAY_MS;
        const daysToHard = Math.ceil((hard - now) / DAY_MS);

        // Only while it's relevant: coming up within a month, or recently overdue.
        if (daysToHard <= 30 && daysToHard >= -14) {
          const overdue = daysToHard < 0;
          const urgent = daysToHard <= 10;
          items.push({
            dealId: deal.id,
            name,
            href: `/execution/${deal.id}`,
            labelKo: overdue ? "서류 회신 기한 초과" : "서류 회신 기한",
            labelEn: overdue ? "Document deadline passed" : "Document return deadline",
            badge: overdue ? `+${Math.abs(daysToHard)}d` : `D-${daysToHard}`,
            tone: overdue ? "red" : urgent ? "amber" : "blue",
            priority: overdue ? 0 : urgent ? 1 : 3,
          });
        }
      }
    }

    // Missing pre-investment documents.
    if ((deal.missingCount ?? 0) > 0) {
      items.push({
        dealId: deal.id,
        name,
        href: `/deal/${deal.id}`,
        labelKo: "제출 서류 미비",
        labelEn: "Documents missing",
        badge: String(deal.missingCount),
        tone: "amber",
        priority: 2,
      });
    }

    // Outstanding diligence, once the documents are all in.
    if (deal.uncheckedCount > 0 && (deal.missingCount ?? 0) === 0) {
      items.push({
        dealId: deal.id,
        name,
        href: `/diligence/${deal.id}`,
        labelKo: "실사 미확인",
        labelEn: "Diligence outstanding",
        badge: String(deal.uncheckedCount),
        tone: "neutral",
        priority: 4,
      });
    }
  }

  items.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

  if (active.length === 0) return null;

  const toneClass: Record<Tone, string> = {
    red: "border-l-red-500 bg-red-50/60 dark:bg-red-950/20",
    amber: "border-l-amber-500 bg-amber-50/60 dark:bg-amber-950/20",
    blue: "border-l-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/20",
    neutral: "border-l-neutral-400 bg-neutral-50/60 dark:bg-neutral-900/40",
  };
  const badgeClass: Record<Tone, string> = {
    red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    blue: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
    neutral: "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  };

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        {ko ? "확인 필요" : "Needs attention"}
      </h2>

      {items.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <span aria-hidden>✓</span>
          {ko ? "지금 처리할 급한 항목이 없습니다." : "Nothing urgent right now."}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 10).map((item, i) => (
            <li key={`${item.dealId}-${item.href}-${i}`}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 rounded-xl border border-neutral-200 border-l-4 bg-white px-4 py-2.5 shadow-sm transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 ${toneClass[item.tone]}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.name}</span>
                  <span className="block text-xs text-neutral-500">
                    {ko ? item.labelKo : item.labelEn}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${badgeClass[item.tone]}`}
                >
                  {item.badge}
                </span>
              </Link>
            </li>
          ))}
          {items.length > 10 && (
            <li className="px-1 text-xs text-neutral-400">
              +{items.length - 10} {ko ? "건 더" : "more"}
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
