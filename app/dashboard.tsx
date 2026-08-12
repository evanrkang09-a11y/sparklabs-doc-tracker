"use client";

import type { DealSummary } from "./deal-list";
import { T } from "@/lib/i18n";
import { useLang } from "./lang-provider";

/**
 * Where every company stands, at a glance, above the list.
 *
 * Four counts and a progress bar per company. Deliberately built from the
 * DealSummary the list already receives rather than its own data source, so
 * the two can never disagree about how many documents are missing.
 *
 * Room to grow was the brief: the tiles are a plain grid and the rows a plain
 * list, so adding a stage (contract drafted, funds received) means adding an
 * entry, not restructuring this.
 */
export default function Dashboard({ deals }: { deals: DealSummary[] }) {
  const { lang, t, both } = useLang();

  const active = deals.filter((deal) => !deal.archived);
  if (active.length === 0) return null;

  const docsReady = active.filter((deal) => deal.missingCount === 0).length;
  const ddReady = active.filter((deal) => deal.uncheckedCount === 0).length;
  // Anything the AI or the checklist has flagged as incomplete on both fronts.
  const attention = active.filter(
    (deal) => (deal.missingCount ?? 0) > 0 && deal.uncheckedCount > 0,
  ).length;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold text-neutral-500">{t(T.overview)}</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label={t(T.companiesTracked)} value={active.length} />
        <Tile label={t(T.docsReady)} value={`${docsReady}/${active.length}`} tone="good" />
        <Tile label={t(T.ddReady)} value={`${ddReady}/${active.length}`} tone="good" />
        <Tile label={t(T.needsAttention)} value={attention} tone={attention > 0 ? "warn" : "muted"} />
      </div>

      <ul className="mt-4 space-y-2">
        {active.map((deal) => {
          const [name] = both(deal.companyKo, deal.companyEn);

          const docsDone =
            deal.totalRequired && deal.missingCount !== null
              ? deal.totalRequired - deal.missingCount
              : 0;
          const docsPct = deal.totalRequired
            ? Math.round((docsDone / deal.totalRequired) * 100)
            : 0;

          const ddDone = deal.totalChecks - deal.uncheckedCount;
          const ddPct = deal.totalChecks
            ? Math.round((ddDone / deal.totalChecks) * 100)
            : 0;

          return (
            <li
              key={deal.id}
              className="grid grid-cols-1 items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 sm:grid-cols-[10rem_1fr_1fr] sm:gap-4 dark:border-neutral-800"
            >
              <span className="truncate text-sm font-medium">{name}</span>
              <Meter label={t(T.progressDocs)} done={docsDone} total={deal.totalRequired ?? 0} percent={docsPct} lang={lang} />
              <Meter label={t(T.progressDd)} done={ddDone} total={deal.totalChecks} percent={ddPct} lang={lang} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Tile({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string | number;
  tone?: "good" | "warn" | "muted";
}) {
  const accent = {
    good: "text-emerald-700 dark:text-emerald-400",
    warn: "text-amber-700 dark:text-amber-500",
    muted: "text-neutral-900 dark:text-neutral-100",
  }[tone];

  return (
    <div className="rounded-lg border border-neutral-200 px-3 py-2.5 dark:border-neutral-800">
      <p className="truncate text-xs text-neutral-500">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

function Meter({
  label,
  done,
  total,
  percent,
  lang,
}: {
  label: string;
  done: number;
  total: number;
  percent: number;
  lang: string;
}) {
  const complete = total > 0 && done >= total;

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-[11px] text-neutral-500">
        <span>{label}</span>
        <span className={complete ? "text-emerald-700 dark:text-emerald-400" : ""}>
          {lang === "ko" ? `${done}/${total}건` : `${done}/${total}`}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full transition-all ${
            complete ? "bg-emerald-600" : "bg-neutral-900 dark:bg-white"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
