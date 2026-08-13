"use client";

import type { CheckAnalysis } from "@/lib/analysis";
import { T } from "@/lib/i18n";
import { useLang } from "@/app/lang-provider";

/**
 * What the AI found for one check.
 *
 * Deliberately reads as a briefing rather than a verdict badge: the facts it
 * pulled out of the documents come first and biggest, because that's what an
 * analyst needs in order to make the call. The verdict is a hint above them,
 * not an answer, and nothing here touches the checkbox.
 */
export default function CheckAnalysisPanel({
  analysis,
  newestUploadAt,
}: {
  analysis: CheckAnalysis | undefined;
  /** When the most recent document arrived, for spotting a stale reading. */
  newestUploadAt: string | null;
}) {
  const { lang, t, pick } = useLang();

  if (!analysis) {
    return (
      <p className="mt-3 ml-8 text-xs text-neutral-400">{t(T.notAnalysed)}</p>
    );
  }

  // Documents have changed since this ran, so it describes files that may no
  // longer be there. A stale "looks satisfied" is the dangerous one.
  const stale = Boolean(newestUploadAt && newestUploadAt > analysis.analyzedAt);

  const tone = {
    met: "border-emerald-300 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20",
    issues: "border-amber-300 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20",
    unclear: "border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900",
  }[analysis.verdict];

  const verdictLabel = {
    met: t(T.verdictMet),
    issues: t(T.verdictIssues),
    unclear: t(T.verdictUnclear),
  }[analysis.verdict];

  const issues = lang === "ko" ? analysis.issuesKo : analysis.issuesEn;
  const instructions = lang === "ko" ? analysis.instructionsKo : analysis.instructionsEn;

  return (
    <div className={`mt-3 ml-8 rounded-lg border p-3 ${tone}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold">
          {t(T.aiAnalysis)}
          <span className="ml-2 font-normal">{verdictLabel}</span>
          {analysis.confidence > 0 && (
            <span className="ml-1.5 font-normal text-neutral-400">
              {Math.round(analysis.confidence * 100)}%
            </span>
          )}
        </p>
        <span className="text-[11px] text-neutral-400">
          {t(T.analysedAt)} {new Date(analysis.analyzedAt).toLocaleString()}
        </span>
      </div>

      {stale && (
        <p className="mt-1.5 rounded bg-amber-100 px-2 py-1 text-[11px] text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          {t(T.analysisStale)}
        </p>
      )}

      <p className="mt-1.5 text-sm text-neutral-700 dark:text-neutral-300">
        {pick(analysis.summaryKo, analysis.summaryEn)}
      </p>

      {analysis.keyFacts.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-medium text-neutral-500">{t(T.keyFacts)}</p>
          <dl className="mt-1 space-y-1">
            {analysis.keyFacts.map((fact, index) => (
              <div key={`${fact.labelEn}-${index}`} className="text-xs">
                <dt className="inline font-medium text-neutral-600 dark:text-neutral-400">
                  {pick(fact.labelKo, fact.labelEn)}:
                </dt>{" "}
                <dd className="inline text-neutral-800 dark:text-neutral-200">
                  {fact.value}
                </dd>
                {fact.source && (
                  <span className="ml-1.5 font-mono text-[10px] text-neutral-400">
                    {fact.source}
                  </span>
                )}
              </div>
            ))}
          </dl>
        </div>
      )}

      {issues.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-medium text-amber-700 dark:text-amber-500">
            {t(T.issuesFound)}
          </p>
          <ul className="mt-1 list-disc pl-4 text-xs text-neutral-700 marker:text-amber-500 dark:text-neutral-300">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {instructions.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-medium text-neutral-500">{t(T.whatToDo)}</p>
          <ul className="mt-1 list-disc pl-4 text-xs text-neutral-700 marker:text-neutral-300 dark:text-neutral-300">
            {instructions.map((instruction) => (
              <li key={instruction}>{instruction}</li>
            ))}
          </ul>
        </div>
      )}

      {analysis.documentsRead.length > 0 && (
        <p className="mt-2.5 truncate text-[10px] text-neutral-400">
          {t(T.documentsRead)}: {analysis.documentsRead.join(", ")}
        </p>
      )}
    </div>
  );
}
