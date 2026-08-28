"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Batch, type Deal } from "@/lib/deals";
import type { Fund } from "@/lib/funds";
import { T } from "@/lib/i18n";
import { describe } from "@/lib/errors";
import { useLang } from "./lang-provider";
import AddCompanyForm from "./add-company-form";
import AddFundForm from "./add-fund-form";
import ActionCenter from "./action-center";
import Dashboard from "./dashboard";

export type DealSummary = Pick<
  Deal,
  "id" | "companyKo" | "companyEn" | "market" | "dealType" | "batchId" | "fundId" | "archived" | "affiliationDate"
> & {
  /** Null when the status couldn't be read - shown as unknown rather than zero. */
  missingCount: number | null;
  totalRequired: number | null;
  uncheckedCount: number;
  totalChecks: number;
  /** 납입일 from the execution record, if set - drives the deadline surfacing. */
  paymentDate: string | null;
  /** When the company was added to SparkLabs — used for the affiliation date filter. */
  createdAt: string;
};

export type DealStage = "collecting" | "diligence" | "ready";

/** Where a deal stands based on docs and diligence completion. */
export function stageOf(deal: Pick<DealSummary, "missingCount" | "uncheckedCount">): DealStage {
  if ((deal.missingCount ?? 1) > 0) return "collecting";
  if (deal.uncheckedCount > 0) return "diligence";
  return "ready";
}

