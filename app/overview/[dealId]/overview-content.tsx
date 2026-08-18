"use client";

import Link from "next/link";
import type { Market } from "@/lib/documents";
import { useLang } from "@/app/lang-provider";

/**
 * A one-screen summary of where a company stands across every stage, with a
 * quick link into each. The orientation page you land on from the sidebar,
 * instead of dropping straight into document tracking.
 */

export type OverviewData = {
  dealId: string;
  market: Market;
  docsMissing: number | null;
  docsTotal: number | null;
  ddDone: number;
  ddTotal: number;
  agreementMissing: number;
  agreementTotal: number;
  agreementSaved: boolean;
  executionConfigured: boolean;
  executionPaymentDate: string;
  conversionStarted: boolean;
};

type Status = "done" | "progress" | "todo" | "muted";

export default function OverviewContent({
  data,
  companyKo,
  companyEn,
}: {
  data: OverviewData;
  companyKo: string;
  companyEn: string;
}) {
  const { lang, pick } = useLang();
  const ko = lang === "ko";
  const company = pick(companyKo, companyEn);

  // Documents
  const docsDone =
    data.docsTotal != null && data.docsMissing != null
      ? data.docsTotal - data.docsMissing
      : null;
  const docsStatus: Status =
    data.docsMissing == null ? "muted" : data.docsMissing === 0 ? "done" : "progress";

  // Diligence
  const ddStatus: Status =
    data.ddDone === 0 ? "todo" : data.ddDone >= data.ddTotal ? "done" : "progress";

  // Agreement
  const agreementDone = data.agreementTotal - data.agreementMissing;
  const agreementStatus: Status = !data.agreementSaved
    ? "todo"
    : data.agreementMissing === 0
      ? "done"
      : "progress";

  // Execution
  const executionStatus: Status = data.executionPaymentDate
    ? "progress"
    : data.executionConfigured
      ? "progress"
      : "todo";

  // Conversion
  const conversionStatus: Status = data.conversionStarted ? "progress" : "muted";

  // Deadline (from payment date + 30-day hard limit)
  let deadlineLabel: string | null = null;
  if (data.executionPaymentDate) {
    const base = new Date(data.executionPaymentDate);
    if (!Number.isNaN(base.getTime())) {
      const hard = base.getTime() + 30 * 86400000;
      const days = Math.ceil((hard - Date.now()) / 86400000);
      deadlineLabel =
        days < 0
          ? ko
            ? `기한 ${Math.abs(days)}일 초과`
            : `${Math.abs(days)}d overdue`
          : ko
            ? `기한 D-${days}`
            : `D-${days}`;
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{company}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {ko
            ? "이 회사의 단계별 현황입니다."
            : "Where this company stands across every stage."}
        </p>
      </header>

      <div className="space-y-3">
        <StageCard
          href={`/deal/${data.dealId}`}
          title={ko ? "서류 수집" : "Document tracking"}
          status={docsStatus}
          detail={
            docsDone == null
              ? ko
                ? "상태 알 수 없음"
                : "Status unknown"
              : ko
                ? `${docsDone}/${data.docsTotal}건 제출`
                : `${docsDone}/${data.docsTotal} submitted`
          }
          done={docsDone ?? 0}
          total={data.docsTotal ?? 0}
          ko={ko}
        />

        <StageCard
          href={`/diligence/${data.dealId}`}
          title={ko ? "서류 실사" : "Due diligence"}
          status={ddStatus}
          detail={
            ko ? `${data.ddDone}/${data.ddTotal}건 확인` : `${data.ddDone}/${data.ddTotal} checked`
          }
          done={data.ddDone}
          total={data.ddTotal}
          ko={ko}
        />

        <StageCard
          href={`/agreement/${data.dealId}`}
          title={ko ? "투자계약서" : "Agreement"}
          status={agreementStatus}
          detail={
            !data.agreementSaved
              ? ko
                ? "미작성"
                : "Not started"
              : ko
                ? `${agreementDone}/${data.agreementTotal} 항목 입력`
                : `${agreementDone}/${data.agreementTotal} fields filled`
          }
          done={agreementDone}
          total={data.agreementTotal}
          ko={ko}
        />

        <StageCard
          href={`/execution/${data.dealId}`}
          title={ko ? "투자 집행" : "Execution"}
          status={executionStatus}
          detail={
            data.executionPaymentDate
              ? `${ko ? "납입일" : "Payment"} ${data.executionPaymentDate}${deadlineLabel ? ` · ${deadlineLabel}` : ""}`
              : data.executionConfigured
                ? ko
                  ? "설정됨"
                  : "Configured"
                : ko
                  ? "미시작"
                  : "Not started"
          }
          ko={ko}
        />

        <StageCard
          href={`/conversion/${data.dealId}`}
          title={ko ? "SAFE 전환" : "SAFE conversion"}
          status={conversionStatus}
          detail={
            data.conversionStarted
              ? ko
                ? "진행 중"
                : "In progress"
              : ko
                ? "해당 시 (SAFE 전환 라운드)"
                : "If applicable (SAFE conversion round)"
          }
          ko={ko}
        />
      </div>
    </main>
  );
}

function StageCard({
  href,
  title,
  status,
  detail,
  done,
  total,
  ko,
}: {
  href: string;
  title: string;
  status: Status;
  detail: string;
  done?: number;
  total?: number;
  ko: boolean;
}) {
  const dot: Record<Status, string> = {
    done: "bg-emerald-500",
    progress: "bg-amber-500",
    todo: "bg-neutral-300 dark:bg-neutral-600",
    muted: "bg-neutral-200 dark:bg-neutral-700",
  };
  const label: Record<Status, string> = {
    done: ko ? "완료" : "Done",
    progress: ko ? "진행 중" : "In progress",
    todo: ko ? "시작 전" : "Not started",
    muted: ko ? "해당 시" : "If applicable",
  };

  const showBar = total != null && total > 0 && done != null;
  const percent = showBar ? Math.round((done! / total!) * 100) : 0;

  return (
    <Link
      href={href}
      className="block rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${dot[status]}`} />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <span className="text-[11px] text-neutral-400">{label[status]}</span>
      </div>

      <p className="mt-1 pl-4 text-xs text-neutral-500">{detail}</p>

      {showBar && (
        <div className="mt-2 ml-4 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div
            className={`h-full rounded-full ${
              status === "done" ? "bg-emerald-600" : "bg-neutral-900 dark:bg-white"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </Link>
  );
}
