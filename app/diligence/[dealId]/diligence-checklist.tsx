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

/** Long enough not to save on every keystroke, short enough not to lose a thought. */
const NOTE_SAVE_DELAY_MS = 800;

const EMPTY: CheckState = { checked: false, note: "", updatedAt: "" };

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

  // One pending timer per item, so typing in one memo never delays another.
  const noteTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timers = noteTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  async function save(checkId: string, patch: { checked?: boolean; note?: string }) {
    setSaving((count) => count + 1);
    setSaveError(null);

    try {
      const response = await fetch(`/api/deals/${deal.id}/diligence`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkId, ...patch }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `${response.status}`);
      }

      setSavedAt(new Date().toLocaleTimeString());
    } catch (problem) {
      setSaveError(describe(problem));
    } finally {
      setSaving((count) => count - 1);
    }
  }

  function toggle(item: Item, checked: boolean) {
    setChecks((current) => ({
      ...current,
      [item.id]: { ...(current[item.id] ?? EMPTY), checked },
    }));
    save(item.id, { checked });
  }

  function editNote(item: Item, note: string) {
    setChecks((current) => ({
      ...current,
      [item.id]: { ...(current[item.id] ?? EMPTY), note },
    }));

    const pending = noteTimers.current.get(item.id);
    if (pending) clearTimeout(pending);

    noteTimers.current.set(
      item.id,
      setTimeout(() => {
        noteTimers.current.delete(item.id);
        save(item.id, { note });
      }, NOTE_SAVE_DELAY_MS),
    );
  }

  /**
   * Walks the checklist a few checks at a time.
   *
   * The server caps each request so a single call can't run for minutes; this
   * keeps asking for what's left and shows how far it's got, rather than
   * leaving someone staring at a spinner for the whole checklist.
   */
  async function runAnalysis(mode?: "extra") {
    setAnalysing(true);
    setAnalysisError(null);
    setAnalysisProgress(null);

    try {
      let pending: string[] | null = null;
      let done = 0;

      do {
        const response = await fetch(`/api/deals/${deal.id}/analysis`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mode ? { mode } : { checkIds: pending }),
        });

        const parsed = await response.json().catch(() => null);
        if (!response.ok) throw new Error(parsed?.error ?? `${response.status}`);

        setAnalysis(parsed as AnalysisRecord);

        if (mode) break;

        const remaining: string[] = parsed.remaining ?? [];
        done = allItems.length - remaining.length;
        setAnalysisProgress(`${done} / ${allItems.length}`);
        pending = remaining.length > 0 ? remaining : null;
      } while (pending);
    } catch (problem) {
      setAnalysisError(describe(problem));
    } finally {
      setAnalysing(false);
      setAnalysisProgress(null);
    }
  }

  const allItems = sections.flatMap((section) => section.items);
  const doneCount = allItems.filter((item) => checks[item.id]?.checked).length;
  const complete = doneCount === allItems.length;
  const analysedCount = Object.keys(analysis.checks).length;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-8">
        <p className="text-sm font-medium tracking-wide text-neutral-500 uppercase">
          {t(T.internalOnly)}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {companyName} {t(T.diligenceTitle)}
        </h1>
      </header>

      <p className="mb-6 rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
        {t(T.internalBanner)}
      </p>

      {/* Progress */}
      <section
        className={`rounded-xl border p-6 ${
          complete
            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
            : "border-neutral-300 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
        }`}
      >
        <p className="text-2xl font-semibold">
          {complete
            ? t(T.allChecked)
            : ko
              ? `${allItems.length}개 중 ${doneCount}개 확인`
              : `${doneCount} of ${allItems.length} checked`}
        </p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div
            className={`h-full rounded-full transition-all ${
              complete ? "bg-emerald-600" : "bg-neutral-900 dark:bg-white"
            }`}
            style={{ width: `${(doneCount / allItems.length) * 100}%` }}
          />
        </div>

        {missingCount > 0 && (
          <p className="mt-4 text-sm text-amber-700 dark:text-amber-500">
            {ko
              ? `아직 제출되지 않은 필수 서류가 ${totalRequired}건 중 ${missingCount}건 있습니다. `
              : `${missingCount} of ${totalRequired} required documents haven't arrived yet. `}
            {t(T.missingDocsWarning)}{" "}
            <Link href={`/deal/${deal.id}`} className="underline">
              {t(T.viewSubmissions)}
            </Link>
          </p>
        )}
      </section>

      {/* AI analysis */}
      <section className="mt-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{t(T.aiAnalysis)}</h2>
            <p className="mt-0.5 text-xs text-neutral-500">{t(T.analysisIntro)}</p>
          </div>

          <button
            type="button"
            onClick={() => runAnalysis()}
            disabled={analysing}
            className="shrink-0 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {analysing
              ? `${t(T.analysing)}${analysisProgress ? ` ${analysisProgress}` : ""}`
              : t(analysedCount > 0 ? T.rerunAnalysis : T.runAnalysis)}
          </button>
        </div>

        {analysisError && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            {t(T.analysisFailed)} — {analysisError}
          </p>
        )}
      </section>

      {/* Save indicator */}
      <p className="mt-3 h-5 text-xs text-neutral-400">
        {saveError ? (
          <span className="text-red-600 dark:text-red-400">
            {t(T.saveFailed)} — {saveError}
          </span>
        ) : saving > 0 ? (
          t(T.saving)
        ) : savedAt ? (
          `${t(T.saved)} ${savedAt}`
        ) : (
          t(T.autosaveHint)
        )}
      </p>

      {sections.map((section) => (
        <section key={section.id} className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">
            {both(section.titleKo, section.titleEn)[0]}
            <span className="ml-2 text-sm font-normal text-neutral-500">
              {both(section.titleKo, section.titleEn)[1]}
            </span>
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            {pick(section.blurbKo, section.blurbEn)}
          </p>

          <ol className="mt-4 space-y-4">
            {section.items.map((item) => {
              const state = checks[item.id] ?? EMPTY;
              const details = ko ? item.detailsKo : item.detailsEn;
              const tips = ko ? item.tipsKo : item.tipsEn;
              const [itemTitle, otherItemTitle] = both(item.titleKo, item.titleEn);

              return (
                <li
                  key={item.id}
                  className={`rounded-xl border p-5 transition-colors ${
                    state.checked
                      ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20"
                      : "border-neutral-200 dark:border-neutral-800"
                  }`}
                >
                  <label className="flex cursor-pointer gap-3">
                    <input
                      type="checkbox"
                      checked={state.checked}
                      onChange={(event) => toggle(item, event.target.checked)}
                      className="mt-1 h-5 w-5 shrink-0 accent-emerald-600"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{itemTitle}</span>
                      <span className="mt-0.5 block text-sm text-neutral-500">
                        {otherItemTitle} &middot; {item.sourceRef}
                      </span>
                    </span>
                  </label>

                  <ul className="mt-3 ml-8 list-disc space-y-1 text-sm text-neutral-600 marker:text-neutral-300 dark:text-neutral-400">
                    {details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>

                  {tips?.map((tip) => (
                    <p
                      key={tip}
                      className="mt-2 ml-8 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
                    >
                      💡 {tip}
                    </p>
                  ))}

                  {item.relatedDocuments.length > 0 && (
                    <div className="mt-3 ml-8 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-neutral-400">{t(T.relatedDocs)}</span>
                      {item.relatedDocuments.map((doc) => (
                        <span
                          key={doc.id}
                          title={
                            doc.submitted
                              ? t(T.submitted)
                              : doc.optional
                                ? t(T.ifApplicable)
                                : t(T.notSubmitted)
                          }
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

                  <CheckAnalysisPanel
                    analysis={analysis.checks[item.id]}
                    newestUploadAt={newestUploadAt}
                  />

                  <textarea
                    value={state.note}
                    onChange={(event) => editNote(item, event.target.value)}
                    rows={2}
                    placeholder={t(T.memoPlaceholder)}
                    className="mt-3 ml-8 block w-[calc(100%-2rem)] resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-950"
                  />

                  <CheckComments
                    dealId={deal.id}
                    checkId={item.id}
                    initial={initialComments[item.id] ?? []}
                    viewerEmail={viewerEmail}
                  />
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      {/* Checks the AI thinks this particular company needs, beyond the
          standard list. Company-specific by nature, so it needs a reasonable
          amount of paperwork on file before it has anything to go on. */}
      <section className="mt-10 rounded-xl border border-dashed border-neutral-300 p-5 dark:border-neutral-700">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight">{t(T.aiSuggested)}</h2>
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
          <p className="mt-4 text-sm text-neutral-500">
            {t(T.needMoreDocs)} ({uploadedCount} / {MIN_DOCS_FOR_SUGGESTIONS})
          </p>
        ) : analysis.extraChecks.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">
            {analysis.extraCheckedAt ? t(T.noExtraChecks) : t(T.notAnalysed)}
          </p>
        ) : (
          <ol className="mt-4 space-y-3">
            {analysis.extraChecks.map((extra, index) => (
              <li
                key={`${extra.titleEn}-${index}`}
                className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
              >
                <p className="font-medium">{pick(extra.titleKo, extra.titleEn)}</p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {pick(extra.whyKo, extra.whyEn)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <footer className="mt-10 border-t border-neutral-200 pt-6 text-xs text-neutral-400 dark:border-neutral-800">
        {t(T.diligenceSource)}
      </footer>
    </main>
  );
}
