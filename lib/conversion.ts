/**
 * SAFE → equity conversion (#7).
 *
 * A separate event from the initial investment: when a portfolio company runs a
 * priced follow-on round that triggers SparkLabs' SAFE conversion conditions,
 * the SAFE converts into actual shares. This has its own process, document
 * lists, deadlines and routing — none of which the initial-execution flow
 * covers.
 *
 * Source: the mentor's "#7. When SAFE Investment Equity Is Converted". English
 * is authoritative here (the source section is written in English); Korean is a
 * translation kept beside it.
 */

/** The fund the converted shares are registered under (#6-C / #7). */
export const CONVERSION_FUND_NAME = "SparkLabs Tech First Step Investment Association";

export type ProcessStep = {
  id: string;
  titleKo: string;
  titleEn: string;
  noteKo?: string;
  noteEn?: string;
};

export type ConversionDoc = {
  id: string;
  nameKo: string;
  nameEn: string;
  /** Copies required, e.g. "원본 2부" / "[2 originals]". */
  copiesKo?: string;
  copiesEn?: string;
  noteKo?: string;
  noteEn?: string;
};

// ---------------------------------------------------------------------------
// The overall process (6 steps)
// ---------------------------------------------------------------------------

export const CONVERSION_STEPS: ProcessStep[] = [
  {
    id: "step-request",
    titleKo: "1. 기업에 서류 요청",
    titleEn: "1. Request documents from the company",
    noteKo:
      "후속 투자로 SAFE 전환 조건이 충족되어 주주총회/이사회 승인을 받을 때, 스파크랩 SAFE 지분 전환도 승인 안건에 포함되어야 합니다. 후속 투자 등기와 SAFE 전환 등기는 동시에 완료되어야 하며(투자단가가 달라 어려우면 1종·2종 주식으로 분리).",
    noteEn:
      "When shareholder/board approval is obtained for the follow-on that triggers conversion, SparkLabs' SAFE conversion must be included in the approved matters. The follow-on and SAFE-conversion registrations must complete simultaneously (if prices differ, split into 1st/2nd-class shares).",
  },
  {
    id: "step-explain",
    titleKo: "2. 향후 절차 안내",
    titleEn: "2. Explain the upcoming process",
    noteKo: "서류 요청과 함께 앞으로의 절차를 안내합니다.",
    noteEn: "Explain the upcoming process together with the document request.",
  },
  {
    id: "step-schedule",
    titleKo: "3. 전환계약 서명·날인일 조율",
    titleEn: "3. Schedule the signing/sealing date",
    noteKo:
      "기업이 계약서를 검토하고 납입일 기준으로 서명일을 선택합니다. 대표자·이해관계인의 법인·개인 인감이 필요합니다. SAFE 전환계약은 후속 투자 납입 완료 전에 서명되어야 합니다.",
    noteEn:
      "The company reviews the agreement and picks a signing date based on the payment date. The representative and interested parties need corporate and personal seals. The SAFE conversion agreement must be signed before the follow-on payment completes.",
  },
  {
    id: "step-draft",
    titleKo: "4. 계약서 초안 준비",
    titleEn: "4. Prepare the agreement draft",
    noteKo: "계약일 최소 3일 전에 초안을 발송합니다 (스파크랩 → 전환 기업).",
    noteEn: "Send the draft at least 3 days before the contract date (SparkLabs → company).",
  },
  {
    id: "step-sign",
    titleKo: "5. 서명·날인 진행",
    titleEn: "5. Sign and seal",
    noteKo: "기업 검토 후 서명·날인. 대표자·이해관계인의 법인·개인 인감이 필요합니다.",
    noteEn: "After the company reviews, sign and seal. Corporate and personal seals needed.",
  },
  {
    id: "step-refund",
    titleKo: "6. 반환금 수령",
    titleEn: "6. Receive the refund amount",
    noteKo: "후속 투자 라운드 납입일 당일 또는 그 전에 수령합니다.",
    noteEn: "Receive on or before the follow-on round's payment date.",
  },
];

