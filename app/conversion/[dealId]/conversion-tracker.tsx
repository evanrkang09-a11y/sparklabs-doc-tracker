"use client";

import { useMemo, useRef, useState } from "react";
import type { Deal } from "@/lib/deals";
import {
  CONVERSION_CUSTODIAN_DOCS,
  CONVERSION_FUND_NAME,
  CONVERSION_INTERNAL_DOCS,
  CONVERSION_POST_DOCS,
  CONVERSION_PRE_DOCS,
  CONVERSION_STEPS,
  conversionDeadlines,
  estimateConversion,
  type CalcMethod,
  type ConversionDoc,
} from "@/lib/conversion";
import type { ConversionRecord } from "@/lib/conversion-store";
import { describe } from "@/lib/errors";
import { useLang } from "@/app/lang-provider";
import StageReviewPanel from "@/app/stage-review-panel";

/**
 * SAFE → equity conversion tracker (#7). Whole-record autosave, like the
 * execution tracker. Applies only to deals where SparkLabs holds a SAFE that a
 * follow-on round converts into shares.
 */
export default function ConversionTracker({
  deal,
  initial,
}: {
  deal: Deal;
  initial: ConversionRecord;
}) {
  const { lang, pick } = useLang();
  const ko = lang === "ko";

  const [record, setRecord] = useState<ConversionRecord>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleSave(next: ConversionRecord) {
    if (timer.current) clearTimeout(timer.current);
    setStatus("saving");
    timer.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/deals/${deal.id}/conversion`, {
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

  function update(patch: Partial<ConversionRecord>) {
    setRecord((current) => {
      const next = { ...current, ...patch };
      scheduleSave(next);
      return next;
    });
  }

  const [aiCalcBusy, setAiCalcBusy] = useState(false);
  async function aiFillCalc() {
    setAiCalcBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/deals/${deal.id}/conversion/ai-calc`, {
        method: "POST",
      });
      const parsed = await response.json().catch(() => null);
      if (!response.ok) throw new Error(parsed?.error ?? `${response.status}`);
      update({
        calc: {
          ...record.calc,
          method: parsed.method === "cap" || parsed.method === "discount" ? parsed.method : record.calc.method,
          amount: parsed.amount || record.calc.amount,
          roundPrice: parsed.roundPrice || record.calc.roundPrice,
          discountPct: parsed.discountPct || record.calc.discountPct,
          cap: parsed.cap || record.calc.cap,
          preShares: parsed.preShares || record.calc.preShares,
        },
      });
    } catch (problem) {
      setError(describe(problem));
    } finally {
      setAiCalcBusy(false);
    }
  }

  const stepsDone = CONVERSION_STEPS.filter((s) => record.stepChecks[s.id]).length;
  const preDone = CONVERSION_PRE_DOCS.filter((d) => record.preChecks[d.id]).length;
  const postDone = CONVERSION_POST_DOCS.filter((d) => record.postChecks[d.id]).length;

  function setStepComment(id: string, text: string) {
    const next = { ...record.stepComments };
    if (text) next[id] = text; else delete next[id];
    update({ stepComments: next });
  }
  function setPreComment(id: string, text: string) {
    const next = { ...record.preComments };
    if (text) next[id] = text; else delete next[id];
    update({ preComments: next });
  }
  function setPostComment(id: string, text: string) {
    const next = { ...record.postComments };
    if (text) next[id] = text; else delete next[id];
    update({ postComments: next });
  }

  const regDeadlines = useMemo(
    () => conversionDeadlines(record.fractionalPaymentDate),
    [record.fractionalPaymentDate],
  );
  const docDeadlines = useMemo(
    () => conversionDeadlines(record.signingDate),
    [record.signingDate],
  );

  // The conversion agreement must be signed before the follow-on payment.
  const signWarning = useMemo(() => {
    if (!record.signingDate || !record.leadPaymentDate) return false;
    const s = new Date(record.signingDate);
    const p = new Date(record.leadPaymentDate);
    if (Number.isNaN(s.getTime()) || Number.isNaN(p.getTime())) return false;
    return s.getTime() > p.getTime();
  }, [record.signingDate, record.leadPaymentDate]);

  const estimate = useMemo(() => estimateConversion(record.calc), [record.calc]);

  return (
    <div className="w-full px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {pick(deal.companyKo, deal.companyEn)} · {ko ? "SAFE 전환" : "SAFE Conversion"}
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            {ko
              ? "후속 라운드로 SAFE 지분이 주식으로 전환될 때의 절차·서류"
              : "Process and documents for when a follow-on round converts a SAFE into equity"}
          </p>
        </div>
        <SaveStatus status={status} ko={ko} />
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <p className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-[11px] text-indigo-900 shadow-sm dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
        {ko
          ? "이 탭은 스파크랩이 보유한 SAFE가 후속(priced) 라운드로 전환될 때만 사용합니다. 전환 등기 시 주주명은 펀드명으로 기재됩니다: "
          : "Use this tab only when a SparkLabs SAFE converts during a priced follow-on round. Converted shares register under the fund name: "}
        <span className="font-semibold">{CONVERSION_FUND_NAME}</span>
      </p>

      {/* Key dates */}
      <section className="mb-5 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-3 text-sm font-semibold">{ko ? "주요 일자" : "Key dates"}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <DateField
            label={ko ? "후속 라운드 납입일" : "Follow-on payment date"}
            value={record.leadPaymentDate}
            onChange={(v) => update({ leadPaymentDate: v })}
          />
          <DateField
            label={ko ? "전환계약 서명일" : "Conversion signing date"}
            value={record.signingDate}
            onChange={(v) => update({ signingDate: v })}
          />
          <DateField
            label={ko ? "단수주 납입일" : "Fractional-share payment date"}
            value={record.fractionalPaymentDate}
            onChange={(v) => update({ fractionalPaymentDate: v })}
          />
        </div>

        {signWarning && (
          <p className="mt-3 rounded bg-amber-100 px-2 py-1.5 text-[11px] text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
            {ko
              ? "⚠ SAFE 전환계약은 후속 투자 납입 완료 전에 서명되어야 합니다."
              : "⚠ The conversion agreement must be signed before the follow-on payment completes."}
          </p>
        )}

        <label className="mt-3 flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
          <input
            type="checkbox"
            checked={record.refundReceived}
            onChange={(e) => update({ refundReceived: e.target.checked })}
            className="h-4 w-4 rounded border-neutral-300"
          />
          {ko
            ? "반환금 수령 완료 (후속 납입일 당일/이전)"
            : "Refund amount received (on/before the follow-on payment date)"}
        </label>
      </section>

      {/* Deadlines */}
      {(regDeadlines || docDeadlines) && (
        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          {regDeadlines && (
            <DeadlineCard
              title={ko ? "등기 기한" : "Registration deadline"}
              subtitle={ko ? "단수주 납입일 기준" : "from fractional-share payment"}
              d={regDeadlines}
              ko={ko}
            />
          )}
          {docDeadlines && (
            <DeadlineCard
              title={ko ? "서류 회신 기한" : "Document return deadline"}
              subtitle={ko ? "계약 서명일 기준" : "from signing date"}
              d={docDeadlines}
              ko={ko}
            />
          )}
        </div>
      )}

      {/* AI stage review */}
      <StageReviewPanel dealId={deal.id} stage="conversion" />

      {/* Process steps */}
      <section className="mb-5 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">{ko ? "진행 절차" : "Process"}</h2>
          <span className="text-xs text-neutral-400">
            {stepsDone}/{CONVERSION_STEPS.length}
          </span>
        </div>
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${stepsDone === CONVERSION_STEPS.length ? "bg-emerald-500" : "bg-indigo-500"}`}
            style={{ width: `${CONVERSION_STEPS.length > 0 ? (stepsDone / CONVERSION_STEPS.length) * 100 : 0}%` }}
          />
        </div>
        <ul className="space-y-1.5">
          {CONVERSION_STEPS.map((step, index) => {
            const checked = record.stepChecks[step.id] === true;
            return (
              <li key={step.id} className={`rounded-lg border transition-colors ${checked ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20" : "border-neutral-200 dark:border-neutral-800"}`}>
                <button
                  type="button"
                  onClick={() =>
                    update({
                      stepChecks: { ...record.stepChecks, [step.id]: !checked },
                    })
                  }
                  className="flex w-full items-start gap-3 px-3 py-2 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/60"
                >
                  <span
                    aria-hidden
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                      checked ? "bg-emerald-500" : "bg-neutral-400 dark:bg-neutral-600"
                    }`}
                  >
                    {checked ? "✓" : String(index + 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-medium ${checked ? "text-neutral-400 line-through dark:text-neutral-500" : ""}`}>
                      {pick(step.titleKo, step.titleEn)}
                    </span>
                    {(step.noteKo || step.noteEn) && (
                      <span className="mt-0.5 block text-[11px] text-neutral-500">
                        {pick(step.noteKo ?? "", step.noteEn ?? "")}
                      </span>
                    )}
                  </span>
                </button>
                <div className="px-3 pb-2 pl-11">
                  <textarea
                    value={record.stepComments[step.id] ?? ""}
                    onChange={(e) => setStepComment(step.id, e.target.value)}
                    placeholder={ko ? "메모 추가…" : "Add a note…"}
                    rows={1}
                    className="w-full resize-none rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
                    onInput={(e) => {
                      const t = e.currentTarget;
                      t.style.height = "auto";
                      t.style.height = `${t.scrollHeight}px`;
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Pre-conversion request docs */}
      <DocChecklist
        title={ko ? "사전 요청 서류" : "Documents to request (pre-conversion)"}
        subtitle={ko ? "전환 준비를 위해 기업에 요청" : "Request from the company to prepare the conversion"}
        docs={CONVERSION_PRE_DOCS}
        checks={record.preChecks}
        done={preDone}
        onToggle={(id) =>
          update({ preChecks: { ...record.preChecks, [id]: !record.preChecks[id] } })
        }
        comments={record.preComments}
        onComment={setPreComment}
        ko={ko}
        pick={pick}
      />

      {/* Share estimate calculator */}
      <CalculatorSection
        calc={record.calc}
        estimate={estimate}
        onChange={(patch) => update({ calc: { ...record.calc, ...patch } })}
        onAiFill={aiFillCalc}
        aiBusy={aiCalcBusy}
        ko={ko}
      />

      {/* Post-conversion request docs */}
      <DocChecklist
        title={ko ? "전환 후 요청 서류" : "Documents to request (post-conversion)"}
        subtitle={
          ko
            ? "신주 발행 후 기업에 요청 · 계약 서명일 기준 2주/20일/최대 30일 이내 회신"
            : "Request after new shares are issued · return within 2 weeks / 20 / max 30 days of signing"
        }
        docs={CONVERSION_POST_DOCS}
        checks={record.postChecks}
        done={postDone}
        onToggle={(id) =>
          update({ postChecks: { ...record.postChecks, [id]: !record.postChecks[id] } })
        }
        comments={record.postComments}
        onComment={setPostComment}
        ko={ko}
        pick={pick}
      />

      {/* Routing reference */}
      <section className="mb-5 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-1 text-sm font-semibold">{ko ? "서류 전달처" : "Where documents go"}</h2>
        <p className="mb-3 text-[11px] text-neutral-400">
          {ko
            ? "전환 후 수령한 서류를 아래와 같이 분배합니다."
            : "Split the collected post-conversion documents as follows."}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <RoutingList
            label={ko ? "수탁은행 (경영지원본부 경유)" : "Custodian bank (via Mgmt Support)"}
            docs={CONVERSION_CUSTODIAN_DOCS}
            tone="custodian"
            pick={pick}
          />
          <RoutingList
            label={ko ? "스파크랩 내부보관" : "SparkLabs internal files"}
            docs={CONVERSION_INTERNAL_DOCS}
            tone="internal"
            pick={pick}
          />
        </div>
      </section>

      {/* Email draft */}
      <EmailDraft
        company={pick(deal.companyKo, deal.companyEn)}
        dealId={deal.id}
        docs={CONVERSION_POST_DOCS}
        deadlines={docDeadlines}
        ko={ko}
        pick={pick}
      />
    </div>
  );
}

