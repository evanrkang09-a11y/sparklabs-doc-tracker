"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Deal } from "@/lib/deals";
import type { CheckState } from "@/lib/diligence-store";
import type { Comment } from "@/lib/comments-store";
import type { AnalysisRecord } from "@/lib/analysis-store";
import { MIN_DOCS_FOR_SUGGESTIONS } from "@/lib/analysis";
import CheckComments from "./check-comments";
import CheckAnalysisPanel from "./check-analysis";
import { T } from "@/lib/i18n";
import { describe } from "@/lib/errors";
import { useLang } from "@/app/lang-provider";
import PhaseDateEditor from "@/app/phase-date-editor";

type RelatedDocument = {
  id: string;
  nameKo: string;
  nameEn: string;
  submitted: boolean;
  optional: boolean;
};

type Item = {
  id: string;
  titleKo: string;
  titleEn: string;
  sourceRef: string;
  detailsKo: string[];
  detailsEn: string[];
  tipsKo?: string[];
  tipsEn?: string[];
  relatedDocuments: RelatedDocument[];
};

type Section = {
  id: string;
  titleKo: string;
  titleEn: string;
  blurbKo: string;
  blurbEn: string;
  items: Item[];
};

type FilterKey = "all" | "flagged" | "blocked" | "todo" | "done";

const NOTE_SAVE_DELAY_MS = 800;
const EMPTY: CheckState = { checked: false, note: "", updatedAt: "", verifiedAt: "" };