// ---------------------------------------------------------------------------
// Documents to request from the company, before conversion
// ---------------------------------------------------------------------------

export const CONVERSION_PRE_DOCS: ConversionDoc[] = [
  { id: "pre-cap-table", nameKo: "전환 반영 Cap Table", nameEn: "Cap table reflecting SparkLabs' conversion" },
  { id: "pre-lead-agreement", nameKo: "후속(리드) 투자자 계약서 사본", nameEn: "Copy of the follow-on (lead) investor's agreement" },
  { id: "pre-shareholder-list", nameKo: "후속 투자 직전 최신 주주명부", nameEn: "Most recent shareholder list before the follow-on" },
  { id: "pre-registry", nameKo: "후속 투자 직전 최신 법인 등기부등본", nameEn: "Most recent corporate registry before the follow-on" },
];

// ---------------------------------------------------------------------------
// Post-conversion documents to request (after new shares issued)
// ---------------------------------------------------------------------------

export const CONVERSION_POST_DOCS: ConversionDoc[] = [
  {
    id: "post-nonissuance",
    nameKo: "주식미발행확인서",
    nameEn: "Stock Non-Issuance Confirmation",
    copiesKo: "원본 2부",
    copiesEn: "2 originals",
    noteKo: "단수주 납입일 기준으로 날짜 기재 요청",
    noteEn: "Request it be dated on the fractional-share payment date",
  },
  {
    id: "post-shareholder-list",
    nameKo: "전환 후 주주명부 (날인)",
    nameEn: "Post-conversion shareholder list (sealed)",
    copiesKo: "원본 2부",
    copiesEn: "2 originals",
    noteKo: `신주 발행 반영 · 납입 후 1개월 이내 · 주주명은 펀드명(${CONVERSION_FUND_NAME})`,
    noteEn: `Reflect the new issuance · within 1 month of payment · shareholder name = fund name (${CONVERSION_FUND_NAME})`,
  },
  {
    id: "post-registry",
    nameKo: "법인 등기부등본 (말소사항 포함)",
    nameEn: "Corporate Registry Certificate (incl. deleted matters)",
    copiesKo: "원본 2부",
    copiesEn: "2 originals",
    noteKo: "신주 발행 반영",
    noteEn: "Must reflect the new issuance",
  },
  {
    id: "post-seal",
    nameKo: "법인 인감증명서",
    nameEn: "Corporate Seal Certificate",
    copiesKo: "원본 2부",
    copiesEn: "2 originals",
    noteKo: "계약 서명일 전후 3개월 이내 발급",
    noteEn: "Issued within 3 months before/after the signing date",
  },
  {
    id: "post-balance",
    nameKo: "통장 잔액증명서 또는 이체확인서",
    nameEn: "Bank Balance Certificate or Transfer Confirmation",
    copiesKo: "1부 (원본 또는 사본)",
    copiesEn: "1 copy (original or copy)",
    noteKo: "등기 제출용 출자금 잔액증명",
    noteEn: "Balance certificate for the capital contribution submitted for registration",
  },
  {
    id: "post-minutes",
    nameKo: "공증 (임시) 주주총회/이사회 의사록",
    nameEn: "Notarized (temporary) shareholders'/board meeting minutes",
    copiesKo: "1부",
    copiesEn: "1 copy",
  },
];

// ---------------------------------------------------------------------------
// Where the post-conversion documents go (routing reference)
// ---------------------------------------------------------------------------

