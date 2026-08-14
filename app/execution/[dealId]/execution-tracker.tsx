"use client";

import { useMemo, useRef, useState } from "react";
import type { Deal } from "@/lib/deals";
import {
  FUND_TYPES,
  INVESTMENT_STRUCTURES,
  fundTypeAllowed,
  operatingInstructionDocs,
  postPaymentDeadlines,
  postPaymentDocs,
  type FundType,
  type InvestmentStructure,
} from "@/lib/execution";
import type { ExecutionRecord, NumberSet } from "@/lib/execution-store";
import { describe } from "@/lib/errors";
import { useLang } from "@/app/lang-provider";

/**
 * 투자 집행: the two stages after the contract is signed — instructing the
 * bank to pay (운용지시) and collecting the documents due back afterwards
 * (투자납입 후), against the custodian-bank deadline.
 *
 * The whole record saves on a short debounce, so ticking a box or changing a
 * date just persists — there is no save button to forget.
 */
export default function ExecutionTracker({
  deal,
  initial,
  agreementNumbers,
}: {
  deal: Deal;
  initial: ExecutionRecord;
  /** The three figures the signed contract fixes, to cross-check against. */
  agreementNumbers: NumberSet;
}) {
  const { lang, pick } = useLang();
  const ko = lang === "ko";

  const [record, setRecord] = useState<ExecutionRecord>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Overseas deals can only run on a private fund - never 모태.
  const effectiveFundType: FundType | null =
    deal.market === "overseas" ? "private" : record.fundType;

  function scheduleSave(next: ExecutionRecord) {
    if (timer.current) clearTimeout(timer.current);
    setStatus("saving");
    timer.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/deals/${deal.id}/execution`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        const parsed = await response.json().catch(() => null);
        if (!response.ok) throw new Error(parsed?.error ?? `${response.status}`);
        setStatus("saved");
        setError(null);
      } catch (problem) {
        setStatus("error");
        setError(describe(problem));
      }
    }, 700);
  }

  function update(patch: Partial<ExecutionRecord>) {
    setRecord((current) => {
      const next = { ...current, ...patch };
      scheduleSave(next);
      return next;
    });
  }

  const toggleOi = (id: string) =>
    update({ oiChecks: { ...record.oiChecks, [id]: !record.oiChecks[id] } });
  const togglePost = (id: string) =>
    update({ postChecks: { ...record.postChecks, [id]: !record.postChecks[id] } });

  const oiDocs = effectiveFundType
    ? operatingInstructionDocs(deal.market, effectiveFundType)
    : [];
  const postDocs = record.structure
    ? postPaymentDocs(deal.market, record.structure)
    : [];

  const oiDone = oiDocs.filter((d) => record.oiChecks[d.id]).length;
  const postDone = postDocs.filter((d) => record.postChecks[d.id]).length;

  const deadlines = useMemo(
    () => postPaymentDeadlines(record.paymentDate),
    [record.paymentDate],
  );

  // 운용지시일 and 납입일 must differ by at least one day.
  const dateWarning = useMemo(() => {
    if (!record.instructionDate || !record.paymentDate) return false;
    const a = new Date(record.instructionDate);
    const b = new Date(record.paymentDate);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
    return b.getTime() <= a.getTime();
  }, [record.instructionDate, record.paymentDate]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {pick(deal.companyKo, deal.companyEn)} · {ko ? "투자 집행" : "Execution"}
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            {ko
              ? "계약 체결 후 — 운용지시(투자금 납입)와 투자납입 후 서류 절차"
              : "After signing — operating instruction (payout) and post-payment documents"}
          </p>
        </div>
        <SaveStatus status={status} ko={ko} />
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {/* Configuration */}
      <section className="mb-5 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="mb-3 text-sm font-semibold">{ko ? "기본 설정" : "Setup"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-[11px] font-medium text-neutral-500">
              {ko ? "펀드 종류" : "Fund type"}
            </label>
            <select
              value={effectiveFundType ?? ""}
              disabled={deal.market === "overseas"}
              onChange={(e) => update({ fundType: (e.target.value || null) as FundType | null })}
              className={selectClass}
            >
              <option value="">{ko ? "선택…" : "Choose…"}</option>
              {FUND_TYPES.filter((f) => fundTypeAllowed(deal.market, f.value)).map((f) => (
                <option key={f.value} value={f.value}>
                  {ko ? f.ko : f.en}
                </option>
              ))}
            </select>
            {deal.market === "overseas" && (
              <p className="mt-0.5 text-[10px] text-neutral-400">
                {ko
                  ? "해외 기업 투자는 민간펀드로만 가능합니다."
                  : "Overseas investments can only use a private fund."}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-medium text-neutral-500">
              {ko ? "투자 구조" : "Investment structure"}
            </label>
            <select
              value={record.structure ?? ""}
              onChange={(e) =>
                update({ structure: (e.target.value || null) as InvestmentStructure | null })
              }
              className={selectClass}
            >
              <option value="">{ko ? "선택…" : "Choose…"}</option>
              {INVESTMENT_STRUCTURES.map((s) => (
                <option key={s.value} value={s.value}>
                  {ko ? s.ko : s.en}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-neutral-500">
              {ko ? "운용지시일" : "Instruction date"}
            </label>
            <input
              type="text"
              value={record.instructionDate}
              placeholder="YYYY-MM-DD"
              onChange={(e) => update({ instructionDate: e.target.value })}
              className={selectClass}
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-neutral-500">
              {ko ? "납입일" : "Payment date"}
            </label>
            <input
              type="text"
              value={record.paymentDate}
              placeholder="YYYY-MM-DD"
              onChange={(e) => update({ paymentDate: e.target.value })}
              className={selectClass}
            />
          </div>
        </div>

        {dateWarning && (
          <p className="mt-3 rounded bg-amber-100 px-2 py-1.5 text-[11px] text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
            {ko
              ? "⚠ 운용지시일과 납입일은 최소 하루 이상 차이가 나야 합니다 (은행 영업시간 고려)."
              : "⚠ The instruction date and payment date must differ by at least one day (bank hours)."}
          </p>
        )}

        <p className="mt-3 text-[11px] text-neutral-400">
          {ko
            ? "💡 민간펀드는 납입일 오전에 바로 납입됩니다. 모태펀드는 모태 승인 후 오후 3시 즈음 납입됩니다."
            : "💡 Private funds pay out on the morning of the payment date. Fund-of-funds (모태) pay around 3pm, after 모태 approval."}
        </p>
      </section>

      {/* Deadline tracker */}
      {deadlines && (
        <DeadlineBanner target={deadlines.target} hard={deadlines.hard} ko={ko} />
      )}

      {/* 운용지시 서류 */}
      <ChecklistSection
        title={ko ? "운용지시 서류" : "Operating instruction documents"}
        subtitle={
          ko
            ? "투자금 납입(운용지시)을 위해 경영지원본부에 제출하는 서류"
            : "Documents submitted to management support HQ to instruct payout"
        }
        done={oiDone}
        total={oiDocs.length}
        empty={
          !effectiveFundType
            ? ko
              ? "펀드 종류를 먼저 선택하세요."
              : "Choose a fund type first."
            : null
        }
        docs={oiDocs}
        checks={record.oiChecks}
        onToggle={toggleOi}
        ko={ko}
        pick={pick}
      />

      {/* Consistency check */}
      <ConsistencySection
        agreement={agreementNumbers}
        consistency={record.consistency}
        onChange={(which, field, value) =>
          update({
            consistency: {
              ...record.consistency,
              [which]: { ...record.consistency[which], [field]: value },
            },
          })
        }
        ko={ko}
      />

      {/* 투자납입 후 서류 */}
      <ChecklistSection
        title={ko ? "투자납입 후 서류" : "Post-payment documents"}
        subtitle={
          ko
            ? "납입 후 투자기업으로부터 회신받아 수탁은행에 전달하는 서류"
            : "Documents collected from the company after payment and passed to the custodian bank"
        }
        done={postDone}
        total={postDocs.length}
        empty={
          !record.structure
            ? ko
              ? "투자 구조(신주발행/SAFE)를 먼저 선택하세요."
              : "Choose an investment structure first."
            : null
        }
        docs={postDocs}
        checks={record.postChecks}
        onToggle={togglePost}
        ko={ko}
        pick={pick}
      />

      {deal.market === "overseas" && (
        <p className="mb-5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-[11px] text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
          {ko
            ? "💡 해외 투자: 납입 후 수탁은행이 보내주는 증권취득신고서와 외화송금영수증·전신문을 한국은행에 이메일로 제출해야 합니다."
            : "💡 Overseas: after payment, email the securities acquisition report and the FX remittance receipt/wire message the custodian bank returns to the Bank of Korea."}
        </p>
      )}
    </div>
  );
}

const selectClass =
  "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm focus:border-neutral-500 focus:outline-none disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950";

function SaveStatus({
  status,
  ko,
}: {
  status: "idle" | "saving" | "saved" | "error";
  ko: boolean;
}) {
  const text = {
    idle: "",
    saving: ko ? "저장 중…" : "Saving…",
    saved: ko ? "저장됨" : "Saved",
    error: ko ? "저장 실패" : "Save failed",
  }[status];

  if (!text) return null;
  return (
    <span
      className={`text-xs ${
        status === "error" ? "text-red-600 dark:text-red-400" : "text-neutral-400"
      }`}
    >
      {text}
    </span>
  );
}

function DeadlineBanner({
  target,
  hard,
  ko,
}: {
  target: Date;
  hard: Date;
  ko: boolean;
}) {
  const now = new Date();
  const dayMs = 1000 * 60 * 60 * 24;
  const daysToHard = Math.ceil((hard.getTime() - now.getTime()) / dayMs);

  const tone =
    daysToHard < 0
      ? "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
      : daysToHard <= 10
        ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200";

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <section className={`mb-5 rounded-xl border px-4 py-3 ${tone}`}>
      <p className="text-sm font-semibold">
        {ko ? "서류 회신 기한" : "Document return deadline"}
      </p>
      <p className="mt-1 text-xs">
        {ko ? "권장 " : "Target "}
        <span className="font-medium">{fmt(target)}</span>
        {ko ? " (20일)" : " (20 days)"} · {ko ? "최종 " : "Hard "}
        <span className="font-medium">{fmt(hard)}</span>
        {ko ? " (30일)" : " (30 days)"}
      </p>
      <p className="mt-1 text-xs">
        {daysToHard < 0
          ? ko
            ? `최종 기한이 ${Math.abs(daysToHard)}일 지났습니다.`
            : `${Math.abs(daysToHard)} days past the hard deadline.`
          : ko
            ? `최종 기한까지 ${daysToHard}일 남았습니다.`
            : `${daysToHard} days until the hard deadline.`}
        {" "}
        {ko
          ? "원본이 30일 내 수탁은행에 도착해야 하므로 20일 내 취합을 권장합니다."
          : "Originals must reach the custodian bank within 30 days, so collect within 20."}
      </p>
    </section>
  );
}

function ChecklistSection({
  title,
  subtitle,
  done,
  total,
  empty,
  docs,
  checks,
  onToggle,
  ko,
  pick,
}: {
  title: string;
  subtitle: string;
  done: number;
  total: number;
  empty: string | null;
  docs: { id: string; nameKo: string; nameEn: string; noteKo?: string; noteEn?: string }[];
  checks: Record<string, boolean>;
  onToggle: (id: string) => void;
  ko: boolean;
  pick: (ko: string, en: string) => string;
}) {
  return (
    <section className="mb-5 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {total > 0 && (
          <span className="text-xs text-neutral-400">
            {done}/{total}
          </span>
        )}
      </div>
      <p className="mb-3 text-[11px] text-neutral-400">{subtitle}</p>

      {empty ? (
        <p className="rounded-lg border border-dashed border-neutral-300 px-4 py-6 text-center text-xs text-neutral-400 dark:border-neutral-700">
          {empty}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {docs.map((doc) => {
            const checked = checks[doc.id] === true;
            const note = pick(doc.noteKo ?? "", doc.noteEn ?? "");
            return (
              <li key={doc.id}>
                <button
                  type="button"
                  onClick={() => onToggle(doc.id)}
                  className="flex w-full items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2 text-left transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                >
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                      checked ? "bg-emerald-500" : "bg-neutral-300 dark:bg-neutral-600"
                    }`}
                  >
                    {checked ? "✓" : ""}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm">{pick(doc.nameKo, doc.nameEn)}</span>
                    {note && (
                      <span className="block text-[10px] text-neutral-400">{note}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ConsistencySection({
  agreement,
  consistency,
  onChange,
  ko,
}: {
  agreement: NumberSet;
  consistency: { instruction: NumberSet; minutes: NumberSet };
  onChange: (
    which: "instruction" | "minutes",
    field: keyof NumberSet,
    value: string,
  ) => void;
  ko: boolean;
}) {
  const rows: { field: keyof NumberSet; ko: string; en: string }[] = [
    { field: "shares", ko: "신주 수", en: "New shares" },
    { field: "price", ko: "발행가액", en: "Issue price" },
    { field: "amount", ko: "총 인수대금", en: "Total amount" },
  ];

  // A row matches when both the entered figures equal the contract's, ignoring
  // commas and spaces. Blank entries are treated as "not yet checked".
  const norm = (s: string) => s.replace(/[,\s₩]/g, "").trim();
  const rowState = (field: keyof NumberSet): "match" | "mismatch" | "blank" => {
    const base = norm(agreement[field]);
    const oi = norm(consistency.instruction[field]);
    const mn = norm(consistency.minutes[field]);
    if (!oi && !mn) return "blank";
    if (!base) return "blank";
    return oi === base && mn === base ? "match" : "mismatch";
  };

  const input =
    "w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950";

  return (
    <section className="mb-5 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="mb-1 text-sm font-semibold">
        {ko ? "숫자 일치 확인" : "Number consistency check"}
      </h2>
      <p className="mb-3 text-[11px] text-neutral-400">
        {ko
          ? "운용지시서 · 투자계약서 · 투자심의위원회 의사록의 숫자가 일치하는지 확인합니다. 계약서 값은 자동으로 불러옵니다."
          : "Confirm the figures on the operating instruction, the agreement, and the committee minutes all match. The agreement values are pulled in automatically."}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-xs">
          <thead>
            <tr className="text-neutral-400">
              <th className="py-1 pr-2 font-medium"></th>
              <th className="py-1 pr-2 font-medium">{ko ? "계약서" : "Agreement"}</th>
              <th className="py-1 pr-2 font-medium">{ko ? "운용지시서" : "Instruction"}</th>
              <th className="py-1 pr-2 font-medium">{ko ? "의사록" : "Minutes"}</th>
              <th className="py-1 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const state = rowState(row.field);
              return (
                <tr key={row.field} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="py-1.5 pr-2 font-medium text-neutral-500">
                    {ko ? row.ko : row.en}
                  </td>
                  <td className="py-1.5 pr-2 text-neutral-500">
                    {agreement[row.field] || "—"}
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      value={consistency.instruction[row.field]}
                      onChange={(e) => onChange("instruction", row.field, e.target.value)}
                      className={input}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      value={consistency.minutes[row.field]}
                      onChange={(e) => onChange("minutes", row.field, e.target.value)}
                      className={input}
                    />
                  </td>
                  <td className="py-1.5 text-center">
                    {state === "match" && <span className="text-emerald-600">✓</span>}
                    {state === "mismatch" && <span className="text-red-600">✕</span>}
                    {state === "blank" && <span className="text-neutral-300">·</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
