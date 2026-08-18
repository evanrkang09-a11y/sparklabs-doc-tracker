"use client";

import { useState } from "react";
import { useLang } from "@/app/lang-provider";

/**
 * A single reference page for the knowledge that doesn't belong on any one
 * checklist — fund names, payout timing, every deadline in one place, overseas
 * rules, the mentor's tips, and the KIBO technology-evaluation appendix.
 *
 * Data-driven so the search box can filter across all of it.
 */

type RefItem = { ko: string; en: string };
type RefSection = { id: string; titleKo: string; titleEn: string; items: RefItem[] };

const SECTIONS: RefSection[] = [
  {
    id: "funds",
    titleKo: "펀드 정보",
    titleEn: "Funds",
    items: [
      {
        ko: "투자계약서 기본 투자자/조합: 스파크랩 디스커버리펀드8호 개인투자조합",
        en: "Default agreement investor/fund: SparkLabs Discovery Fund 8 Personal Investment Association",
      },
      {
        ko: "SAFE 전환 시 주주명(펀드명): SparkLabs Tech First Step Investment Association",
        en: "SAFE conversion shareholder (fund) name: SparkLabs Tech First Step Investment Association",
      },
      {
        ko: "업무집행조합원(GP): 주식회사 스파크랩 · 대표이사 김유진",
        en: "General partner (GP): SparkLabs Inc. · CEO Kim Yujin",
      },
    ],
  },
  {
    id: "timing",
    titleKo: "납입 · 이체 타이밍",
    titleEn: "Payment & transfer timing",
    items: [
      { ko: "민간펀드: 납입일 오전에 바로 납입됨", en: "Private fund: pays out on the morning of the payment date" },
      {
        ko: "모태펀드: 모태 승인 후 납입일 오후 3시 즈음 납입됨",
        en: "Fund-of-funds (모태): pays around 3pm on the payment date, after 모태 approval",
      },
      {
        ko: "운용지시일과 납입일은 최소 하루 이상 차이가 나야 함 (은행 영업시간 고려)",
        en: "The instruction date and payment date must differ by at least one day (bank hours)",
      },
      { ko: "해외 기업 투자는 민간펀드로만 가능 (모태 해당 없음)", en: "Overseas investments can only use a private fund (never 모태)" },
    ],
  },
  {
    id: "deadlines",
    titleKo: "기한 정리",
    titleEn: "Deadlines",
    items: [
      {
        ko: "투자납입 후 서류: 납입일 기준 가급적 20일 이내, 최대 30일 (원본이 수탁은행에 30일 내 도착해야 함)",
        en: "Post-payment documents: within 20 days of payment ideally, max 30 (originals must reach the custodian bank within 30 days)",
      },
      {
        ko: "SAFE 전환 등기: 단수주 납입일 기준 2주(권장)/20일(보통)/30일(최대)",
        en: "SAFE conversion registration: 2 weeks ideal / 20 normal / 30 max from the fractional-share payment date",
      },
      {
        ko: "SAFE 전환 후 서류: 계약 서명일 기준 2주/20일/최대 30일 이내 회신",
        en: "Post-conversion documents: within 2 weeks / 20 / max 30 days of the signing date",
      },
      {
        ko: "계약서 초안: 계약일 최소 3일 전 발송",
        en: "Agreement draft: send at least 3 days before the contract date",
      },
      {
        ko: "SAFE 전환계약은 후속 투자 납입 완료 전에 서명되어야 함",
        en: "The SAFE conversion agreement must be signed before the follow-on payment completes",
      },
    ],
  },
  {
    id: "overseas",
    titleKo: "해외 투자",
    titleEn: "Overseas investment",
    items: [
      {
        ko: "납입 후 수탁은행이 보내주는 증권취득신고서 + 외화송금영수증·전신문을 한국은행에 이메일 제출",
        en: "After payment, email the securities acquisition report + FX remittance receipt/wire message (from the custodian bank) to the Bank of Korea",
      },
      {
        ko: "해외 신주 발행 투자는 법무법인 통해 '해외투자사실확인서' 발급 필요 (원본 수탁은행 송부)",
        en: "Overseas new-share investment needs an 'overseas investment confirmation' issued via a law firm (original sent to the custodian bank)",
      },
      {
        ko: "증권취득신고서: 한국은행 신고접수 후 교부되는 것 (수탁은행 날인 전)",
        en: "Securities acquisition report: the one issued after BOK acceptance (before the custodian seal)",
      },
      {
        ko: "해외 기업은 대부분 주권미발행확인서보다 주권을 확실히 발행해 줌",
        en: "Overseas companies usually issue share certificates rather than a non-issuance confirmation",
      },
    ],
  },
  {
    id: "reminders",
    titleKo: "핵심 유의사항",
    titleEn: "Key reminders",
    items: [
      {
        ko: "운용지시서 · 투자계약서 · 투자심의위원회 의사록의 숫자(주식수·발행가액·금액)가 일치해야 함",
        en: "The figures (shares, price, amount) on the operating instruction, agreement, and committee minutes must match",
      },
      {
        ko: "투자기업은 등기 완료 이전에 투자금을 사용해서는 안 됨",
        en: "The company must not spend the investment before the share registration is complete",
      },
      {
        ko: "SAFE 전환 시, 후속 투자 승인 안건에 스파크랩 SAFE 지분 전환도 포함되어야 함",
        en: "On a SAFE conversion, SparkLabs' conversion must be included in the follow-on's approved matters",
      },
      {
        ko: "투자 후 안내 메일은 납입일 아침 '예약발송' 권장 (통장 잔액증명 확보 유도)",
        en: "Send the post-payment guide email via scheduled-send on the morning of payment (to secure the balance certificate)",
      },
      {
        ko: "구주거래는 잔고증명 없음 — 주식미발행확인서만 있으면 됨",
        en: "Secondary (구주) deals have no balance certificate — only the non-issuance confirmation is needed",
      },
    ],
  },
  {
    id: "kibo",
    titleKo: "KIBO 기술평가 (부록)",
    titleEn: "KIBO technology evaluation (appendix)",
    items: [
      {
        ko: "투자 심사용으로 표준 10등급 TCB 평가 대신 14등급 기술평가 인증이 인정됨",
        en: "For investment screening, a 14-level technology evaluation certificate is recognized instead of the standard 10-level TCB rating",
      },
      {
        ko: "기술신용평가(Technology Credit Rating)에서 BBB 등급이 인정됨",
        en: "BBB in the Technology Credit Rating system is recognized",
      },
    ],
  },
];

