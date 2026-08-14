"use client";

import { useMemo, useState } from "react";
import type { Deal } from "@/lib/deals";
import { DESTINATION_LABEL, type ExecutionDoc } from "@/lib/execution";
import { useLang } from "@/app/lang-provider";

/**
 * Post-payment document handoff — the "투자 후 서류 관리용 파일" from #6-C.
 *
 * Two things live here, both built from the post-payment checklist above:
 *
 *  1. A copy-ready summary of which documents have been collected, grouped by
 *     where each must go (수탁은행 via 경영지원본부 vs kept internally), for
 *     pasting into the handoff message to management support.
 *
 *  2. The Google Drive filing convention from #6-C — the exact folder path a
 *     scanned document set should land in, with the new folder name to create.
 */
export default function HandoffSummary({
  deal,
  postDocs,
  postChecks,
}: {
  deal: Deal;
  postDocs: ExecutionDoc[];
  postChecks: Record<string, boolean>;
}) {
  const { lang, pick } = useLang();
  const ko = lang === "ko";
  const [copied, setCopied] = useState<"summary" | "folder" | null>(null);

  const company = pick(deal.companyKo, deal.companyEn);

  // The Drive convention: Investment Related Docs > <company> > new subfolder.
  const NEW_FOLDER = "투자(등기) 후 제출서류";
  const drivePath = `Investment Related Docs / ${company} / ${NEW_FOLDER}`;

  const groups = useMemo(() => {
    const custodian = postDocs.filter((d) => d.destination === "custodian");
    const internal = postDocs.filter((d) => d.destination === "internal");
    const other = postDocs.filter((d) => !d.destination);
    return { custodian, internal, other };
  }, [postDocs]);

  const collected = postDocs.filter((d) => postChecks[d.id]).length;

  const summary = useMemo(() => {
    const mark = (d: ExecutionDoc) =>
      `${postChecks[d.id] ? "✓" : "☐"} ${pick(d.nameKo, d.nameEn)}`;

    const block = (label: string, docs: ExecutionDoc[]) =>
      docs.length ? `[${label}]\n${docs.map(mark).join("\n")}` : "";

    const parts = [
      ko
        ? `투자 후 서류 취합 현황 — ${company}`
        : `Post-investment document handoff — ${company}`,
      "",
      block(
        ko ? "수탁은행 전달 (경영지원본부 경유)" : "To custodian bank (via Mgmt Support)",
        groups.custodian,
      ),
      block(ko ? "내부보관" : "Kept internally", groups.internal),
      block(ko ? "기타" : "Other", groups.other),
      "",
      ko
        ? `취합: ${collected}/${postDocs.length}건`
        : `Collected: ${collected}/${postDocs.length}`,
    ];

    return parts.filter((p) => p !== "").join("\n\n").replace(/\n\n\[/g, "\n\n[");
  }, [ko, company, groups, postChecks, collected, postDocs, pick]);

  async function copy(text: string, which: "summary" | "folder") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard blocked - the text is selectable regardless.
    }
  }

  if (postDocs.length === 0) return null;

  return (
    <>
      {/* Handoff summary */}
      <section className="mb-5 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">
            {ko ? "서류 취합 현황 (인계용)" : "Handoff summary"}
          </h2>
          <span className="text-xs text-neutral-400">
            {collected}/{postDocs.length}
          </span>
        </div>
        <p className="mb-3 text-[11px] text-neutral-400">
          {ko
            ? "위 체크리스트 기준으로 자동 작성됩니다. 경영지원본부 인계 시 붙여넣으세요."
            : "Built from the checklist above. Paste it when handing off to management support."}
        </p>

        <textarea
          readOnly
          value={summary}
          rows={Math.min(16, postDocs.length + 8)}
          className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-700 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
        />

        <button
          type="button"
          onClick={() => copy(summary, "summary")}
          className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          {copied === "summary" ? (ko ? "복사됨 ✓" : "Copied ✓") : ko ? "복사" : "Copy"}
        </button>

        {/* Which destinations exist, as a legend */}
        <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-neutral-400">
          <span>
            <span className="mr-1 rounded bg-sky-100 px-1.5 py-0.5 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
              {pick(DESTINATION_LABEL.custodian.ko, DESTINATION_LABEL.custodian.en)}
            </span>
            {ko ? "원본 → 수탁은행 (30일 내 도착)" : "originals → custodian (within 30 days)"}
          </span>
          <span>
            <span className="mr-1 rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
              {pick(DESTINATION_LABEL.internal.ko, DESTINATION_LABEL.internal.en)}
            </span>
            {ko ? "스파크랩 보관" : "kept at SparkLabs"}
          </span>
        </div>
      </section>

      {/* Google Drive filing convention */}
      <section className="mb-5 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="mb-1 text-sm font-semibold">
          {ko ? "구글 드라이브 정리" : "Google Drive filing"}
        </h2>
        <p className="mb-3 text-[11px] text-neutral-400">
          {ko
            ? "모든 서류를 스캔하여 아래 경로에 저장합니다. 새 하위 폴더를 만들어 정리하세요."
            : "Scan every document and save it under this path. Create the new subfolder to file them."}
        </p>

        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
          <code className="min-w-0 flex-1 truncate text-xs text-neutral-600 dark:text-neutral-300">
            {drivePath}
          </code>
          <button
            type="button"
            onClick={() => copy(NEW_FOLDER, "folder")}
            className="shrink-0 rounded border border-neutral-300 px-2 py-1 text-[11px] transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {copied === "folder"
              ? ko
                ? "복사됨 ✓"
                : "Copied ✓"
              : ko
                ? "폴더명 복사"
                : "Copy folder name"}
          </button>
        </div>

        <p className="mt-2 text-[10px] text-neutral-400">
          {ko
            ? '"Investment Related Docs" 폴더 → 각 회사 폴더 → 신규 "투자(등기) 후 제출서류" 폴더'
            : '"Investment Related Docs" → each company folder → new "투자(등기) 후 제출서류" folder'}
        </p>
      </section>
    </>
  );
}
