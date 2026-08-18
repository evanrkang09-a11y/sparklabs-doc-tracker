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

  const stepsDone = CONVERSION_STEPS.filter((s) => record.stepChecks[s.id]).length;
  const preDone = CONVERSION_PRE_DOCS.filter((d) => record.preChecks[d.id]).length;
  const postDone = CONVERSION_POST_DOCS.filter((d) => record.postChecks[d.id]).length;

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
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
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

      {/* Process steps */}
      <section className="mb-5 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">{ko ? "진행 절차" : "Process"}</h2>
          <span className="text-xs text-neutral-400">
            {stepsDone}/{CONVERSION_STEPS.length}
          </span>
        </div>
        <ul className="space-y-1.5">
          {CONVERSION_STEPS.map((step) => {
            const checked = record.stepChecks[step.id] === true;
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() =>
                    update({
                      stepChecks: { ...record.stepChecks, [step.id]: !checked },
                    })
                  }
                  className="flex w-full items-start gap-3 rounded-lg border border-neutral-200 px-3 py-2 text-left transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
                >
                  <span
                    aria-hidden
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                      checked ? "bg-emerald-500" : "bg-neutral-300 dark:bg-neutral-600"
                    }`}
                  >
                    {checked ? "✓" : ""}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {pick(step.titleKo, step.titleEn)}
                    </span>
                    {(step.noteKo || step.noteEn) && (
                      <span className="mt-0.5 block text-[11px] text-neutral-500">
                        {pick(step.noteKo ?? "", step.noteEn ?? "")}
                      </span>
                    )}
                  </span>
                </button>
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
        pick={pick}
      />

      {/* Share estimate calculator */}
      <CalculatorSection
        calc={record.calc}
        estimate={estimate}
        onChange={(patch) => update({ calc: { ...record.calc, ...patch } })}
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
        type="text"
        value={value}
        placeholder="YYYY-MM-DD"
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
      ? "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
      : daysToMax <= 10
        ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200";
  const fmt = (x: Date) => x.toISOString().slice(0, 10);
  return (
    <section className={`rounded-xl border px-4 py-3 shadow-sm ${tone}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-[10px] opacity-70">{subtitle}</p>
      <p className="mt-1 text-xs">
        {ko ? "권장 " : "Ideal "}
        {fmt(d.ideal)} {ko ? "(2주)" : "(2wk)"} · {ko ? "보통 " : "Normal "}
        {fmt(d.normal)} · {ko ? "최대 " : "Max "}
        {fmt(d.max)}
      </p>
      <p className="mt-1 text-xs">
        {daysToMax < 0
          ? ko
            ? `최대 기한 ${Math.abs(daysToMax)}일 초과`
            : `${Math.abs(daysToMax)} days past max`
          : ko
            ? `최대 기한까지 ${daysToMax}일`
            : `${daysToMax} days to max`}
      </p>
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
  pick,
}: {
  title: string;
  subtitle: string;
  docs: ConversionDoc[];
  checks: Record<string, boolean>;
  done: number;
  onToggle: (id: string) => void;
  pick: (ko: string, en: string) => string;
}) {
  return (
    <section className="mb-5 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-neutral-400">
          {done}/{docs.length}
        </span>
      </div>
      <p className="mb-3 text-[11px] text-neutral-400">{subtitle}</p>
      <ul className="space-y-1.5">
        {docs.map((doc) => {
          const checked = checks[doc.id] === true;
          const copies = pick(doc.copiesKo ?? "", doc.copiesEn ?? "");
          const note = pick(doc.noteKo ?? "", doc.noteEn ?? "");
          return (
            <li key={doc.id}>
              <button
                type="button"
                onClick={() => onToggle(doc.id)}
                className="flex w-full items-start gap-3 rounded-lg border border-neutral-200 px-3 py-2 text-left transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
              >
                <span
                  aria-hidden
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                    checked ? "bg-emerald-500" : "bg-neutral-300 dark:bg-neutral-600"
                  }`}
                >
                  {checked ? "✓" : ""}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm">{pick(doc.nameKo, doc.nameEn)}</span>
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
  ko,
}: {
  calc: ConversionRecord["calc"];
  estimate: { conversionPrice: number | null; shares: number | null };
  onChange: (patch: Partial<ConversionRecord["calc"]>) => void;
  ko: boolean;
}) {
  const field =
    "mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950";
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <section className="mb-5 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-1 text-sm font-semibold">
        {ko ? "전환 주식수 추정" : "Share estimate"}
      </h2>
      <p className="mb-3 text-[11px] text-neutral-400">
        {ko
          ? "대략적인 참고용 계산입니다. 실제 전환 주식수는 정관·옵션·계약 조건에 따라 달라집니다."
          : "A rough aid only. The real figure depends on the company's articles, options and contract terms."}
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

      <div className="mt-3 flex flex-wrap gap-4 rounded-lg bg-neutral-50 px-3 py-2.5 text-sm dark:bg-neutral-950">
        <span>
          <span className="text-[11px] text-neutral-400">
            {ko ? "전환가 " : "Conversion price "}
          </span>
          <span className="font-semibold tabular-nums">
            {estimate.conversionPrice != null ? fmt(estimate.conversionPrice) : "—"}
          </span>
        </span>
        <span>
          <span className="text-[11px] text-neutral-400">
            {ko ? "예상 주식수 " : "Estimated shares "}
          </span>
          <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {estimate.shares != null ? fmt(estimate.shares) : "—"}
          </span>
        </span>
      </div>
    </section>
  );
}

function EmailDraft({
  company,
  docs,
  deadlines,
  ko,
  pick,
}: {
  company: string;
  docs: ConversionDoc[];
  deadlines: { ideal: Date; normal: Date; max: Date } | null;
  ko: boolean;
  pick: (ko: string, en: string) => string;
}) {
  const [copied, setCopied] = useState(false);
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
        {ko ? "전환 후 서류 요청 이메일. 복사하여 사용하세요." : "Post-conversion document request. Copy to use."}
      </p>
      <textarea
        readOnly
        value={draft}
        rows={14}
        className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-700 focus:outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"
      />
      <button
        type="button"
        onClick={copy}
        className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
      >
        {copied ? (ko ? "복사됨 ✓" : "Copied ✓") : ko ? "복사" : "Copy"}
      </button>
    </section>
  );
}