export default function ReferenceContent() {
  const { lang } = useLang();
  const ko = lang === "ko";
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const sections = SECTIONS.map((section) => ({
    ...section,
    items: q
      ? section.items.filter((it) =>
          `${it.ko} ${it.en}`.toLowerCase().includes(q),
        )
      : section.items,
  })).filter((section) => section.items.length > 0);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {ko ? "참고자료" : "Reference"}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {ko
            ? "펀드·기한·해외 규칙·유의사항·KIBO 기술평가를 한 곳에 모았습니다."
            : "Funds, deadlines, overseas rules, reminders and the KIBO evaluation, all in one place."}
        </p>
      </header>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={ko ? "검색…" : "Search…"}
        className="mb-6 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950"
      />

      {sections.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-400 dark:border-neutral-700">
          {ko ? `"${query}"에 해당하는 내용이 없습니다.` : `No entries match "${query}".`}
        </p>
      ) : (
        <div className="space-y-4">
          {sections.map((section) => (
            <section
              key={section.id}
              className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
            >
              <h2 className="mb-2 text-sm font-semibold">
                {ko ? section.titleKo : section.titleEn}
              </h2>
              <ul className="space-y-1.5">
                {section.items.map((it, i) => (
                  <li key={i} className="flex gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                    <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-indigo-500" />
                    <span>{ko ? it.ko : it.en}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
