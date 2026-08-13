"use client";

import Link from "next/link";
import { matchesBatch, UNASSIGNED_BATCH, type Batch } from "@/lib/deals";
import { type DealStage, type DealSummary, stageOf } from "./deal-list";
import { T } from "@/lib/i18n";
import { useLang } from "./lang-provider";

/**
 * Batch and company navigation down the left.
 *
 * Selecting a batch filters the main list rather than navigating - the point is
 * to move between batches quickly, and a page load per click would defeat that.
 * Company entries do navigate, straight to that company's documents.
 *
 * Collapses to a horizontal strip on narrow screens instead of disappearing, so
 * the batches are still reachable on a laptop or a phone.
 */
export default function CompanySidebar({
  deals,
  batches,
  selectedBatch,
  selectedStage,
  showArchived,
  onSelectBatch,
  onSelectStage,
}: {
  deals: DealSummary[];
  batches: Batch[];
  selectedBatch: string | null;
  selectedStage: DealStage | null;
  /** Kept in step with the list - otherwise the two panes show different sets. */
  showArchived: boolean;
  onSelectBatch: (batchId: string | null) => void;
  onSelectStage: (stage: DealStage | null) => void;
}) {
  const { t, both } = useLang();

  const active = deals.filter((deal) => showArchived || !deal.archived);
  const countIn = (batchId: string | null) =>
    active.filter((deal) => deal.batchId === batchId).length;
  const countAtStage = (stage: DealStage) =>
    active.filter((deal) => stageOf(deal) === stage).length;

  const unassigned = countIn(null);

  return (
    <nav className="lg:sticky lg:top-24 lg:self-start">
      <p className="mb-2 text-xs font-semibold text-neutral-500">{t(T.batchLabel)}</p>

      <ul className="mb-5 flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        <li className="shrink-0 lg:shrink">
          <BatchButton
            label={t(T.allCompanies)}
            count={active.length}
            selected={selectedBatch === null}
            onClick={() => onSelectBatch(null)}
          />
        </li>

        {batches.map((batch) => (
          <li key={batch.id} className="shrink-0 lg:shrink">
            <BatchButton
              label={batch.name}
              count={countIn(batch.id)}
              selected={selectedBatch === batch.id}
              onClick={() => onSelectBatch(batch.id)}
            />
          </li>
        ))}

        {unassigned > 0 && (
          <li className="shrink-0 lg:shrink">
            <BatchButton
              label={t(T.unassigned)}
              count={unassigned}
              selected={selectedBatch === UNASSIGNED_BATCH}
              onClick={() => onSelectBatch(UNASSIGNED_BATCH)}
            />
          </li>
        )}
      </ul>

      <p className="mb-2 text-xs font-semibold text-neutral-500">{t(T.stageLabel)}</p>

      <ul className="mb-5 flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        <li className="shrink-0 lg:shrink">
          <BatchButton
            label={t(T.stageAll)}
            count={active.length}
            selected={selectedStage === null}
            onClick={() => onSelectStage(null)}
          />
        </li>
        {(
          [
            ["collecting", t(T.stageCollecting)],
            ["diligence", t(T.stageDiligence)],
            ["ready", t(T.stageReady)],
          ] as [DealStage, string][]
        ).map(([stage, label]) => (
          <li key={stage} className="shrink-0 lg:shrink">
            <BatchButton
              label={label}
              count={countAtStage(stage)}
              selected={selectedStage === stage}
              onClick={() => onSelectStage(selectedStage === stage ? null : stage)}
            />
          </li>
        ))}
      </ul>

      <p className="mb-2 text-xs font-semibold text-neutral-500">
        {t(T.companiesTracked)}
      </p>

      <ul className="hidden space-y-0.5 lg:block">
        {active
          .filter((deal) => matchesBatch(deal, selectedBatch))
          .map((deal) => {
            const [name] = both(deal.companyKo, deal.companyEn);
            const settled = deal.missingCount === 0 && deal.uncheckedCount === 0;

            return (
              <li key={deal.id}>
                <Link
                  href={`/deal/${deal.id}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      settled ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  <span className="truncate">{name}</span>
                </Link>
              </li>
            );
          })}
      </ul>
    </nav>
  );
}

function BatchButton({
  label,
  count,
  selected,
  onClick,
}: {
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm whitespace-nowrap transition-colors ${
        selected
          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
      }`}
    >
      <span className="truncate">{label}</span>
      <span className={selected ? "text-xs opacity-70" : "text-xs text-neutral-400"}>
        {count}
      </span>
    </button>
  );
}
