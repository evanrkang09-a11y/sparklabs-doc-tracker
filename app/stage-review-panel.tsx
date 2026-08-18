"use client";

import { useState } from "react";
import { describe } from "@/lib/errors";
import { useLang } from "./lang-provider";

/**
 * An on-demand AI review of the current stage. Reads this deal's state plus the
 * process rules and returns a short briefing: progress, what's missing, risks,
 * and next actions. Advisory only.
 */

type Review = {
  summary: string;
  missing: string[];
  risks: string[];
  nextActions: string[];
};

export default function StageReviewPanel({
  dealId,
  stage,
}: {
  dealId: string;
  stage: "execution" | "conversion";
}) {
  const { lang } = useLang();
  const ko = lang === "ko";

  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/deals/${dealId}/stage-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, lang }),
      });
      const parsed = await response.json().catch(() => null);
      if (!response.ok) throw new Error(parsed?.error ?? `${response.status}`);
      setReview(parsed as Review);
    } catch (problem) {
      setError(describe(problem));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-sm dark:border-indigo-900 dark:bg-indigo-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{ko ? "AI 단계 검토" : "AI stage review"}</h2>
          <p className="text-[11px] text-neutral-500">
            {ko
              ? "현재 상태를 분석해 진행 상황·누락·위험·다음 할 일을 알려줍니다."
              : "Analyses the current state for progress, gaps, risks and next steps."}
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? (ko ? "분석 중…" : "Reviewing…") : review ? (ko ? "다시 검토" : "Re-review") : ko ? "AI로 검토" : "Review with AI"}
        </button>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {review && (
        <div className="mt-3 space-y-3 text-sm">
          <p className="text-neutral-700 dark:text-neutral-300">{review.summary}</p>
          {review.missing.length > 0 && (
            <ReviewList title={ko ? "누락 항목" : "Missing"} items={review.missing} tone="amber" />
          )}
          {review.risks.length > 0 && (
            <ReviewList title={ko ? "위험" : "Risks"} items={review.risks} tone="red" />
          )}
          {review.nextActions.length > 0 && (
            <ReviewList title={ko ? "다음 할 일" : "Next actions"} items={review.nextActions} tone="neutral" />
          )}
          <p className="text-[10px] text-neutral-400">
            {ko ? "AI 참고용입니다. 중요한 사항은 멘토님께 확인하세요." : "AI reference only — confirm important items with your mentor."}
          </p>
        </div>
      )}
    </section>
  );
}

function ReviewList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "amber" | "red" | "neutral";
}) {
  const dot = {
    amber: "marker:text-amber-500",
    red: "marker:text-red-500",
    neutral: "marker:text-neutral-400",
  }[tone];
  return (
    <div>
      <p className="text-[11px] font-medium text-neutral-500">{title}</p>
      <ul className={`mt-1 list-disc pl-4 text-xs text-neutral-700 dark:text-neutral-300 ${dot}`}>
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