const inputClass =
  "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950";

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-neutral-500">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </div>
  );
}

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
      className={`text-xs ${status === "error" ? "text-red-600 dark:text-red-400" : "text-neutral-400"}`}
    >
      {text}
    </span>
  );
}

function DeadlineCard({
  title,
  subtitle,
  d,
  ko,
}: {
  title: string;
  subtitle: string;
  d: { ideal: Date; normal: Date; max: Date };
  ko: boolean;
}) {
  const now = Date.now();
  const dayMs = 1000 * 60 * 60 * 24;
  const daysToMax = Math.ceil((d.max.getTime() - now) / dayMs);
  const tone =
    daysToMax < 0
      ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
      : daysToMax <= 10
        ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
        : "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40";
  const numColor =
    daysToMax < 0
      ? "text-red-700 dark:text-red-300"
      : daysToMax <= 10
        ? "text-amber-700 dark:text-amber-300"
        : "text-emerald-700 dark:text-emerald-300";
  const textColor =
    daysToMax < 0
      ? "text-red-800 dark:text-red-300"
      : daysToMax <= 10
        ? "text-amber-900 dark:text-amber-200"
        : "text-emerald-900 dark:text-emerald-200";
  const fmt = (x: Date) => x.toISOString().slice(0, 10);

  return (
    <section className={`rounded-xl border px-4 py-3 shadow-sm ${tone}`}>
      <div className="flex items-center gap-3">
        <div className="text-center">
          <p className={`text-3xl font-bold tabular-nums leading-none ${numColor}`}>
            {Math.abs(daysToMax)}
          </p>
          <p className={`mt-0.5 text-[10px] font-medium ${textColor}`}>
            {daysToMax < 0 ? (ko ? "일 초과" : "over") : (ko ? "일 남음" : "days")}
          </p>
        </div>
        <div className="flex-1">
          <p className={`text-sm font-semibold ${textColor}`}>{title}</p>
          <p className={`text-[10px] opacity-70 ${textColor}`}>{subtitle}</p>
          <p className={`mt-1 text-[11px] ${textColor}`}>
            {ko ? "권장 " : "Ideal "}{fmt(d.ideal)} · {ko ? "최대 " : "Max "}{fmt(d.max)}
          </p>
        </div>
      </div>
    </section>
  );
}

