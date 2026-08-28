"use client";

import Link from "next/link";
import { useState } from "react";
import type { Market } from "@/lib/documents";
import type { Deal } from "@/lib/deals";
import type { DealTimeline, PhaseKey } from "@/lib/deal-timeline";
import { useLang } from "@/app/lang-provider";
import ConversionModal from "@/app/conversion/[dealId]/conversion-modal";

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
  deal,
  companyKo,
  companyEn,
  agreementSaved,
  initialTimeline,
}: {
  data: OverviewData;
  deal: Deal;
  companyKo: string;
  companyEn: string;
  agreementSaved: boolean;
  initialTimeline: DealTimeline;
}) {
  const { lang, pick } = useLang();
  const ko = lang === "ko";
  const company = pick(companyKo, companyEn);
  const otherCompany = pick(companyEn, companyKo);

  const [affiliationDate, setAffiliationDate] = useState(deal.affiliationDate ?? "");
  const [timeline, setTimeline] = useState<DealTimeline>(initialTimeline);

  async function saveAffiliationDate(val: string) {
    setAffiliationDate(val);
    await fetch(`/api/companies/${deal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ affiliationDate: val || null }),
    });
  }

  async function savePhaseDate(phase: PhaseKey, field: "start" | "end", val: string) {
    setTimeline((prev) => ({
      ...prev,
      [phase]: { ...(prev[phase] ?? {}), [field]: val || undefined },
    }));
    await fetch(`/api/deals/${deal.id}/timeline`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase, [field]: val || null }),
    });
  }

  // ── Stage statuses ────────────────────────────────────────────────────────

  const docsDone =
    data.docsTotal != null && data.docsMissing != null
      ? data.docsTotal - data.docsMissing
      : null;
  const docsStatus: Status =
    data.docsMissing == null ? "muted" : data.docsMissing === 0 ? "done" : "progress";

  const ddStatus: Status =
    data.ddDone === 0 ? "todo" : data.ddDone >= data.ddTotal ? "done" : "progress";

  const agreementDone = data.agreementTotal - data.agreementMissing;
  const agreementStatus: Status = !data.agreementSaved
    ? "todo"
    : data.agreementMissing === 0
      ? "done"
      : "progress";

  const executionStatus: Status = data.executionPaymentDate
    ? "progress"
    : data.executionConfigured
      ? "progress"
      : "todo";

  const conversionStatus: Status = data.conversionStarted ? "progress" : "muted";

  // ── Deadline ──────────────────────────────────────────────────────────────

  let deadlineLabel: string | null = null;
  let deadlineOverdue = false;
  if (data.executionPaymentDate) {
    const base = new Date(data.executionPaymentDate);
    if (!Number.isNaN(base.getTime())) {
      const hard = base.getTime() + 30 * 86400000;
      const days = Math.ceil((hard - Date.now()) / 86400000);
      deadlineOverdue = days < 0;
      deadlineLabel =
        days < 0
          ? ko ? `기한 ${Math.abs(days)}일 초과` : `${Math.abs(days)}d overdue`
          : ko ? `기한 D-${days}` : `D-${days}`;
    }
  }

  // ── Attention items ───────────────────────────────────────────────────────

  type Alert = { label: string; href: string };
  const alerts: Alert[] = [];
  if (data.docsMissing && data.docsMissing > 0)
    alerts.push({
      label: ko ? `서류 ${data.docsMissing}건 미제출` : `${data.docsMissing} documents missing`,
      href: `/deal/${data.dealId}`,
    });
  if (data.ddDone < data.ddTotal && data.ddDone > 0)
    alerts.push({
      label: ko
        ? `실사 ${data.ddTotal - data.ddDone}건 미확인`
        : `${data.ddTotal - data.ddDone} diligence checks remaining`,
      href: `/diligence/${data.dealId}`,
    });
  if (deadlineOverdue && deadlineLabel)
    alerts.push({
      label: deadlineLabel,
      href: `/execution/${data.dealId}`,
    });

  // ── Stage pipeline config ─────────────────────────────────────────────────

  const stages = [
    {
      key: "docs",
      href: `/deal/${data.dealId}`,
      icon: "📋",
      title: ko ? "서류 수집" : "Documents",
      status: docsStatus,
      done: docsDone ?? 0,
      total: data.docsTotal ?? 0,
      detail:
        docsDone == null
          ? ko ? "상태 알 수 없음" : "Unknown"
          : ko ? `${docsDone} / ${data.docsTotal}건 제출` : `${docsDone} of ${data.docsTotal} submitted`,
      showBar: data.docsTotal != null && data.docsTotal > 0 && docsDone != null,
    },
    {
      key: "dd",
      href: `/diligence/${data.dealId}`,
      icon: "🔍",
      title: ko ? "서류 실사" : "Due Diligence",
      status: ddStatus,
      done: data.ddDone,
      total: data.ddTotal,
      detail: ko ? `${data.ddDone} / ${data.ddTotal}건 확인` : `${data.ddDone} of ${data.ddTotal} checked`,
      showBar: data.ddTotal > 0,
    },
    {
      key: "agreement",
      href: `/agreement/${data.dealId}`,
      icon: "📝",
      title: ko ? "투자계약서" : "Agreement",
      status: agreementStatus,
      done: agreementDone,
      total: data.agreementTotal,
      detail: !data.agreementSaved
        ? ko ? "미작성" : "Not started"
        : ko ? `${agreementDone} / ${data.agreementTotal} 항목 입력` : `${agreementDone} of ${data.agreementTotal} fields filled`,
      showBar: data.agreementSaved && data.agreementTotal > 0,
    },
    {
      key: "execution",
      href: `/execution/${data.dealId}`,
      icon: "💳",
      title: ko ? "투자 집행" : "Execution",
      status: executionStatus,
      done: 0,
      total: 0,
      detail: data.executionPaymentDate
        ? `${ko ? "납입일" : "Payment"} ${data.executionPaymentDate}${deadlineLabel ? ` · ${deadlineLabel}` : ""}`
        : data.executionConfigured
          ? ko ? "설정됨" : "Configured"
          : ko ? "미시작" : "Not started",
      showBar: false,
      deadlineOverdue,
    },
  ] as const;

  const statusDot: Record<Status, string> = {
    done: "bg-emerald-500",
    progress: "bg-amber-400",
    todo: "bg-neutral-300 dark:bg-neutral-600",
    muted: "bg-neutral-200 dark:bg-neutral-700",
  };
  const statusLabel: Record<Status, string> = {
    done: ko ? "완료" : "Done",
    progress: ko ? "진행 중" : "In progress",
    todo: ko ? "시작 전" : "Not started",
    muted: ko ? "해당 시" : "If applicable",
  };
  const statusBorder: Record<Status, string> = {
    done: "border-l-emerald-400",
    progress: "border-l-amber-400",
    todo: "border-l-neutral-200 dark:border-l-neutral-800",
    muted: "border-l-neutral-200 dark:border-l-neutral-800",
  };

  const allDone =
    docsStatus === "done" &&
    ddStatus === "done" &&
    agreementStatus === "done";

  return (
    <main className="w-full px-6 py-8">

      {/* ── Header ── */}
      <header className="mb-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              {data.market === "domestic" ? (ko ? "국내" : "Domestic") : (ko ? "해외" : "Overseas")} · SparkLabs
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{company}</h1>
            {otherCompany && (
              <p className="mt-0.5 text-sm text-neutral-400">{otherCompany}</p>
            )}
            <div className="mt-3 flex items-center gap-2 self-start rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 dark:border-indigo-900/40 dark:bg-indigo-950/20">
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                {ko ? "SparkLabs 제휴일" : "Affiliated with SparkLabs"}
              </span>
              <input
                type="date"
                value={affiliationDate}
                onChange={(e) => saveAffiliationDate(e.target.value)}
                className="rounded border border-indigo-200 bg-white px-2 py-1 text-sm font-medium text-indigo-900 focus:border-indigo-400 focus:outline-none dark:border-indigo-800 dark:bg-neutral-900 dark:text-indigo-200"
              />
            </div>
          </div>

          {/* Overall health badge */}
          {allDone ? (
            <span className="mt-1 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              {ko ? "모든 단계 완료 ✓" : "All stages done ✓"}
            </span>
          ) : alerts.length > 0 ? (
            <span className="mt-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              {ko ? `${alerts.length}건 주의` : `${alerts.length} need${alerts.length === 1 ? "s" : ""} attention`}
            </span>
          ) : null}
        </div>
      </header>

      {/* ── Attention alerts ── */}
      {alerts.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            {ko ? "주의 필요" : "Needs attention"}
          </p>
          <ul className="space-y-1.5">
            {alerts.map((a) => (
              <li key={a.href}>
                <Link
                  href={a.href}
                  className="flex items-center gap-2 text-sm text-amber-800 underline-offset-2 hover:underline dark:text-amber-300"
                >
                  <span className="text-amber-500">→</span>
                  {a.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Pipeline progress ── */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          {ko ? "단계별 현황" : "Pipeline"}
        </h2>
        <span className="text-xs text-neutral-400">
          {stages.filter((s) => s.status === "done").length} / {stages.length} {ko ? "단계 완료" : "stages done"}
        </span>
      </div>

      <div className="mb-8 space-y-2.5">
        {stages.map((stage) => {
          const pct = stage.showBar && stage.total > 0
            ? Math.round((stage.done / stage.total) * 100)
            : 0;

          return (
            <Link
              key={stage.key}
              href={stage.href}
              className={`group block rounded-xl border border-l-4 bg-white px-5 py-4 shadow-sm transition-all hover:shadow-md dark:bg-neutral-900 ${statusBorder[stage.status]} ${
                stage.status === "done"
                  ? "border-emerald-200 dark:border-emerald-900/50"
                  : "border-neutral-200 dark:border-neutral-800"
              } ${"deadlineOverdue" in stage && stage.deadlineOverdue ? "border-red-200 border-l-red-500 dark:border-red-900/60" : ""}`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg">{stage.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold tracking-tight">{stage.title}</span>
                      <span className={`h-1.5 w-1.5 rounded-full ${statusDot[stage.status]}`} />
                      <span className="text-xs text-neutral-400">{statusLabel[stage.status]}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-neutral-500">{stage.detail}</p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {stage.showBar && stage.total > 0 && (
                    <div className="hidden w-24 sm:block">
                      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                        <div
                          className={`h-full rounded-full transition-all ${stage.status === "done" ? "bg-emerald-500" : "bg-indigo-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-0.5 text-right text-[10px] text-neutral-400">{pct}%</p>
                    </div>
                  )}
                  <span className="text-neutral-300 transition-transform group-hover:translate-x-0.5 dark:text-neutral-600">
                    →
                  </span>
                </div>
              </div>
            </Link>
          );
        })}

        {/* Conversion — not a simple link, uses modal */}
        <div className={`rounded-xl border border-l-4 bg-white px-5 py-4 shadow-sm dark:bg-neutral-900 ${
          conversionStatus === "progress"
            ? "border-amber-200 border-l-amber-400 dark:border-amber-900/50"
            : "border-neutral-200 border-l-neutral-200 dark:border-neutral-800 dark:border-l-neutral-800"
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-lg">🔄</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold tracking-tight">{ko ? "전환 관리" : "Conversion"}</span>
                <span className={`h-1.5 w-1.5 rounded-full ${statusDot[conversionStatus]}`} />
                <span className="text-xs text-neutral-400">{statusLabel[conversionStatus]}</span>
              </div>
              <p className="mt-0.5 text-sm text-neutral-500">
                {data.conversionStarted
                  ? (ko ? "전환 진행 중" : "Conversion in progress")
                  : (ko ? "해당 시 기록" : "Record if applicable")}
              </p>
            </div>
          </div>
          <div className="mt-3 pl-9">
            <ConversionModal deal={deal} />
          </div>
        </div>
      </div>

      {/* ── Agreement downloads ── */}
      {agreementSaved && (
        <section className="mb-6 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            {ko ? "계약서 파일" : "Agreement files"}
          </h2>
          <AgreementDownloads dealId={data.dealId} companyKo={companyKo} ko={ko} />
        </section>
      )}

      {/* ── Phase Timeline ── */}
      <section className="mb-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          {ko ? "단계별 일정" : "Phase timeline"}
        </h2>
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 dark:border-neutral-800">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-neutral-400">{ko ? "단계" : "Phase"}</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-neutral-400">{ko ? "시작일" : "Start"}</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-neutral-400">{ko ? "종료일" : "End"}</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-neutral-400">{ko ? "기간" : "Duration"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800">
              {(
                [
                  { key: "documents" as PhaseKey, icon: "📋", label: ko ? "서류 수집" : "Documents" },
                  { key: "diligence" as PhaseKey, icon: "🔍", label: ko ? "서류 실사" : "Diligence" },
                  { key: "agreement" as PhaseKey, icon: "📝", label: ko ? "투자계약서" : "Agreement" },
                  { key: "execution" as PhaseKey, icon: "💳", label: ko ? "투자 집행" : "Execution" },
                ]
              ).map(({ key, icon, label }) => {
                const w = timeline[key];
                const startMs = w?.start ? new Date(w.start).getTime() : null;
                const endMs = w?.end ? new Date(w.end).getTime() : null;
                const days = startMs && endMs ? Math.round((endMs - startMs) / 86_400_000) : null;
                return (
                  <tr key={key}>
                    <td className="px-4 py-2.5 font-medium text-neutral-700 dark:text-neutral-300">
                      <span className="mr-2">{icon}</span>{label}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="date"
                        value={w?.start ?? ""}
                        onChange={(e) => savePhaseDate(key, "start", e.target.value)}
                        className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="date"
                        value={w?.end ?? ""}
                        onChange={(e) => savePhaseDate(key, "end", e.target.value)}
                        className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-neutral-400">
                      {days !== null
                        ? days === 0
                          ? ko ? "당일" : "Same day"
                          : ko ? `${days}일` : `${days}d`
                        : w?.start && !w?.end
                          ? <span className="text-amber-500">{ko ? "진행 중" : "In progress"}</span>
                          : <span className="text-neutral-300 dark:text-neutral-700">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Messages ── */}
      <section>
        <CompanyMessages dealId={data.dealId} ko={ko} />
      </section>
    </main>
  );
}

function AgreementDownloads({ dealId, companyKo, ko }: { dealId: string; companyKo: string; ko: boolean }) {
  const [dlDocx, setDlDocx] = useState(false);
  const [dlZip, setDlZip] = useState(false);

  async function downloadFile(url: string, filename: string, setFlag: (v: boolean) => void) {
    setFlag(true);
    try {
      const res = await fetch(url);
      if (!res.ok) { alert(ko ? "다운로드 실패" : "Download failed"); return; }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(href);
    } finally {
      setFlag(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => downloadFile(`/api/deals/${dealId}/agreement/download`, `투자계약서_${companyKo || dealId}.docx`, setDlDocx)}
        disabled={dlDocx}
        className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800"
      >
        <span>↓</span>
        {dlDocx ? (ko ? "다운로드 중…" : "Downloading…") : (ko ? "계약서 (.docx)" : "Agreement (.docx)")}
      </button>
      <button
        type="button"
        onClick={() => downloadFile(`/api/deals/${dealId}/agreement/zip`, `agreements_${companyKo || dealId}.zip`, setDlZip)}
        disabled={dlZip}
        className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800"
      >
        <span>↓</span>
        {dlZip ? (ko ? "압축 중…" : "Zipping…") : (ko ? "전체 파일 (.zip)" : "All files (.zip)")}
      </button>
    </div>
  );
}

type MessageItem = { id: string; text: string; sender: string; senderName: string; sentAt: string };

function CompanyMessages({ dealId, ko }: { dealId: string; ko: boolean }) {
  const [messages, setMessages] = useState<MessageItem[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);

  async function load() {
    if (messages !== null) return;
    const res = await fetch(`/api/messages/${dealId}`);
    if (res.ok) setMessages(await res.json());
  }

  async function toggle() {
    setOpen((v) => !v);
    if (!open) await load();
  }

  async function send() {
    if (!draft.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/messages/${dealId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft.trim() }),
      });
      if (res.ok) {
        const msg: MessageItem = await res.json();
        setMessages((prev) => [...(prev ?? []), msg]);
        setDraft("");
      }
    } finally {
      setSending(false);
    }
  }

  const unreadFromStartup = messages?.filter((m) => m.sender === "startup").length ?? 0;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold">{ko ? "포트폴리오 메시지" : "Company messages"}</span>
          {messages !== null && messages.length > 0 && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
              {messages.length}
            </span>
          )}
          {unreadFromStartup > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
              {ko ? `회사 ${unreadFromStartup}건` : `${unreadFromStartup} from co.`}
            </span>
          )}
          {messages === null && (
            <span className="text-xs text-neutral-400">{ko ? "클릭해서 열기" : "click to open"}</span>
          )}
        </div>
        <span className="text-neutral-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-neutral-100 dark:border-neutral-800">
          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto p-4">
            {messages === null && (
              <p className="py-4 text-center text-sm text-neutral-400">{ko ? "불러오는 중…" : "Loading…"}</p>
            )}
            {messages?.length === 0 && (
              <p className="py-4 text-center text-sm text-neutral-400">
                {ko ? "메시지 없음" : "No messages yet"}
              </p>
            )}
            {messages?.map((m) => {
              const isStartup = m.sender === "startup";
              return (
                <div key={m.id} className={`flex ${isStartup ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    isStartup
                      ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white"
                      : "bg-indigo-600 text-white"
                  }`}>
                    {isStartup && (
                      <p className="mb-0.5 text-[10px] font-medium text-neutral-500 dark:text-neutral-400">{m.senderName}</p>
                    )}
                    <p>{m.text}</p>
                    <p className={`mt-0.5 text-[10px] ${isStartup ? "text-neutral-400" : "text-indigo-200"}`}>
                      {new Date(m.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 border-t border-neutral-100 p-3 dark:border-neutral-800">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder={ko ? "메시지 입력…" : "Reply to company…"}
              className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950"
            />
            <button
              type="button"
              disabled={sending || !draft.trim()}
              onClick={send}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {sending ? "…" : ko ? "전송" : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