export const CONVERSION_CUSTODIAN_DOCS: ConversionDoc[] = [
  { id: "cust-nonissuance", nameKo: "주식미발행확인서", nameEn: "Stock Non-Issuance Confirmation", copiesKo: "원본 1부", copiesEn: "1 original" },
  { id: "cust-shareholder-list", nameKo: "전환 후 주주명부 (날인)", nameEn: "Post-conversion shareholder list (sealed)", copiesKo: "원본 1부", copiesEn: "1 original" },
  { id: "cust-registry", nameKo: "법인 등기부등본 (말소 포함)", nameEn: "Corporate Registry (incl. deleted)", copiesKo: "사본 또는 원본 1부", copiesEn: "1 copy or original" },
  { id: "cust-seal", nameKo: "법인 인감증명서", nameEn: "Corporate Seal Certificate", copiesKo: "원본 1부", copiesEn: "1 original" },
];

export const CONVERSION_INTERNAL_DOCS: ConversionDoc[] = [
  { id: "int-nonissuance", nameKo: "주식미발행확인서", nameEn: "Stock Non-Issuance Confirmation", copiesKo: "원본 1부", copiesEn: "1 original" },
  { id: "int-shareholder-list", nameKo: "전환 후 주주명부 (날인)", nameEn: "Post-conversion shareholder list (sealed)", copiesKo: "원본 1부", copiesEn: "1 original" },
  { id: "int-registry", nameKo: "법인 등기부등본 (말소 포함)", nameEn: "Corporate Registry (incl. deleted)", copiesKo: "원본 1부", copiesEn: "1 original" },
  { id: "int-seal", nameKo: "법인 인감증명서", nameEn: "Corporate Seal Certificate", copiesKo: "원본 1부", copiesEn: "1 original" },
  { id: "int-business-reg", nameKo: "사업자등록증", nameEn: "Business Registration Certificate", copiesKo: "사본 1부", copiesEn: "1 copy" },
  { id: "int-minutes", nameKo: "공증 (임시) 의사록", nameEn: "Notarized (temporary) minutes", copiesKo: "1부", copiesEn: "1 copy" },
];

// ---------------------------------------------------------------------------
// Deadlines and the share-conversion estimate
// ---------------------------------------------------------------------------

/**
 * Registration / document deadlines from an anchor date: ideal 2 weeks,
 * normal 20 days, maximum 30 days. Returns null for an unparseable date.
 */
export function conversionDeadlines(
  anchor: string,
): { ideal: Date; normal: Date; max: Date } | null {
  const base = new Date(anchor);
  if (Number.isNaN(base.getTime())) return null;

  const add = (days: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d;
  };

  return { ideal: add(14), normal: add(20), max: add(30) };
}

export type CalcMethod = "discount" | "cap";

export type CalcInput = {
  method: CalcMethod;
  /** SAFE investment amount (KRW). */
  amount: string;
  /** Follow-on round price per share. */
  roundPrice: string;
  /** Discount rate %, for the discount method. */
  discountPct: string;
  /** Valuation cap, for the cap method. */
  cap: string;
  /** Fully-diluted shares before the round, for the cap method. */
  preShares: string;
};

/**
 * A first-pass estimate of how many shares the SAFE converts into. NOT
 * authoritative — the real figure depends on the company's articles, options
 * and the exact contractual terms; this is a sanity-check aid only.
 */
export function estimateConversion(input: CalcInput): {
  conversionPrice: number | null;
  shares: number | null;
} {
  const num = (s: string) => {
    const n = parseFloat(s.replace(/[,\s₩]/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  const amount = num(input.amount);
  const roundPrice = num(input.roundPrice);
  if (!amount || !roundPrice) return { conversionPrice: null, shares: null };

  let conversionPrice: number | null = null;

  if (input.method === "discount") {
    const discount = num(input.discountPct) ?? 0;
    conversionPrice = roundPrice * (1 - discount / 100);
  } else {
    const cap = num(input.cap);
    const preShares = num(input.preShares);
    if (!cap || !preShares) return { conversionPrice: null, shares: null };
    const capPrice = cap / preShares;
    conversionPrice = Math.min(capPrice, roundPrice);
  }

  if (!conversionPrice || conversionPrice <= 0) {
    return { conversionPrice: null, shares: null };
  }

  return {
    conversionPrice,
    shares: Math.floor(amount / conversionPrice),
  };
}
