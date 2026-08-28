"use client";

import { useState, useRef } from "react";
import type { AgreementValues } from "@/lib/agreement-fields";
import type { AgreementRecord } from "@/lib/agreement-store";
import type { FieldSuggestions } from "@/lib/agreement-suggest";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseNum(s: string | undefined): number {
  if (!s) return 0;
  return parseFloat(s.replace(/[,\s]/g, "")) || 0;
}

function fmtWon(s: string | undefined): string {
  const n = parseNum(s);
  if (!n) return "—";
  if (n >= 1_000_000_000) return `₩${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 100_000_000) return `₩${(n / 100_000_000).toFixed(0)}억`;
  return "₩" + n.toLocaleString("ko-KR");
}

function fmtPct(s: string | undefined): string {
  return s?.trim() ? s + "%" : "—";
}

// ─── Conversion calculator ─────────────────────────────────────────────────────

type ConvResult = {
  capPct: number | null;
  discPct: number | null;
  better: "cap" | "discount" | "equal" | null;
  effectivePct: number | null;
};

function calcConversion(
  investment: string,
  cap: string,
  discount: string,
  extYears: string,
  extRate: string,
  nextRoundRaw: string,
  afterExtended: boolean,
): ConvResult {
  const inv = parseNum(investment);
  const valCap = parseNum(cap);
  const disc = (afterExtended ? parseNum(extRate) : parseNum(discount)) / 100;
  const nextRound = parseNum(nextRoundRaw.replace(/[억만]/g, (m) =>
    m === "억" ? "00000000" : m === "만" ? "0000" : "",
  ));

  const capPct = valCap > 0 && inv > 0 ? (inv / valCap) * 100 : null;
  const discPct = nextRound > 0 && disc > 0 && inv > 0
    ? (inv / (nextRound * (1 - disc))) * 100
    : null;

  let better: ConvResult["better"] = null;
  let effectivePct: number | null = null;

  if (capPct !== null && discPct !== null) {
    if (capPct > discPct) { better = "cap"; effectivePct = capPct; }
    else if (discPct > capPct) { better = "discount"; effectivePct = discPct; }
    else { better = "equal"; effectivePct = capPct; }
  } else if (capPct !== null) {
    better = "cap"; effectivePct = capPct;
  } else if (discPct !== null) {
    better = "discount"; effectivePct = discPct;
  }

  return { capPct, discPct, better, effectivePct };
}

// ─── Accordion section ─────────────────────────────────────────────────────────

function Section({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-800/60"
      >
        <span className="flex-1">{title}</span>
        {badge && (
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
            {badge}
          </span>
        )}
        <span className="shrink-0 text-neutral-400">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="space-y-2.5 border-t border-neutral-100 px-3.5 py-3 dark:border-neutral-800">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Field input ───────────────────────────────────────────────────────────────

function Field({
  id,
  labelKo,
  labelEn,
  hint,
  value,
  placeholder,
  onChange,
  onFocus,
  onBlur,
  fieldRef,
  startupEditedBy,
  startupEditedAt,
  lang,
  inputMode = "text",
  standardDefault,
}: {
  id: string;
  labelKo: string;
  labelEn: string;
  hint?: string;
  value: string;
  placeholder?: string;
  onChange: (val: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  fieldRef?: (node: HTMLInputElement | null) => void;
  startupEditedBy?: string;
  startupEditedAt?: string;
  lang: "ko" | "en";
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  standardDefault?: string;
}) {
  const label = lang === "ko" ? labelKo : labelEn;
  const off = standardDefault && value.trim() !== "" && value.trim() !== standardDefault;

  return (
    <div>
      <label className="block text-[11px] font-medium text-neutral-500" htmlFor={id}>
        {label}
        {standardDefault && (
          <span className="ml-1 text-neutral-400">({standardDefault})</span>
        )}
        {startupEditedBy && (
          <span
            title={`${lang === "ko" ? "회사 입력" : "Filled by company"} · ${startupEditedBy} · ${new Date(startupEditedAt!).toLocaleDateString()}`}
            className="ml-1.5 rounded bg-emerald-100 px-1 py-0.5 text-[10px] font-normal text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
          >
            {lang === "ko" ? "회사" : "Co."}
          </span>
        )}
      </label>
      <input
        id={id}
        ref={fieldRef}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onFocus={onFocus}
        onBlur={onBlur}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 w-full rounded-lg border px-2.5 py-1.5 text-sm focus:outline-none dark:bg-neutral-950 ${
          off
            ? "border-amber-400 dark:border-amber-700"
            : "border-neutral-300 focus:border-neutral-500 dark:border-neutral-700"
        } placeholder:text-neutral-400 dark:placeholder:text-neutral-600`}
      />
      {hint && <p className="mt-0.5 text-[10px] text-neutral-400">{hint}</p>}
    </div>
  );
}