export default function DiligenceChecklist({
  deal,
  sections,
  initialChecks,
  initialComments,
  initialAnalysis,
  uploadedCount,
  newestUploadAt,
  viewerEmail,
  missingCount,
  totalRequired,
}: {
  deal: Deal;
  sections: Section[];
  initialChecks: Record<string, CheckState>;
  initialComments: Record<string, Comment[]>;
  initialAnalysis: AnalysisRecord;
  uploadedCount: number;
  newestUploadAt: string | null;
  viewerEmail: string | null;
  missingCount: number;
  totalRequired: number;
}) {
  const { lang, t, pick, both } = useLang();
  const ko = lang === "ko";
  const [companyName] = both(deal.companyKo, deal.companyEn);

  const [checks, setChecks] = useState(initialChecks);
  const [saving, setSaving] = useState(0);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [analysing, setAnalysing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysingItem, setAnalysingItem] = useState<string | null>(null);

  // UI state
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterKey>("all");

  const noteTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timers = noteTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  // ── Persistence ──────────────────────────────────────────────────────────

  async function save(checkId: string, patch: { checked?: boolean; note?: string; verifiedAt?: string }) {
    setSaving((n) => n + 1);
    setSaveError(null);
    try {
      const res = await fetch(`/api/deals/${deal.id}/diligence`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkId, ...patch }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `${res.status}`);
      }
      setSavedAt(new Date().toLocaleTimeString());
    } catch (problem) {
      setSaveError(describe(problem));
    } finally {
      setSaving((n) => n - 1);
    }
  }

  function toggle(item: Item, checked: boolean) {
    setChecks((curr) => ({ ...curr, [item.id]: { ...(curr[item.id] ?? EMPTY), checked } }));
    save(item.id, { checked });
  }

  function editNote(item: Item, note: string) {
    setChecks((curr) => ({ ...curr, [item.id]: { ...(curr[item.id] ?? EMPTY), note } }));
    const pending = noteTimers.current.get(item.id);
    if (pending) clearTimeout(pending);
    noteTimers.current.set(item.id, setTimeout(() => {
      noteTimers.current.delete(item.id);
      save(item.id, { note });
    }, NOTE_SAVE_DELAY_MS));
  }

  function editVerifiedAt(item: Item, verifiedAt: string) {
    setChecks((curr) => ({ ...curr, [item.id]: { ...(curr[item.id] ?? EMPTY), verifiedAt } }));
    const key = `${item.id}:date`;
    const pending = noteTimers.current.get(key);
    if (pending) clearTimeout(pending);
    noteTimers.current.set(key, setTimeout(() => {
      noteTimers.current.delete(key);
      save(item.id, { verifiedAt });
    }, NOTE_SAVE_DELAY_MS));
  }

  // ── AI analysis ───────────────────────────────────────────────────────────

  async function runAnalysis(mode?: "extra") {
    setAnalysing(true);
    setAnalysisError(null);
    setAnalysisProgress(null);
    try {
      let pending: string[] | null = null;
      do {
        const res = await fetch(`/api/deals/${deal.id}/analysis`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mode ? { mode } : { checkIds: pending }),
        });
        const parsed = await res.json().catch(() => null);
        if (!res.ok) throw new Error(parsed?.error ?? `${res.status}`);
        setAnalysis(parsed as AnalysisRecord);
        if (mode) break;
        const remaining: string[] = parsed.remaining ?? [];
        setAnalysisProgress(`${allItems.length - remaining.length} / ${allItems.length}`);
        pending = remaining.length > 0 ? remaining : null;
      } while (pending);
    } catch (problem) {
      setAnalysisError(describe(problem));
    } finally {
      setAnalysing(false);
      setAnalysisProgress(null);
    }
  }

  async function rerunItem(item: Item) {
    setAnalysingItem(item.id);
    setAnalysisError(null);
    try {
      const res = await fetch(`/api/deals/${deal.id}/analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkIds: [item.id] }),
      });
      const parsed = await res.json().catch(() => null);
      if (!res.ok) throw new Error(parsed?.error ?? `${res.status}`);
      setAnalysis(parsed as AnalysisRecord);
    } catch (problem) {
      setAnalysisError(describe(problem));
    } finally {
      setAnalysingItem(null);
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const allItems = sections.flatMap((s) => s.items);
  const doneCount = allItems.filter((item) => checks[item.id]?.checked).length;
  const complete = doneCount === allItems.length;
  const analysedCount = Object.keys(analysis.checks).length;

  function tileStatus(
    item: Item,
  ): "done" | "done-flagged" | "ai-cleared" | "flagged" | "blocked" | "todo" {
    const humanChecked = checks[item.id]?.checked === true;
    const hasRelated = item.relatedDocuments.length > 0;
    const anySubmitted = item.relatedDocuments.some((d) => d.submitted);
    const blocked = hasRelated && !anySubmitted;
    const found = analysis.checks[item.id];
    const stale = Boolean(found && newestUploadAt && newestUploadAt > found.analyzedAt);
    const verdict = found && !stale ? found.verdict : undefined;
    if (humanChecked) return verdict === "issues" ? "done-flagged" : "done";
    if (blocked) return "blocked";
    if (verdict === "met") return "ai-cleared";
    if (verdict === "issues") return "flagged";
    return "todo";
  }

  const aiClearedItems = allItems.filter((item) => tileStatus(item) === "ai-cleared");
  const flaggedCount = allItems.filter((item) => {
    const s = tileStatus(item);
    return s === "flagged" || s === "done-flagged";
  }).length;
  const blockedCount = allItems.filter((item) => tileStatus(item) === "blocked").length;
  const staleCount = allItems.filter((item) => {
    const found = analysis.checks[item.id];
    return found && newestUploadAt && newestUploadAt > found.analyzedAt;
  }).length;

  function acceptAllAiCleared() {
    for (const item of aiClearedItems) toggle(item, true);
  }

  // ── Item open/close ───────────────────────────────────────────────────────

  function openAndScroll(itemId: string) {
    setOpenItems((prev) => { const n = new Set(prev); n.add(itemId); return n; });
    setTimeout(() => {
      document.getElementById(`check-${itemId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function toggleOpen(itemId: string) {
    setOpenItems((prev) => {
      const n = new Set(prev);
      if (n.has(itemId)) n.delete(itemId); else n.add(itemId);
      return n;
    });
  }

  function expandAll() { setOpenItems(new Set(allItems.map((i) => i.id))); }
  function collapseAll() { setOpenItems(new Set()); }

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filterCounts: Record<FilterKey, number> = {
    all: allItems.length,
    flagged: allItems.filter((i) => { const s = tileStatus(i); return s === "flagged" || s === "done-flagged"; }).length,
    blocked: allItems.filter((i) => tileStatus(i) === "blocked").length,
    todo: allItems.filter((i) => { const s = tileStatus(i); return s === "todo" || s === "ai-cleared"; }).length,
    done: allItems.filter((i) => { const s = tileStatus(i); return s === "done" || s === "done-flagged"; }).length,
  };

  function matchesFilter(item: Item): boolean {
    if (filter === "all") return true;
    const s = tileStatus(item);
    if (filter === "flagged") return s === "flagged" || s === "done-flagged";
    if (filter === "blocked") return s === "blocked";
    if (filter === "todo") return s === "todo" || s === "ai-cleared";
    if (filter === "done") return s === "done" || s === "done-flagged";
    return true;
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  const statusConfig = {
    done: { dot: "bg-emerald-500", border: "border-l-emerald-500", badge: ko ? "확인" : "Done", badgeCls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" },
    "done-flagged": { dot: "bg-emerald-500", border: "border-l-emerald-500", badge: ko ? "확인 (지적후)" : "Done (flagged)", badgeCls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" },
    "ai-cleared": { dot: "bg-sky-400", border: "border-l-sky-400", badge: ko ? "AI 확인" : "AI cleared", badgeCls: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300" },
    flagged: { dot: "bg-red-500", border: "border-l-red-500", badge: ko ? "이슈" : "Issues", badgeCls: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300" },
    blocked: { dot: "bg-neutral-400", border: "border-l-neutral-400", badge: ko ? "서류 미제출" : "Docs missing", badgeCls: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400" },
    todo: { dot: "bg-neutral-300 dark:bg-neutral-700", border: "border-l-neutral-200 dark:border-l-neutral-800", badge: "", badgeCls: "" },
  } as const;

  function renderItem(item: Item, globalIdx: number) {
    const state = checks[item.id] ?? EMPTY;
    const status = tileStatus(item);
    const cfg = statusConfig[status];
    const isOpen = openItems.has(item.id);
    const [itemTitle, otherItemTitle] = both(item.titleKo, item.titleEn);
    const details = ko ? item.detailsKo : item.detailsEn;
    const tips = ko ? item.tipsKo : item.tipsEn;
    const hasNote = !!state.note?.trim();
    const hasVerified = !!state.verifiedAt?.trim();
    const itemAnalysis = analysis.checks[item.id];
    const isStale = Boolean(itemAnalysis && newestUploadAt && newestUploadAt > itemAnalysis.analyzedAt);

    return (
      <li
        key={item.id}
        id={`check-${item.id}`}
        className={`rounded-xl border border-l-4 transition-colors ${cfg.border} ${
          state.checked
            ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/60 dark:bg-emerald-950/10"
            : status === "flagged"
              ? "border-red-200 dark:border-red-900/60"
              : "border-neutral-200 dark:border-neutral-800"
        }`}
      >
        {/* ── Summary row (always visible) ── */}
        <div className="flex items-center gap-3 px-4 py-3">
          <input
            type="checkbox"
            checked={state.checked}
            onChange={(e) => toggle(item, e.target.checked)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 shrink-0 accent-emerald-600"
          />

          <button
            type="button"
            onClick={() => toggleOpen(item.id)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                  #{globalIdx} · {item.sourceRef}
                </span>
                {cfg.badge && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${cfg.badgeCls}`}>
                    {cfg.badge}
                  </span>
                )}
                {itemAnalysis && isStale && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                    {ko ? "분석 만료" : "stale"}
                  </span>
                )}
              </div>
              <p className={`mt-0.5 text-sm font-medium leading-snug ${state.checked ? "text-neutral-500 line-through" : ""}`}>
                {itemTitle}
              </p>
              <p className="mt-0.5 text-xs text-neutral-400">{otherItemTitle}</p>
            </div>

            {/* Doc pills summary */}
            {item.relatedDocuments.length > 0 && (
              <div className="hidden shrink-0 items-center gap-1 sm:flex">
                {item.relatedDocuments.slice(0, 2).map((doc) => (
                  <span
                    key={doc.id}
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      doc.submitted
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : "bg-neutral-100 text-neutral-400 line-through dark:bg-neutral-800"
                    }`}
                  >
                    {pick(doc.nameKo, doc.nameEn)}
                  </span>
                ))}
                {item.relatedDocuments.length > 2 && (
                  <span className="text-[10px] text-neutral-400">
                    +{item.relatedDocuments.length - 2}
                  </span>
                )}
              </div>
            )}

            {/* Meta badges */}
            <div className="flex shrink-0 items-center gap-1.5">
              {hasVerified && (
                <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-500 dark:bg-indigo-950/30 dark:text-indigo-400">
                  {state.verifiedAt}
                </span>
              )}
              {hasNote && (
                <span className="text-[11px] text-neutral-400" title={ko ? "메모 있음" : "Has memo"}>
                  ✏
                </span>
              )}
              {(initialComments[item.id]?.length ?? 0) > 0 && (
                <span className="flex items-center gap-0.5 text-[11px] text-neutral-400" title={ko ? "댓글 있음" : "Has comments"}>
                  💬 {initialComments[item.id].length}
                </span>
              )}
            </div>

            <span className="shrink-0 text-xs text-neutral-400">{isOpen ? "▾" : "▸"}</span>
          </button>
        </div>

        {/* ── Expanded detail ── */}
        {isOpen && (
          <div className="border-t border-neutral-100 px-4 pb-4 pt-3 dark:border-neutral-800/60">
            <ul className="ml-7 list-disc space-y-1 text-sm text-neutral-600 marker:text-neutral-300 dark:text-neutral-400">
              {details.map((d) => <li key={d}>{d}</li>)}
            </ul>

            {tips?.map((tip) => (
              <p key={tip} className="mt-2 ml-7 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                💡 {tip}
              </p>
            ))}

            {item.relatedDocuments.length > 0 && (
              <div className="mt-3 ml-7 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-neutral-400">{t(T.relatedDocs)}</span>
                {item.relatedDocuments.map((doc) => (
                  <span
                    key={doc.id}
                    title={doc.submitted ? t(T.submitted) : doc.optional ? t(T.ifApplicable) : t(T.notSubmitted)}
                    className={`rounded px-1.5 py-0.5 text-xs ${
                      doc.submitted
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-neutral-100 text-neutral-500 line-through dark:bg-neutral-800 dark:text-neutral-500"
                    }`}
                  >
                    {pick(doc.nameKo, doc.nameEn)}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3 ml-7 flex items-center gap-2">
              <CheckAnalysisPanel analysis={itemAnalysis} newestUploadAt={newestUploadAt} />
              <button
                type="button"
                onClick={() => rerunItem(item)}
                disabled={analysingItem === item.id || analysing}
                className="shrink-0 rounded-lg border border-neutral-200 px-2.5 py-1 text-[11px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                {analysingItem === item.id ? (ko ? "분석 중…" : "Analysing…") : (ko ? "AI 재분석" : "Re-analyse")}
              </button>
            </div>

            <div className="mt-3 ml-7 flex items-center gap-2">
              <label className="shrink-0 text-xs text-neutral-400">{ko ? "확인일" : "Verified"}</label>
              <input
                type="text"
                value={state.verifiedAt ?? ""}
                onChange={(e) => editVerifiedAt(item, e.target.value)}
                placeholder="YYYY-MM-DD"
                className="w-28 rounded border border-neutral-200 bg-white px-2 py-1 text-xs placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950"
              />
            </div>

            <textarea
              value={state.note}
              onChange={(e) => editNote(item, e.target.value)}
              rows={2}
              placeholder={t(T.memoPlaceholder)}
              className="mt-3 ml-7 block w-[calc(100%-1.75rem)] resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-950"
            />

            <CheckComments
              dealId={deal.id}
              checkId={item.id}
              initial={initialComments[item.id] ?? []}
              viewerEmail={viewerEmail}
            />
          </div>
        )}
      </li>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  const filterLabels: Record<FilterKey, string> = {
    all: ko ? "전체" : "All",
    flagged: ko ? "이슈" : "Issues",
    blocked: ko ? "서류 부족" : "Blocked",
    todo: ko ? "미확인" : "Unchecked",
    done: ko ? "완료" : "Done",
  };

  return (
    <main className="w-full px-6 py-8">

      {/* ── Header ── */}
      <header className="mb-6">
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <Link href={`/overview/${deal.id}`} className="hover:text-neutral-600 dark:hover:text-neutral-300">
            {companyName}
          </Link>
          <span>/</span>
          <span className="font-medium text-neutral-600 dark:text-neutral-300">
            {ko ? "서류 실사" : "Due Diligence"}
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {companyName}
          <span className="ml-2 text-lg font-normal text-neutral-400">
            {ko ? "실사 체크리스트" : "Diligence Checklist"}
          </span>
        </h1>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          {t(T.internalOnly)}
        </p>
      </header>

      {/* ── Stat cards ── */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: ko ? "확인 완료" : "Checked",
            value: `${doneCount} / ${allItems.length}`,
            sub: complete ? (ko ? "완료!" : "Complete!") : `${allItems.length - doneCount} ${ko ? "건 남음" : "remaining"}`,
            color: complete ? "emerald" : "neutral",
          },
          {
            label: ko ? "AI 분석" : "AI Coverage",
            value: `${analysedCount} / ${allItems.length}`,
            sub: staleCount > 0 ? `${staleCount} ${ko ? "건 만료" : "stale"}` : (ko ? "최신 상태" : "Up to date"),
            color: staleCount > 0 ? "amber" : "sky",
          },
          {
            label: ko ? "이슈 발견" : "Issues Found",
            value: flaggedCount,
            sub: flaggedCount > 0 ? (ko ? "검토 필요" : "Needs review") : (ko ? "이슈 없음" : "None found"),
            color: flaggedCount > 0 ? "red" : "emerald",
          },
          {
            label: ko ? "서류 미제출" : "Docs Missing",
            value: missingCount,
            sub: `${ko ? "전체" : "of"} ${totalRequired} ${ko ? "건" : "required"}`,
            color: missingCount > 0 ? "amber" : "emerald",
          },
        ].map(({ label, value, sub, color }) => (
          <div
            key={label}
            className={`rounded-xl border px-4 py-3 ${
              color === "emerald" ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/20"
              : color === "red" ? "border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/20"
              : color === "amber" ? "border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20"
              : color === "sky" ? "border-sky-200 bg-sky-50 dark:border-sky-900/60 dark:bg-sky-950/20"
              : "border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
            }`}
          >
            <p className={`text-2xl font-bold ${
              color === "emerald" ? "text-emerald-700 dark:text-emerald-300"
              : color === "red" ? "text-red-700 dark:text-red-300"
              : color === "amber" ? "text-amber-700 dark:text-amber-300"
              : color === "sky" ? "text-sky-700 dark:text-sky-300"
              : "text-neutral-800 dark:text-neutral-200"
            }`}>{value}</p>
            <p className="mt-0.5 text-xs font-semibold text-neutral-600 dark:text-neutral-300">{label}</p>
            <p className="mt-0.5 text-[11px] text-neutral-400">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Progress bar ── */}
      <div className="mb-5 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${complete ? "bg-emerald-500" : "bg-indigo-500"}`}
          style={{ width: `${(doneCount / allItems.length) * 100}%` }}
        />
      </div>

      {/* ── Missing docs warning ── */}
      {missingCount > 0 && (
        <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
          {ko
            ? `필수 서류 ${totalRequired}건 중 ${missingCount}건이 아직 제출되지 않았습니다.`
            : `${missingCount} of ${totalRequired} required documents haven't been submitted.`}{" "}
          <Link href={`/deal/${deal.id}`} className="font-medium underline">
            {t(T.viewSubmissions)}
          </Link>
        </p>
      )}

      {/* ── Status tile dashboard ── */}
      <section className="mb-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          {ko ? "항목 현황 지도" : "Item Status Map"}
        </h2>
        {(() => {
          let globalIdx = 0;
          return sections.map((section) => {
            const abbr = ko
              ? section.titleKo.replace(/\s/g, "").slice(0, 2)
              : section.titleEn.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
            return (
              <div key={section.id} className="mb-3 last:mb-0">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                  {ko ? section.titleKo : section.titleEn}
                </p>
                <div className="flex flex-wrap gap-2">
                  {section.items.map((item) => {
                    globalIdx += 1;
                    const idx = globalIdx;
                    const status = tileStatus(item);
                    const [itemTitle] = both(item.titleKo, item.titleEn);
                    const tileCls = {
                      done: "bg-emerald-500 text-white",
                      "done-flagged": "bg-emerald-500 text-white",
                      "ai-cleared": "text-white [background:linear-gradient(135deg,#38bdf8_50%,#9ca3af_50%)]",
                      flagged: "bg-red-500 text-white",
                      blocked: "bg-neutral-300 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400",
                      todo: "border border-neutral-200 bg-white text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300",
                    }[status];
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openAndScroll(item.id)}
                        title={ko ? item.titleKo : item.titleEn}
                        className={`relative flex w-24 flex-col gap-0.5 overflow-hidden rounded-xl p-2 text-left shadow-sm transition-all hover:scale-105 hover:shadow-md ${tileCls}`}
                      >
                        {status === "done-flagged" && (
                          <span aria-hidden className="absolute top-0 right-0 h-0 w-0 border-t-[14px] border-l-[14px] border-t-red-500 border-l-transparent" />
                        )}
                        <span className="text-[9px] font-bold uppercase opacity-70">{abbr} · {idx}</span>
                        <span className="line-clamp-3 text-[11px] font-medium leading-tight">{itemTitle}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          });
        })()}

        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-neutral-100 pt-3 dark:border-neutral-800">
          {[
            { cls: "bg-emerald-500", label: ko ? "확인 완료" : "Checked" },
            { cls: "[background:linear-gradient(135deg,#38bdf8_50%,#9ca3af_50%)]", label: ko ? "AI 확인 · 미체크" : "AI cleared" },
            { cls: "bg-red-500", label: ko ? "이슈" : "Issues" },
            { cls: "bg-neutral-300 dark:bg-neutral-700", label: ko ? "서류 미제출" : "Blocked" },
            { cls: "border border-neutral-300 bg-white dark:bg-neutral-900", label: ko ? "대기" : "Pending" },
          ].map(({ cls, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-xs text-neutral-500">
              <span className={`h-2.5 w-2.5 rounded-full ${cls}`} />
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* ── AI analysis panel ── */}
      <section className="mb-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{t(T.aiAnalysis)}</h2>
            <p className="mt-0.5 text-xs text-neutral-500">{t(T.analysisIntro)}</p>
            {analysedCount > 0 && (
              <p className="mt-1 text-xs text-neutral-400">
                {ko
                  ? `${analysedCount}건 분석됨${staleCount > 0 ? ` · ${staleCount}건 만료 (새 서류 업로드됨)` : ""}`
                  : `${analysedCount} analysed${staleCount > 0 ? ` · ${staleCount} stale (new uploads)` : ""}`}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {aiClearedItems.length > 0 && (
              <button
                type="button"
                onClick={acceptAllAiCleared}
                className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-800 transition-colors hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300"
              >
                {ko
                  ? `AI 확인 ${aiClearedItems.length}건 체크`
                  : `Accept ${aiClearedItems.length} AI-cleared`}
              </button>
            )}
            <button
              type="button"
              onClick={() => runAnalysis()}
              disabled={analysing}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
            >
              {analysing
                ? `${t(T.analysing)}${analysisProgress ? ` ${analysisProgress}` : "…"}`
                : t(analysedCount > 0 ? T.rerunAnalysis : T.runAnalysis)}
            </button>
          </div>
        </div>
        {analysisError && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            {t(T.analysisFailed)} — {analysisError}
          </p>
        )}
      </section>

      {/* ── Save indicator ── */}
      <p className="mb-4 h-4 text-xs text-neutral-400">
        {saveError ? (
          <span className="text-red-600 dark:text-red-400">{t(T.saveFailed)} — {saveError}</span>
        ) : saving > 0 ? t(T.saving)
        : savedAt ? `${t(T.saved)} ${savedAt}`
        : t(T.autosaveHint)}
      </p>

      {/* ── Filter bar + expand controls ── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "flagged", "blocked", "todo", "done"] as FilterKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === key
                  ? key === "flagged" ? "bg-red-600 text-white"
                  : key === "blocked" ? "bg-neutral-600 text-white"
                  : key === "done" ? "bg-emerald-600 text-white"
                  : "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              {filterLabels[key]}
              <span className={`rounded-full px-1 text-[10px] ${filter === key ? "bg-white/20" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"}`}>
                {filterCounts[key]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 text-xs text-neutral-400">
          <button type="button" onClick={expandAll} className="rounded px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            {ko ? "전체 펼치기" : "Expand all"}
          </button>
          <button type="button" onClick={collapseAll} className="rounded px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            {ko ? "전체 접기" : "Collapse all"}
          </button>
        </div>
      </div>

      {/* ── Check items ── */}
      {filter !== "all" ? (
        // Filtered flat list
        <section>
          {filterCounts[filter] === 0 ? (
            <p className="py-12 text-center text-sm text-neutral-400">
              {ko ? "해당하는 항목이 없습니다." : "No items match this filter."}
            </p>
          ) : (() => {
            let globalIdx = 0;
            return sections.map((section) => {
              const visible = section.items.filter(matchesFilter);
              if (visible.length === 0) return null;
              return (
                <div key={section.id} className="mb-6">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    {ko ? section.titleKo : section.titleEn}
                  </h3>
                  <ol className="space-y-2">
                    {section.items.map((item) => {
                      globalIdx += 1;
                      const idx = globalIdx;
                      if (!matchesFilter(item)) return null;
                      return renderItem(item, idx);
                    })}
                  </ol>
                </div>
              );
            });
          })()}
        </section>
      ) : (
        // All items grouped by section
        <div className="space-y-8">
          {(() => {
            let globalIdx = 0;
            return sections.map((section) => (
              <section key={section.id} id={`section-${section.id}`}>
                <div className="mb-3 flex items-baseline gap-2">
                  <h2 className="text-lg font-bold tracking-tight">
                    {both(section.titleKo, section.titleEn)[0]}
                  </h2>
                  <span className="text-sm text-neutral-400">
                    {both(section.titleKo, section.titleEn)[1]}
                  </span>
                  <span className="ml-auto text-xs text-neutral-400">
                    {section.items.filter((i) => checks[i.id]?.checked).length} / {section.items.length} {ko ? "완료" : "done"}
                  </span>
                </div>
                <p className="mb-3 text-sm text-neutral-500">
                  {pick(section.blurbKo, section.blurbEn)}
                </p>
                <ol className="space-y-2">
                  {section.items.map((item) => {
                    globalIdx += 1;
                    return renderItem(item, globalIdx);
                  })}
                </ol>
              </section>
            ));
          })()}
        </div>
      )}

      {/* ── AI-suggested extra checks ── */}
      <section className="mt-10 rounded-xl border border-dashed border-neutral-300 p-5 dark:border-neutral-700">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight">{t(T.aiSuggested)}</h2>
            <p className="mt-0.5 text-sm text-neutral-500">{t(T.aiSuggestedIntro)}</p>
          </div>
          <button
            type="button"
            onClick={() => runAnalysis("extra")}
            disabled={analysing || uploadedCount < MIN_DOCS_FOR_SUGGESTIONS}
            className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {analysing ? t(T.analysing) : t(T.suggestExtra)}
          </button>
        </div>

        {uploadedCount < MIN_DOCS_FOR_SUGGESTIONS ? (
          <p className="mt-3 text-sm text-neutral-500">
            {t(T.needMoreDocs)} ({uploadedCount} / {MIN_DOCS_FOR_SUGGESTIONS})
          </p>
        ) : analysis.extraChecks.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            {analysis.extraCheckedAt ? t(T.noExtraChecks) : t(T.notAnalysed)}
          </p>
        ) : (
          <ol className="mt-4 space-y-2">
            {analysis.extraChecks.map((extra, i) => (
              <li key={`${extra.titleEn}-${i}`} className="rounded-lg border border-neutral-200 p-3.5 dark:border-neutral-800">
                <p className="font-medium">{pick(extra.titleKo, extra.titleEn)}</p>
                <p className="mt-1 text-sm text-neutral-500">
                  {pick(extra.whyKo, extra.whyEn)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="mt-8">
        <PhaseDateEditor dealId={deal.id} phase="diligence" large />
      </div>

      <footer className="mt-6 border-t border-neutral-200 pt-6 text-xs text-neutral-400 dark:border-neutral-800">
        {t(T.diligenceSource)}
      </footer>
    </main>
  );
}