export default function DealList({
  deals,
  batches,
}: {
  deals: DealSummary[];
  batches: Batch[];
}) {
  const { t, both, lang } = useLang();
  const router = useRouter();

  const [adding, setAdding] = useState(false);
  const [addingFund, setAddingFund] = useState(false);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState("");
  const [batchFilter, setBatchFilter] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<"1m" | "3m" | "6m" | "1y" | null>(null);

  useEffect(() => {
    fetch("/api/funds")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setFunds(data); })
      .catch(() => {});
  }, []);

  const archivedCount = deals.filter((deal) => deal.archived).length;

  const q = query.trim().toLowerCase();
  const visible = deals
    .filter((deal) => showArchived || !deal.archived)
    .filter((deal) => !q || `${deal.companyKo} ${deal.companyEn}`.toLowerCase().includes(q))
    .filter((deal) => {
      if (!batchFilter) return true;
      if (batchFilter === "__none__") return !deal.batchId;
      return deal.batchId === batchFilter;
    })
    .filter((deal) => {
      if (!dateFilter) return true;
      const months = dateFilter === "1m" ? 1 : dateFilter === "3m" ? 3 : dateFilter === "6m" ? 6 : 12;
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - months);
      return new Date(deal.createdAt) >= cutoff;
    });

  // Batches in creation order, unassigned last.
  const groups: { batch: Batch | null; deals: DealSummary[] }[] = [
    ...batches.map((batch) => ({
      batch,
      deals: visible.filter((deal) => deal.batchId === batch.id),
    })),
    { batch: null, deals: visible.filter((deal) => !deal.batchId) },
  ].filter((group) => group.deals.length > 0);

  async function act(dealId: string, run: () => Promise<Response>) {
    setBusyId(dealId);
    setError(null);
    try {
      const response = await run();
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `${response.status}`);
      }
      router.refresh();
    } catch (problem) {
      setError(describe(problem));
    } finally {
      setBusyId(null);
    }
  }

  const setArchived = (deal: DealSummary, archived: boolean) =>
    act(deal.id, () =>
      fetch(`/api/companies/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      }),
    );

  const setFund = (deal: DealSummary, fundId: string) =>
    act(deal.id, () =>
      fetch(`/api/companies/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fundId: fundId || null }),
      }),
    );

  const remove = (deal: DealSummary) => {
    const [name] = both(deal.companyKo, deal.companyEn);
    if (!confirm(`${name}\n\n${t(T.confirmDeleteCompany)}`)) return;
    return act(deal.id, () => fetch(`/api/companies/${deal.id}`, { method: "DELETE" }));
  };

  const removeBatch = (batch: Batch) => {
    if (!confirm(`${batch.name}\n\n${t(T.confirmDeleteBatch)}`)) return;
    return act(batch.id, () => fetch(`/api/batches/${batch.id}`, { method: "DELETE" }));
  };

  return (
    <>
      <header className="mb-5">
        <h1 className="text-3xl font-semibold tracking-tight">{t(T.appName)}</h1>
        <p className="mt-1 text-neutral-500">{t(T.appTagline)}</p>
      </header>

      <p className="mb-6 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        {t(T.homeIntro)}
        <span className="mt-2 block text-xs text-neutral-500">{t(T.homeInternalWarning)}</span>
      </p>

      <ActionCenter deals={deals} />

      <Dashboard deals={deals} />

      {batches.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setBatchFilter(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !batchFilter
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "border border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            }`}
          >
            {lang === "ko" ? "전체" : "All"}
          </button>
          {batches.map((batch) => (
            <button
              key={batch.id}
              type="button"
              onClick={() => setBatchFilter(batchFilter === batch.id ? null : batch.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                batchFilter === batch.id
                  ? "bg-indigo-600 text-white"
                  : "border border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              {batch.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setBatchFilter(batchFilter === "__none__" ? null : "__none__")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              batchFilter === "__none__"
                ? "bg-neutral-600 text-white"
                : "border border-neutral-300 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            {lang === "ko" ? "미배정" : "Unassigned"}
          </button>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => { setAdding((open) => !open); setAddingFund(false); }}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-neutral-800 hover:shadow active:scale-[0.98] dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
        >
          {adding ? t(T.cancel) : `+ ${t(T.addCompany)}`}
        </button>
        <button
          type="button"
          onClick={() => { setAddingFund((open) => !open); setAdding(false); }}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          {addingFund ? t(T.cancel) : (lang === "ko" ? "+ 펀드 추가" : "+ Add Fund")}
        </button>

        {archivedCount > 0 && (
          <button
            type="button"
            onClick={() => setShowArchived((show) => !show)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {t(showArchived ? T.hideArchived : T.showArchived)} ({archivedCount})
          </button>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {([null, "1m", "3m", "6m", "1y"] as const).map((opt) => {
            const active = dateFilter === opt;
            const label = opt === null
              ? (lang === "ko" ? "전체 기간" : "All time")
              : opt === "1m" ? (lang === "ko" ? "1개월" : "1 mo")
              : opt === "3m" ? (lang === "ko" ? "3개월" : "3 mo")
              : opt === "6m" ? (lang === "ko" ? "6개월" : "6 mo")
              : (lang === "ko" ? "1년" : "1 yr");
            return (
              <button
                key={String(opt)}
                type="button"
                onClick={() => setDateFilter(opt)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "bg-indigo-600 text-white"
                    : "border border-neutral-300 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={lang === "ko" ? "회사 검색…" : "Search companies…"}
          className="w-full max-w-[14rem] rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm transition-colors focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950"
        />
      </div>

      {adding && (
        <AddCompanyForm
          batches={batches}
          onDone={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      )}

      {addingFund && (
        <AddFundForm
          onDone={(newFund) => {
            setAddingFund(false);
            setFunds((prev) => [...prev, newFund]);
          }}
        />
      )}

      {error && (
        <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {visible.length === 0 && !adding && (
        <p className="rounded-xl border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-500 dark:border-neutral-700">
          {q
            ? lang === "ko"
              ? `"${query}"에 해당하는 회사가 없습니다.`
              : `No companies match "${query}".`
            : t(T.noCompanies)}
        </p>
      )}

      {groups.map(({ batch, deals: groupDeals }) => (
        <section key={batch?.id ?? "unassigned"} className="mb-8">
          {batch !== undefined && (
            <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-neutral-200 pb-1.5 dark:border-neutral-800">
              <h2 className="text-sm font-semibold">
                {batch ? batch.name : t(T.unassigned)}
                {batch?.note && (
                  <span className="ml-2 text-xs font-normal text-neutral-400">
                    {batch.note}
                  </span>
                )}
              </h2>

              {batch && (
                <button
                  type="button"
                  onClick={() => removeBatch(batch)}
                  disabled={busyId === batch.id}
                  className="shrink-0 text-xs text-neutral-400 transition-colors hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
                >
                  {t(T.deleteBatchLabel)}
                </button>
              )}
            </div>
          )}

          {groupDeals.length === 0 ? (
            <p className="py-3 text-xs text-neutral-400">—</p>
          ) : (
            <ul className="space-y-2.5">
              {groupDeals.map((deal) => (
                <DealRow
                  key={deal.id}
                  deal={deal}
                  funds={funds}
                  busy={busyId === deal.id}
                  onArchive={() => setArchived(deal, !deal.archived)}
                  onDelete={() => remove(deal)}
                  onSetFund={(fundId) => setFund(deal, fundId)}
                />
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}

function DealRow({
  deal,
  funds,
  busy,
  onArchive,
  onDelete,
  onSetFund,
}: {
  deal: DealSummary;
  funds: Fund[];
  busy: boolean;
  onArchive: () => void;
  onDelete: () => void;
  onSetFund: (fundId: string) => void;
}) {
  const { t, both, lang } = useLang();
  const [name, otherName] = both(deal.companyKo, deal.companyEn);

  return (
    <li
      className={`rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 ${
        deal.archived ? "opacity-55" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <Link
          href={`/overview/${deal.id}`}
          className="min-w-0 flex-1 transition-opacity hover:opacity-70"
        >
          <p className="flex flex-wrap items-center gap-x-2 font-medium">
            {name}
            {deal.archived && (
              <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-normal text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                {t(T.archived)}
              </span>
            )}
            {deal.affiliationDate ? (
              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-normal text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                {lang === "ko" ? "제휴" : "Since"} {deal.affiliationDate}
              </span>
            ) : (
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-normal text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500">
                {lang === "ko" ? "제휴일 미설정" : "No affiliation date"}
              </span>
            )}
          </p>
          <p className="text-sm text-neutral-500">
            {otherName} &middot;{" "}
            {t(deal.market === "overseas" ? T.overseasCompany : T.domesticCompany)}
          </p>

          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <DocsBadge deal={deal} />
            <DiligenceBadge deal={deal} />
            <DeadlineBadge paymentDate={deal.paymentDate} />
          </div>
        </Link>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <select
            value={deal.fundId ?? ""}
            onChange={(event) => onSetFund(event.target.value)}
            disabled={busy}
            aria-label={lang === "ko" ? "펀드 배정" : "Assign fund"}
            className="max-w-[8.5rem] rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-600 focus:border-neutral-500 focus:outline-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300"
          >
            <option value="">{lang === "ko" ? "펀드 미배정" : "No fund"}</option>
            {funds.map((fund) => (
              <option key={fund.id} value={fund.id}>
                {fund.name}
              </option>
            ))}
          </select>

          <Link
            href={`/diligence/${deal.id}`}
            className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-medium transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:border-neutral-700 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
          >
            {t(T.tabDiligence)}
          </Link>

          <div className="flex gap-2 text-xs text-neutral-400">
            <button
              type="button"
              onClick={onArchive}
              disabled={busy}
              className="transition-colors hover:text-neutral-700 disabled:opacity-50 dark:hover:text-neutral-200"
            >
              {t(deal.archived ? T.unarchive : T.archive)}
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="transition-colors hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
            >
              {t(T.deleteCompany)}
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

function Badge({ tone, children }: { tone: "good" | "warn" | "muted"; children: React.ReactNode }) {
  const styles = {
    good: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    warn: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    muted: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
  }[tone];

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${styles}`}>
      {children}
    </span>
  );
}

function DocsBadge({ deal }: { deal: DealSummary }) {
  const { lang, t } = useLang();

  if (deal.missingCount === null) return <Badge tone="muted">{t(T.statusUnknown)}</Badge>;
  if (deal.missingCount === 0) return <Badge tone="good">{t(T.docsComplete)}</Badge>;

  return (
    <Badge tone="warn">
      {lang === "ko"
        ? `서류 ${deal.missingCount}건 미비`
        : `${deal.missingCount} documents missing`}
    </Badge>
  );
}

function DiligenceBadge({ deal }: { deal: DealSummary }) {
  const { lang, t } = useLang();

  if (deal.uncheckedCount === 0) return <Badge tone="good">{t(T.ddComplete)}</Badge>;

  return (
    <Badge tone="muted">
      {lang === "ko"
        ? `실사 ${deal.uncheckedCount}건 미확인`
        : `${deal.uncheckedCount} checks outstanding`}
    </Badge>
  );
}

function DeadlineBadge({ paymentDate }: { paymentDate: string | null }) {
  if (!paymentDate) return null;
  const daysUntil = Math.ceil(
    (new Date(paymentDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (daysUntil < 0)
    return <Badge tone="warn">⚠ Payment overdue</Badge>;
  if (daysUntil <= 3)
    return <Badge tone="warn">⚠ Payment in {daysUntil}d</Badge>;
  if (daysUntil <= 7)
    return <Badge tone="muted">Payment in {daysUntil}d</Badge>;
  return null;
}