function DocChecklist({
  title,
  subtitle,
  docs,
  checks,
  done,
  onToggle,
  comments,
  onComment,
  ko,
  pick,
}: {
  title: string;
  subtitle: string;
  docs: ConversionDoc[];
  checks: Record<string, boolean>;
  done: number;
  onToggle: (id: string) => void;
  comments?: Record<string, string>;
  onComment?: (id: string, text: string) => void;
  ko?: boolean;
  pick: (ko: string, en: string) => string;
}) {
  const total = docs.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && done === total;

  return (
    <section className="mb-5 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className={`text-xs font-medium tabular-nums ${complete ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-400"}`}>
          {done}/{total} · {pct}%
        </span>
      </div>
      <p className="mb-2 text-[11px] text-neutral-400">{subtitle}</p>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${complete ? "bg-emerald-500" : "bg-indigo-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="space-y-1.5">
        {docs.map((doc, index) => {
          const checked = checks[doc.id] === true;
          const copies = pick(doc.copiesKo ?? "", doc.copiesEn ?? "");
          const note = pick(doc.noteKo ?? "", doc.noteEn ?? "");
          return (
            <li
              key={doc.id}
              className={`rounded-lg border transition-colors ${
                checked
                  ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                  : "border-neutral-200 dark:border-neutral-800"
              }`}
            >
              <button
                type="button"
                onClick={() => onToggle(doc.id)}
                className="flex w-full items-start gap-3 px-3 py-2 text-left"
              >
                <span
                  aria-hidden
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                    checked ? "bg-emerald-500" : "bg-neutral-400 dark:bg-neutral-600"
                  }`}
                >
                  {checked ? "✓" : String(index + 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-sm ${checked ? "text-neutral-400 line-through dark:text-neutral-500" : ""}`}>
                      {pick(doc.nameKo, doc.nameEn)}
                    </span>
                    {copies && (
                      <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                        {copies}
                      </span>
                    )}
                  </span>
                  {note && (
                    <span className="mt-0.5 block text-[10px] text-neutral-400">{note}</span>
                  )}
                </span>
              </button>
              {onComment && (
                <div className="px-3 pb-2 pl-11">
                  <textarea
                    value={comments?.[doc.id] ?? ""}
                    onChange={(e) => onComment(doc.id, e.target.value)}
                    placeholder={ko ? "메모 추가…" : "Add a note…"}
                    rows={1}
                    className="w-full resize-none rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
                    onInput={(e) => {
                      const t = e.currentTarget;
                      t.style.height = "auto";
                      t.style.height = `${t.scrollHeight}px`;
                    }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RoutingList({
  label,
  docs,
  tone,
  pick,
}: {
  label: string;
  docs: ConversionDoc[];
  tone: "custodian" | "internal";
  pick: (ko: string, en: string) => string;
}) {
  return (
    <div>
      <p
        className={`mb-2 inline-block rounded px-2 py-0.5 text-[11px] font-medium ${
          tone === "custodian"
            ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
            : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
        }`}
      >
        {label}
      </p>
      <ul className="space-y-1 text-xs text-neutral-600 dark:text-neutral-300">
        {docs.map((doc) => (
          <li key={doc.id} className="flex items-baseline justify-between gap-2">
            <span>{pick(doc.nameKo, doc.nameEn)}</span>
            <span className="shrink-0 text-[10px] text-neutral-400">
              {pick(doc.copiesKo ?? "", doc.copiesEn ?? "")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CalculatorSection({
  calc,
  estimate,
  onChange,
  onAiFill,
  aiBusy,
  ko,
}: {
  calc: ConversionRecord["calc"];
  estimate: { conversionPrice: number | null; shares: number | null };
  onChange: (patch: Partial<ConversionRecord["calc"]>) => void;
  onAiFill: () => void;
  aiBusy: boolean;
  ko: boolean;
}) {
  const field =
    "mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950";
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <section className="mb-5 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          {ko ? "전환 주식수 추정" : "Share estimate"}
        </h2>
        <button
          type="button"
          onClick={onAiFill}
          disabled={aiBusy}
          title={ko ? "업로드된 SAFE·계약서에서 추출" : "Extract from uploaded SAFE / agreements"}
          className="shrink-0 rounded-lg border border-indigo-300 px-2.5 py-1 text-[11px] font-medium text-indigo-700 transition-colors hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
        >
          {aiBusy ? (ko ? "추출 중…" : "Reading…") : ko ? "AI로 채우기" : "Fill with AI"}
        </button>
      </div>
      <p className="mb-3 text-[11px] text-neutral-400">
        {ko
          ? "대략적인 참고용 계산입니다. 실제 전환 주식수는 정관·옵션·계약 조건에 따라 달라집니다. 'AI로 채우기'는 업로드된 서류에서 값을 추출합니다."
          : "A rough aid only. The real figure depends on the company's articles, options and contract terms. 'Fill with AI' extracts inputs from uploaded documents."}
      </p>

      <div className="mb-3 flex gap-2">
        {(["discount", "cap"] as CalcMethod[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange({ method: m })}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              calc.method === m
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            }`}
          >
            {m === "discount" ? (ko ? "할인율" : "Discount") : ko ? "밸류에이션 캡" : "Valuation cap"}
          </button>
        ))}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="block text-[11px] font-medium text-neutral-500">
          {ko ? "SAFE 투자금액" : "SAFE investment amount"}
          <input value={calc.amount} onChange={(e) => onChange({ amount: e.target.value })} className={field} />
        </label>
        <label className="block text-[11px] font-medium text-neutral-500">
          {ko ? "라운드 1주당 가격" : "Round price per share"}
          <input value={calc.roundPrice} onChange={(e) => onChange({ roundPrice: e.target.value })} className={field} />
        </label>

        {calc.method === "discount" ? (
          <label className="block text-[11px] font-medium text-neutral-500">
            {ko ? "할인율 (%)" : "Discount rate (%)"}
            <input value={calc.discountPct} onChange={(e) => onChange({ discountPct: e.target.value })} className={field} />
          </label>
        ) : (
          <>
            <label className="block text-[11px] font-medium text-neutral-500">
              {ko ? "밸류에이션 캡" : "Valuation cap"}
              <input value={calc.cap} onChange={(e) => onChange({ cap: e.target.value })} className={field} />
            </label>
            <label className="block text-[11px] font-medium text-neutral-500">
              {ko ? "라운드 직전 발행주식수" : "Pre-round fully-diluted shares"}
              <input value={calc.preShares} onChange={(e) => onChange({ preShares: e.target.value })} className={field} />
            </label>
          </>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-neutral-50 px-3 py-2.5 dark:bg-neutral-950">
          <p className="text-[11px] text-neutral-400">{ko ? "전환가" : "Conversion price"}</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-neutral-800 dark:text-neutral-100">
            {estimate.conversionPrice != null ? fmt(estimate.conversionPrice) : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-emerald-50 px-3 py-2.5 dark:bg-emerald-950/30">
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">{ko ? "예상 주식수" : "Estimated shares"}</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
            {estimate.shares != null ? fmt(estimate.shares) : "—"}
          </p>
        </div>
      </div>
    </section>
  );
}

function EmailDraft({
  company,
  dealId,
  docs,
  deadlines,
  ko,
  pick,
}: {
  company: string;
  dealId: string;
  docs: ConversionDoc[];
  deadlines: { ideal: Date; normal: Date; max: Date } | null;
  ko: boolean;
  pick: (ko: string, en: string) => string;
}) {
  const [copied, setCopied] = useState(false);
  const [to, setTo] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestHint, setSuggestHint] = useState<string | null>(null);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const list = docs
    .map((d) => {
      const copies = pick(d.copiesKo ?? "", d.copiesEn ?? "");
      return `- ${pick(d.nameKo, d.nameEn)}${copies ? ` [${copies}]` : ""}`;
    })
    .join("\n");

  const draft = ko
    ? `제목: [${company}] SAFE 전환 후 제출 서류 안내

${company} 대표님, 안녕하세요.

SAFE 지분 전환 및 신주 발행 관련하여 아래 서류를 준비해 회신 부탁드립니다.

[제출 기한]
- 권장: ${deadlines ? fmt(deadlines.ideal) : "계약 서명일 +2주"} (2주)
- 보통: ${deadlines ? fmt(deadlines.normal) : "+20일"} / 최대: ${deadlines ? fmt(deadlines.max) : "+30일"}

[제출 서류]
${list}

※ 전환 후 주주명부의 주주명은 펀드명으로 기재 부탁드립니다.

감사합니다.`
    : `Subject: [${company}] Documents required after SAFE conversion

Dear ${company} team,

Following the SAFE conversion and new-share issuance, please prepare and return the documents below.

[Deadline]
- Ideal: ${deadlines ? fmt(deadlines.ideal) : "signing + 2 weeks"} (2 weeks)
- Normal: ${deadlines ? fmt(deadlines.normal) : "+20 days"} / Max: ${deadlines ? fmt(deadlines.max) : "+30 days"}

[Documents]
${list}

* On the post-conversion shareholder list, the shareholder name should be the fund name.

Thank you.`;

  const subject = ko
    ? `[${company}] SAFE 전환 후 제출 서류 안내`
    : `[${company}] Documents required after SAFE conversion`;

  function sendEmail() {
    navigator.clipboard.writeText(draft).catch(() => {});
    const params = new URLSearchParams({
      view: "cm",
      fs: "1",
      to: to,
      su: subject,
    });
    window.open(`https://mail.google.com/mail/?${params.toString()}`, "_blank");
    setCopied(true);
    setTimeout(() => setCopied(false), 4000);
  }

  async function suggestEmail() {
    setSuggesting(true);
    setSuggestHint(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/suggest-email`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (data?.email) {
        setTo(data.email);
        setSuggestHint(ko ? "✓ 이메일 자동입력 완료" : "✓ Email filled in");
      } else {
        setSuggestHint(ko ? "업로드된 서류에서 이메일을 찾지 못했습니다." : "No email found in uploaded documents.");
      }
    } catch {
      setSuggestHint(ko ? "오류가 발생했습니다." : "Something went wrong.");
    } finally {
      setSuggesting(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked - text is selectable regardless.
    }
  }

  return (
    <section className="mb-5 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-1 text-sm font-semibold">{ko ? "이메일 초안" : "Email draft"}</h2>
      <p className="mb-3 text-[11px] text-neutral-400">
        {ko
          ? "전환 후 서류 요청 이메일. 받는 사람을 입력하고 바로 보낼 수 있습니다."
          : "Post-conversion document request. Enter a recipient and send directly."}
      </p>
      <div className="mb-2">
        <label className="block text-[11px] font-medium text-neutral-500">
          {ko ? "받는 사람" : "To"}
        </label>
        <div className="mt-1 flex gap-2">
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder={ko ? "수신자 이메일 주소" : "recipient@company.com"}
            className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950"
          />
          <button
            type="button"
            onClick={suggestEmail}
            disabled={suggesting}
            className="shrink-0 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {suggesting ? (ko ? "검색 중…" : "Searching…") : (ko ? "AI 자동완성" : "AI Suggest")}
          </button>
        </div>
        {suggestHint && (
          <p className={`mt-1 text-[11px] ${suggestHint.startsWith("✓") ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-400"}`}>
            {suggestHint}
          </p>
        )}
      </div>
      <textarea
        readOnly
        value={draft}
        rows={14}
        className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-700 focus:outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={sendEmail}
          disabled={!to.trim()}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
        >
          {copied
            ? (ko ? "메일 열림 — 본문 붙여넣기 ✓" : "Mail opened — paste body ✓")
            : (ko ? "이메일 보내기" : "Send email")}
        </button>
        <button
          type="button"
          onClick={copy}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          {copied ? (ko ? "복사됨 ✓" : "Copied ✓") : ko ? "복사" : "Copy"}
        </button>
      </div>
    </section>
  );
}