// ─── Date input (collapses year/month/day into YYYY-MM-DD) ─────────────────────

function DateField({
  id,
  labelKo,
  labelEn,
  hint,
  yearId,
  monthId,
  dayId,
  values,
  onChange,
  locate,
  fieldRefs,
  lang,
}: {
  id: string;
  labelKo: string;
  labelEn: string;
  hint?: string;
  yearId: string;
  monthId: string;
  dayId: string;
  values: AgreementValues;
  onChange: (id: string, val: string) => void;
  locate: (fieldId: string) => void;
  fieldRefs: React.MutableRefObject<Map<string, HTMLElement>>;
  lang: "ko" | "en";
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const y = values[yearId]?.trim();
  const m = values[monthId]?.trim();
  const d = values[dayId]?.trim();
  const derived = y && m && d ? `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` : "";
  const display = draft ?? derived;

  return (
    <div>
      <label className="block text-[11px] font-medium text-neutral-500" htmlFor={id}>
        {lang === "ko" ? labelKo : labelEn}
      </label>
      <input
        id={id}
        ref={(node) => {
          if (node) {
            fieldRefs.current.set(yearId, node);
            fieldRefs.current.set(monthId, node);
            fieldRefs.current.set(dayId, node);
          }
        }}
        value={display}
        placeholder="YYYY-MM-DD"
        onFocus={() => { setDraft(derived); locate(yearId); }}
        onBlur={() => setDraft(null)}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (match) {
            const [, year, month, day] = match;
            onChange(yearId, year);
            onChange(monthId, String(parseInt(month, 10)));
            onChange(dayId, String(parseInt(day, 10)));
          }
        }}
        className="mt-1 w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:placeholder:text-neutral-600"
      />
      {hint && <p className="mt-0.5 text-[10px] text-neutral-400">{hint}</p>}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function SafePanel({
  values,
  onChange,
  saved,
  suggestions,
  lang,
  locate,
  fieldRefs,
}: {
  values: AgreementValues;
  onChange: (id: string, val: string) => void;
  saved: AgreementRecord;
  suggestions: FieldSuggestions;
  lang: "ko" | "en";
  locate: (fieldId: string) => void;
  fieldRefs: React.MutableRefObject<Map<string, HTMLElement>>;
}) {
  const [nextRound, setNextRound] = useState("");
  const [afterExtended, setAfterExtended] = useState(false);

  const ko = lang === "ko";

  const conv = nextRound.trim()
    ? calcConversion(
        values.investmentAmount ?? "",
        values.valuationCap ?? "",
        values.discountRate ?? "",
        values.discountExtendedYears ?? "1",
        values.discountExtendedRate ?? "",
        nextRound,
        afterExtended,
      )
    : null;

  const se = (id: string) => saved.startupEdits?.[id];
  const fld = (id: string): string => values[id] ?? "";
  const set = (id: string) => (val: string) => onChange(id, val);
  const ref = (id: string) => (node: HTMLInputElement | null) => {
    if (node) fieldRefs.current.set(id, node);
  };
  const focus = (id: string) => () => locate(id);

  return (
    <div className="space-y-3">

      {/* ── Investment summary header ─────────────────────────── */}
      <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 p-3.5 dark:border-violet-900/60 dark:from-violet-950/20 dark:to-purple-950/20">
        <div className="mb-2.5 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-violet-600 text-[10px] font-bold text-white">S</span>
          <span className="text-xs font-semibold text-violet-900 dark:text-violet-200">
            {ko ? "SAFE 조건부지분인수계약서" : "SAFE — Conditional Equity Agreement"}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: ko ? "투자금액" : "Investment", value: fmtWon(values.investmentAmount) },
            { label: ko ? "밸류에이션 캡" : "Val. Cap", value: fmtWon(values.valuationCap) },
            { label: ko ? "할인율" : "Discount", value: fmtPct(values.discountRate) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-white/70 px-2 py-2 text-center dark:bg-black/20">
              <p className="text-sm font-bold text-violet-900 dark:text-violet-200">{value}</p>
              <p className="mt-0.5 text-[10px] text-violet-600 dark:text-violet-400">{label}</p>
            </div>
          ))}
        </div>

        {/* Company + Investor */}
        {(values.companyName || values.investorName) && (
          <div className="mt-2.5 rounded-lg bg-white/50 px-2.5 py-2 text-[11px] dark:bg-black/10">
            <span className="text-violet-500">{ko ? "투자자" : "Investor"}:&nbsp;</span>
            <span className="font-medium text-violet-900 dark:text-violet-200">
              {values.investorName || "—"}
            </span>
            <span className="mx-1.5 text-violet-300">→</span>
            <span className="text-violet-500">{ko ? "회사" : "Company"}:&nbsp;</span>
            <span className="font-medium text-violet-900 dark:text-violet-200">
              {values.companyName || "—"}
            </span>
          </div>
        )}
      </div>

      {/* ── Conversion simulator ──────────────────────────────── */}
      <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3.5 dark:border-sky-900/60 dark:bg-sky-950/10">
        <p className="mb-2 text-xs font-semibold text-sky-900 dark:text-sky-200">
          {ko ? "⚡ 전환 시뮬레이터" : "⚡ Conversion Simulator"}
        </p>
        <p className="mb-2.5 text-[11px] text-sky-700 dark:text-sky-400">
          {ko
            ? "후속 투자 라운드의 Pre-Money 밸류에이션을 입력하면, SAFE가 전환 시 투자자 지분율을 계산합니다."
            : "Enter the next round's pre-money valuation to see what % the SAFE converts to."}
        </p>
        <input
          type="text"
          inputMode="numeric"
          value={nextRound}
          onChange={(e) => setNextRound(e.target.value)}
          placeholder={ko ? "예: 5000000000 (50억)" : "e.g. 5000000000 (₩5B)"}
          className="w-full rounded-lg border border-sky-300 bg-white px-2.5 py-1.5 text-sm placeholder:text-neutral-400 focus:border-sky-500 focus:outline-none dark:border-sky-800 dark:bg-neutral-950"
        />

        {values.discountExtendedYears && values.discountExtendedRate && (
          <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-[11px] text-sky-700 dark:text-sky-400">
            <input
              type="checkbox"
              checked={afterExtended}
              onChange={(e) => setAfterExtended(e.target.checked)}
              className="rounded"
            />
            {ko
              ? `납입 후 ${values.discountExtendedYears}년 이후 후속 투자 (연장 할인율 ${values.discountExtendedRate}% 적용)`
              : `After ${values.discountExtendedYears}yr — apply extended discount (${values.discountExtendedRate}%)`}
          </label>
        )}

        {conv && (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className={`rounded-lg px-2.5 py-2 text-center ${
                conv.better === "cap"
                  ? "bg-violet-100 ring-1 ring-violet-400 dark:bg-violet-950/40"
                  : "bg-neutral-100 dark:bg-neutral-800/60"
              }`}>
                <p className="text-base font-bold text-neutral-900 dark:text-white">
                  {conv.capPct !== null ? conv.capPct.toFixed(2) + "%" : "—"}
                </p>
                <p className="text-[10px] text-neutral-500">{ko ? "캡 기준" : "Cap path"}</p>
                {conv.better === "cap" && (
                  <p className="text-[9px] font-semibold text-violet-600 dark:text-violet-400">
                    {ko ? "✓ 적용" : "✓ applies"}
                  </p>
                )}
              </div>
              <div className={`rounded-lg px-2.5 py-2 text-center ${
                conv.better === "discount"
                  ? "bg-sky-100 ring-1 ring-sky-400 dark:bg-sky-950/40"
                  : "bg-neutral-100 dark:bg-neutral-800/60"
              }`}>
                <p className="text-base font-bold text-neutral-900 dark:text-white">
                  {conv.discPct !== null ? conv.discPct.toFixed(2) + "%" : "—"}
                </p>
                <p className="text-[10px] text-neutral-500">
                  {ko ? `할인 ${afterExtended ? values.discountExtendedRate : values.discountRate}%` : `Discount ${afterExtended ? values.discountExtendedRate : values.discountRate}%`}
                </p>
                {conv.better === "discount" && (
                  <p className="text-[9px] font-semibold text-sky-600 dark:text-sky-400">
                    {ko ? "✓ 적용" : "✓ applies"}
                  </p>
                )}
              </div>
            </div>
            {conv.effectivePct !== null && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-center text-xs font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                {ko
                  ? `투자자 예상 지분율: ${conv.effectivePct.toFixed(2)}%`
                  : `Investor estimated ownership: ${conv.effectivePct.toFixed(2)}%`}
                {" · "}
                {conv.better === "cap"
                  ? (ko ? "캡 조건 적용 (투자자 유리)" : "Cap applies (favors investor)")
                  : conv.better === "discount"
                    ? (ko ? "할인율 적용 (투자자 유리)" : "Discount applies (favors investor)")
                    : (ko ? "동일" : "Equal")}
              </p>
            )}
            <p className="text-[10px] text-neutral-400">
              {ko
                ? "두 방법 중 투자자에게 더 유리한 (지분율이 높은) 조건이 자동 적용됩니다."
                : "The method giving the investor more shares (higher %) applies automatically."}
            </p>
          </div>
        )}
      </div>

      {/* ── 1. Core investment terms ──────────────────────────── */}
      <Section title={ko ? "1. 투자 핵심 조건" : "1. Core Investment Terms"} defaultOpen>
        <Field
          id="valuationCap" labelKo="가치한도 (원)" labelEn="Valuation cap (KRW)"
          hint={ko ? "이 금액 이하로 전환 가격을 제한합니다 (캡)" : "Caps the conversion valuation — investor never pays more than this per share"}
          value={fld("valuationCap")} onChange={set("valuationCap")}
          onFocus={focus("valuationCap")} onBlur={() => {}} fieldRef={ref("valuationCap")}
          startupEditedBy={se("valuationCap")?.editedBy} startupEditedAt={se("valuationCap")?.editedAt}
          lang={lang} inputMode="numeric"
        />
        <Field
          id="discountRate" labelKo="할인율 (%)" labelEn="Discount rate (%)"
          hint={ko ? "후속 라운드 주식 가격에 할인을 적용합니다" : "Applied to the next round price to calculate the conversion price"}
          value={fld("discountRate")} onChange={set("discountRate")}
          onFocus={focus("discountRate")} onBlur={() => {}} fieldRef={ref("discountRate")}
          startupEditedBy={se("discountRate")?.editedBy} startupEditedAt={se("discountRate")?.editedAt}
          lang={lang} inputMode="numeric"
        />
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-2.5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="mb-1.5 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
            {ko ? "기간 초과 시 연장 할인율" : "Extended discount (after N years)"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Field
              id="discountExtendedYears" labelKo="기준 기간 (년)" labelEn="After N years"
              hint={ko ? "납입 후 이 기간을 초과하면 아래 할인율 적용" : "Trigger: follow-on after this many years"}
              value={fld("discountExtendedYears")} onChange={set("discountExtendedYears")}
              onFocus={focus("discountExtendedYears")} onBlur={() => {}} fieldRef={ref("discountExtendedYears")}
              lang={lang} inputMode="numeric" standardDefault="1"
            />
            <Field
              id="discountExtendedRate" labelKo="연장 할인율 (%)" labelEn="Extended rate (%)"
              value={fld("discountExtendedRate")} onChange={set("discountExtendedRate")}
              onFocus={focus("discountExtendedRate")} onBlur={() => {}} fieldRef={ref("discountExtendedRate")}
              lang={lang} inputMode="numeric"
            />
          </div>
        </div>
        <Field
          id="investmentAmount" labelKo="투자금 (원)" labelEn="Investment amount (KRW)"
          hint={ko ? "제2조 투자금 — 이 금액이 계약서 전체에 반영됩니다" : "Article 2 — this amount appears throughout the contract"}
          value={fld("investmentAmount")} onChange={set("investmentAmount")}
          onFocus={focus("investmentAmount")} onBlur={() => {}} fieldRef={ref("investmentAmount")}
          startupEditedBy={se("investmentAmount")?.editedBy} startupEditedAt={se("investmentAmount")?.editedAt}
          lang={lang} inputMode="numeric"
        />
      </Section>

      {/* ── 2. Payment ────────────────────────────────────────── */}
      <Section title={ko ? "2. 납입 정보" : "2. Payment"} defaultOpen>
        <DateField
          id="payment-date"
          labelKo="투자금 납입기한" labelEn="Payment deadline"
          hint={ko ? "이 날까지 납입하지 않으면 계약 해제 사유" : "Missing this date is grounds for termination"}
          yearId="paymentYear" monthId="paymentMonth" dayId="paymentDay"
          values={values} onChange={onChange} locate={locate} fieldRefs={fieldRefs} lang={lang}
        />
        <Field
          id="accountHolder" labelKo="입금계좌 예금주" labelEn="Account holder"
          value={fld("accountHolder")} onChange={set("accountHolder")}
          onFocus={focus("accountHolder")} onBlur={() => {}} fieldRef={ref("accountHolder")}
          startupEditedBy={se("accountHolder")?.editedBy} startupEditedAt={se("accountHolder")?.editedAt}
          lang={lang}
        />
        <div className="grid grid-cols-2 gap-2">
          <Field
            id="accountBank" labelKo="은행" labelEn="Bank"
            hint={ko ? "예: 기업은행, 국민은행" : "e.g. IBK, Kookmin"}
            value={fld("accountBank")} onChange={set("accountBank")}
            onFocus={focus("accountBank")} onBlur={() => {}} fieldRef={ref("accountBank")}
            lang={lang}
          />
          <Field
            id="accountNumber" labelKo="계좌번호" labelEn="Account No."
            value={fld("accountNumber")} onChange={set("accountNumber")}
            onFocus={focus("accountNumber")} onBlur={() => {}} fieldRef={ref("accountNumber")}
            lang={lang}
          />
        </div>
      </Section>

      {/* ── 3. Parties ────────────────────────────────────────── */}
      <Section title={ko ? "3. 당사자" : "3. Parties"} defaultOpen>
        <Field
          id="investorName" labelKo="투자자 (조합)" labelEn="Investor (fund)"
          hint={ko ? "전문의 투자자 표기 — 기본값: 스파크랩 테크 퍼스트 스텝 투자조합" : "Named in the preamble — default: SparkLabs Tech Firststep Fund"}
          value={fld("investorName")} onChange={set("investorName")}
          onFocus={focus("investorName")} onBlur={() => {}} fieldRef={ref("investorName")}
          lang={lang} standardDefault="스파크랩 테크 퍼스트 스텝 투자조합"
          placeholder="스파크랩 테크 퍼스트 스텝 투자조합"
        />
        <Field
          id="companyName" labelKo="회사명" labelEn="Company name"
          hint={ko ? "전문의 '회사' 표기" : "Named in the preamble"}
          value={fld("companyName")} onChange={set("companyName")}
          onFocus={focus("companyName")} onBlur={() => {}} fieldRef={ref("companyName")}
          startupEditedBy={se("companyName")?.editedBy} startupEditedAt={se("companyName")?.editedAt}
          lang={lang}
        />
      </Section>

      {/* ── 4. Interested party ───────────────────────────────── */}
      <Section title={ko ? "4. 이해관계인 (별지1 · 별지3)" : "4. Interested Party (App. 1 & 3)"} defaultOpen>
        <p className="text-[11px] text-neutral-500 leading-relaxed">
          {ko
            ? "이해관계인(주로 창업자)의 정보가 별지1 주주 동의와 별지3 퇴사제한·경업금지 두 곳에 동시에 입력됩니다."
            : "The interested party's details (usually the founder) fill Appendix 1 (shareholder consent) and Appendix 3 (resignation & non-compete) simultaneously."}
        </p>
        <Field
          id="interestedName"
          labelKo="성명 (별지1 + 별지3 동시 반영)"
          labelEn="Name (fills App. 1 + App. 3)"
          hint={ko ? "주주 동의란·퇴사제한란·경업금지란 세 곳에 채워집니다" : "Fills 3 cells: App. 1 consent + both App. 3 tables"}
          value={fld("interestedName")} onChange={set("interestedName")}
          onFocus={focus("interestedName")} onBlur={() => {}} fieldRef={ref("interestedName")}
          startupEditedBy={se("interestedName")?.editedBy} startupEditedAt={se("interestedName")?.editedAt}
          lang={lang}
        />
        <Field
          id="interestedResidentNo" labelKo="주민등록번호" labelEn="Resident reg. no."
          hint={ko ? "별지1 주주 동의" : "Appendix 1 shareholder consent"}
          value={fld("interestedResidentNo")} onChange={set("interestedResidentNo")}
          onFocus={focus("interestedResidentNo")} onBlur={() => {}} fieldRef={ref("interestedResidentNo")}
          lang={lang}
        />
        <div className="grid grid-cols-2 gap-2">
          <Field
            id="interestedBirth" labelKo="생년월일" labelEn="Date of birth"
            hint={ko ? "별지3 I." : "Appendix 3 §I"}
            value={fld("interestedBirth")} onChange={set("interestedBirth")}
            onFocus={focus("interestedBirth")} onBlur={() => {}} fieldRef={ref("interestedBirth")}
            lang={lang}
          />
        </div>
        <Field
          id="interestedAddress"
          labelKo="주소 (별지1 + 별지3 동시 반영)"
          labelEn="Address (fills App. 1 + App. 3)"
          hint={ko ? "주주 동의란·퇴사제한란 두 곳에 채워집니다" : "Fills 2 cells: App. 1 consent + App. 3 §I table"}
          value={fld("interestedAddress")} onChange={set("interestedAddress")}
          onFocus={focus("interestedAddress")} onBlur={() => {}} fieldRef={ref("interestedAddress")}
          startupEditedBy={se("interestedAddress")?.editedBy} startupEditedAt={se("interestedAddress")?.editedAt}
          lang={lang}
        />
      </Section>

      {/* ── 5. Signing date ───────────────────────────────────── */}
      <Section title={ko ? "5. 체결일" : "5. Signing Date"} defaultOpen>
        <DateField
          id="sign-date"
          labelKo="체결일" labelEn="Signing date"
          yearId="signYear" monthId="signMonth" dayId="signDay"
          values={values} onChange={onChange} locate={locate} fieldRefs={fieldRefs} lang={lang}
        />
      </Section>

      {/* ── 6. Non-compete appendix ───────────────────────────── */}
      <Section title={ko ? "6. 경업금지·퇴사제한 (별지3)" : "6. Non-compete & Resignation (App. 3)"} badge={ko ? "SparkLabs 기준" : "SparkLabs std"}>
        <p className="text-[11px] text-neutral-500">
          {ko
            ? "임직원의 경업금지 및 퇴사제한 조건입니다. 스파크랩 표준값이 사전 입력되어 있습니다."
            : "Non-compete and early-resignation terms for key personnel. SparkLabs defaults are pre-filled."}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Field
            id="noncompeteYears" labelKo="경업금지 기간 (년)" labelEn="Non-compete (years)"
            hint={ko ? "재직 및 퇴사 후 경업금지 기간" : "Applies during employment and after"}
            value={fld("noncompeteYears")} onChange={set("noncompeteYears")}
            onFocus={focus("noncompeteYears")} onBlur={() => {}} fieldRef={ref("noncompeteYears")}
            lang={lang} inputMode="numeric" standardDefault="2"
          />
        </div>
        <Field
          id="noncompletePenalty" labelKo="경업 위반 위약벌 (원)" labelEn="Non-compete breach penalty (KRW)"
          value={fld("noncompletePenalty")} onChange={set("noncompletePenalty")}
          onFocus={focus("noncompletePenalty")} onBlur={() => {}} fieldRef={ref("noncompletePenalty")}
          lang={lang} inputMode="numeric" standardDefault="50,000,000"
        />
        <Field
          id="resignPenalty" labelKo="퇴사제한 위반 위약벌 (원)" labelEn="Early-resignation penalty (KRW)"
          hint={ko ? "별지3 I. 퇴사제한 위반 시 위약벌" : "Appendix 3 §I resignation-restriction penalty"}
          value={fld("resignPenalty")} onChange={set("resignPenalty")}
          onFocus={focus("resignPenalty")} onBlur={() => {}} fieldRef={ref("resignPenalty")}
          lang={lang} inputMode="numeric"
        />
      </Section>

      {/* ── 7. Signature blocks ───────────────────────────────── */}
      <Section title={ko ? "7. 서명란" : "7. Signature Blocks"}>
        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
          {ko ? "투자자" : "Investor"}
        </p>
        <Field id="invSigCompany" labelKo="조합/회사명" labelEn="Name"
          value={fld("invSigCompany")} onChange={set("invSigCompany")}
          onFocus={focus("invSigCompany")} onBlur={() => {}} fieldRef={ref("invSigCompany")}
          lang={lang} placeholder="스파크랩 테크 퍼스트 스텝 투자조합"
        />
        <Field id="invSigAddress" labelKo="주소" labelEn="Address"
          value={fld("invSigAddress")} onChange={set("invSigAddress")}
          onFocus={focus("invSigAddress")} onBlur={() => {}} fieldRef={ref("invSigAddress")}
          lang={lang}
        />
        <div className="grid grid-cols-2 gap-2">
          <Field id="invSigBizNo" labelKo="사업자등록번호" labelEn="Biz reg. no."
            value={fld("invSigBizNo")} onChange={set("invSigBizNo")}
            onFocus={focus("invSigBizNo")} onBlur={() => {}} fieldRef={ref("invSigBizNo")}
            lang={lang}
          />
          <Field id="invSigPhone" labelKo="전화" labelEn="Phone"
            value={fld("invSigPhone")} onChange={set("invSigPhone")}
            onFocus={focus("invSigPhone")} onBlur={() => {}} fieldRef={ref("invSigPhone")}
            lang={lang}
          />
        </div>
        <div className="my-1 border-t border-neutral-200 dark:border-neutral-800" />
        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
          {ko ? "회사" : "Company"}
        </p>
        <Field id="coSigCompany" labelKo="회사명" labelEn="Company name"
          value={fld("coSigCompany")} onChange={set("coSigCompany")}
          onFocus={focus("coSigCompany")} onBlur={() => {}} fieldRef={ref("coSigCompany")}
          lang={lang}
        />
        <Field id="coSigAddress" labelKo="주소" labelEn="Address"
          value={fld("coSigAddress")} onChange={set("coSigAddress")}
          onFocus={focus("coSigAddress")} onBlur={() => {}} fieldRef={ref("coSigAddress")}
          lang={lang}
        />
        <div className="grid grid-cols-2 gap-2">
          <Field id="coSigBizNo" labelKo="사업자등록번호" labelEn="Biz reg. no."
            value={fld("coSigBizNo")} onChange={set("coSigBizNo")}
            onFocus={focus("coSigBizNo")} onBlur={() => {}} fieldRef={ref("coSigBizNo")}
            lang={lang}
          />
          <Field id="coSigPhone" labelKo="전화" labelEn="Phone"
            value={fld("coSigPhone")} onChange={set("coSigPhone")}
            onFocus={focus("coSigPhone")} onBlur={() => {}} fieldRef={ref("coSigPhone")}
            lang={lang}
          />
        </div>
      </Section>

      {/* ── 8. Standard terms ─────────────────────────────────── */}
      <Section title={ko ? "8. 표준 조항 (SparkLabs 기준)" : "8. Standard Terms (SparkLabs defaults)"} badge={ko ? "사전 입력 완료" : "pre-filled"}>
        <p className="text-[11px] text-neutral-500">
          {ko
            ? "스파크랩 표준값이 사전 입력되어 있습니다. 특수한 사정이 없으면 그대로 유지하세요."
            : "SparkLabs standard values are pre-filled. Only change if this deal departs from the norm."}
        </p>
        <Field
          id="useOfFunds" labelKo="투자금 사용목적" labelEn="Use of funds"
          hint={ko ? "제5조 ①의 사용목적 문구 전체" : "Full use-of-funds line in Article 5(1)"}
          value={fld("useOfFunds")} onChange={set("useOfFunds")}
          onFocus={focus("useOfFunds")} onBlur={() => {}} fieldRef={ref("useOfFunds")}
          lang={lang}
        />
        <div className="grid grid-cols-3 gap-2">
          <Field
            id="annualReportDays" labelKo="연간 보고 (일)" labelEn="Annual report (days)"
            value={fld("annualReportDays")} onChange={set("annualReportDays")}
            onFocus={focus("annualReportDays")} onBlur={() => {}} fieldRef={ref("annualReportDays")}
            lang={lang} inputMode="numeric" standardDefault="60"
          />
          <Field
            id="quarterlyReportDays" labelKo="분기 보고 (일)" labelEn="Quarterly report (days)"
            value={fld("quarterlyReportDays")} onChange={set("quarterlyReportDays")}
            onFocus={focus("quarterlyReportDays")} onBlur={() => {}} fieldRef={ref("quarterlyReportDays")}
            lang={lang} inputMode="numeric" standardDefault="45"
          />
          <Field
            id="penaltyLate" labelKo="지연 이자 (%)" labelEn="Late interest (%)"
            value={fld("penaltyLate")} onChange={set("penaltyLate")}
            onFocus={focus("penaltyLate")} onBlur={() => {}} fieldRef={ref("penaltyLate")}
            lang={lang} inputMode="numeric" standardDefault="12"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field
            id="penaltyBreach" labelKo="위약벌 (%)" labelEn="Liquidated damages (%)"
            value={fld("penaltyBreach")} onChange={set("penaltyBreach")}
            onFocus={focus("penaltyBreach")} onBlur={() => {}} fieldRef={ref("penaltyBreach")}
            lang={lang} inputMode="numeric" standardDefault="12"
          />
          <Field
            id="damages" labelKo="손해배상 기준 (%)" labelEn="Damages basis (%)"
            value={fld("damages")} onChange={set("damages")}
            onFocus={focus("damages")} onBlur={() => {}} fieldRef={ref("damages")}
            lang={lang} inputMode="numeric" standardDefault="120"
          />
        </div>
      </Section>

    </div>
  );
}
