/**
 * 투자 집행: what happens after the contract is signed.
 *
 * Source: the mentor's "#5. 투자금 납입 (운용지시)" and "#6. 투자납입 후"
 * documents. The rest of the app stops at a signed agreement; this covers the
 * two stages that follow —
 *
 *   1. 운용지시 — instructing the bank to pay the investment out. The exact
 *      document set depends on the fund type (모태펀드 vs 민간펀드) and whether
 *      the company is domestic or overseas.
 *
 *   2. 투자납입 후 — collecting the documents the company must return after
 *      payment, against a hard deadline: originals must reach the custodian
 *      bank (수탁은행) within 30 days, so the target is 20. The set depends on
 *      whether it is a new-share issuance or a SAFE.
 *
 * The source is Korean; the English is a translation kept beside it. Where they
 * disagree, the Korean is authoritative.
 */

import type { Market } from "./documents";

/** 모태펀드 (fund-of-funds, i.e. government) vs 민간펀드 (private). */
export type FundType = "mother" | "private";

/** 신주발행 (new share issuance) vs 조건부지분인수계약 (SAFE). */
export type InvestmentStructure = "new-shares" | "safe";

export const FUND_TYPES: { value: FundType; ko: string; en: string }[] = [
  { value: "private", ko: "민간펀드", en: "Private fund" },
  { value: "mother", ko: "모태펀드", en: "Fund-of-funds (모태)" },
];

export const INVESTMENT_STRUCTURES: {
  value: InvestmentStructure;
  ko: string;
  en: string;
}[] = [
  { value: "new-shares", ko: "신주발행", en: "New share issuance" },
  { value: "safe", ko: "조건부지분인수계약 (SAFE)", en: "SAFE" },
];

/**
 * Where a returned document must go after collection (from #6-D):
 *  - "custodian": passed via 경영지원본부 to the 수탁은행 for the share deposit
 *  - "internal": kept in SparkLabs' own file
 * Left undefined where the source document doesn't route it explicitly.
 */
export type DocDestination = "custodian" | "internal";

export type ExecutionDoc = {
  id: string;
  nameKo: string;
  nameEn: string;
  /** Format requirement, e.g. 날인본 / 원본. */
  noteKo?: string;
  noteEn?: string;
  destination?: DocDestination;
};

export const DESTINATION_LABEL: Record<DocDestination, { ko: string; en: string }> = {
  custodian: { ko: "수탁은행", en: "Custodian bank" },
  internal: { ko: "내부보관", en: "Internal" },
};

// ---------------------------------------------------------------------------
// #5 운용지시 서류 — by market + fund type
// ---------------------------------------------------------------------------

const OI_DOMESTIC_MOTHER: ExecutionDoc[] = [
  { id: "oi-instruction", nameKo: "운용지시서", nameEn: "Operating instruction", noteKo: "날인본", noteEn: "Sealed" },
  { id: "oi-minutes", nameKo: "투자심의위원회의사록", nameEn: "Investment committee minutes", noteKo: "날인본", noteEn: "Sealed" },
  { id: "oi-business-reg", nameKo: "사업자등록증", nameEn: "Business registration certificate" },
  { id: "oi-shareholder-registry", nameKo: "주주명부", nameEn: "Shareholder registry" },
  { id: "oi-bankbook", nameKo: "통장사본", nameEn: "Bank account copy" },
  { id: "oi-contract", nameKo: "투자계약서", nameEn: "Investment agreement", noteKo: "날인본", noteEn: "Sealed" },
  { id: "oi-compliance", nameKo: "준법사항 체크리스트", nameEn: "Compliance checklist" },
  { id: "oi-mandatory-fields", nameKo: "의무기재사항 확인서", nameEn: "Mandatory disclosures confirmation" },
];

const OI_DOMESTIC_PRIVATE: ExecutionDoc[] = [
  { id: "oi-instruction", nameKo: "운용지시서", nameEn: "Operating instruction", noteKo: "날인본", noteEn: "Sealed" },
  { id: "oi-minutes", nameKo: "투자심의위원회의사록", nameEn: "Investment committee minutes", noteKo: "날인본", noteEn: "Sealed" },
  { id: "oi-business-reg", nameKo: "사업자등록증", nameEn: "Business registration certificate" },
  { id: "oi-shareholder-registry", nameKo: "주주명부", nameEn: "Shareholder registry" },
  { id: "oi-bankbook", nameKo: "통장사본", nameEn: "Bank account copy" },
  { id: "oi-contract", nameKo: "투자계약서", nameEn: "Investment agreement", noteKo: "날인본", noteEn: "Sealed" },
  { id: "oi-prelim-dd", nameKo: "예비실사 체크리스트 서명본", nameEn: "Preliminary DD checklist (signed)" },
];

const OI_OVERSEAS: ExecutionDoc[] = [
  { id: "oi-securities-acq", nameKo: "증권취득신고서", nameEn: "Securities acquisition report", noteKo: "한국은행 접수본 (수탁은행 날인 전)", noteEn: "As accepted by BOK, before custodian seal" },
  { id: "oi-instruction", nameKo: "운용지시서", nameEn: "Operating instruction", noteKo: "날인본", noteEn: "Sealed" },
  { id: "oi-fx-remittance", nameKo: "외화송금신청서", nameEn: "Foreign currency remittance application" },
  { id: "oi-minutes", nameKo: "투자심의위원회의사록", nameEn: "Investment committee minutes", noteKo: "날인본", noteEn: "Sealed" },
  { id: "oi-coi", nameKo: "COI", nameEn: "Certificate of Incorporation" },
  { id: "oi-wiring-info", nameKo: "송금정보", nameEn: "Wiring information" },
  { id: "oi-contract", nameKo: "투자계약서", nameEn: "Investment agreement", noteKo: "날인본", noteEn: "Sealed" },
];

// ---------------------------------------------------------------------------
// #6 투자납입 후 서류 — by structure + market
// ---------------------------------------------------------------------------

const POST_NEWSHARES_DOMESTIC: ExecutionDoc[] = [
  { id: "post-unissued-cert", nameKo: "주식미발행확인서", nameEn: "Certificate of unissued shares", noteKo: "원본", noteEn: "Original", destination: "custodian" },
  { id: "post-shareholder-registry", nameKo: "주주명부", nameEn: "Shareholder registry", noteKo: "원본", noteEn: "Original", destination: "custodian" },
  { id: "post-corporate-seal", nameKo: "법인 인감증명서", nameEn: "Corporate seal certificate", noteKo: "원본", noteEn: "Original", destination: "custodian" },
  { id: "post-corporate-registry", nameKo: "법인 등기부등본", nameEn: "Corporate registry extract", noteKo: "원본", noteEn: "Original", destination: "custodian" },
  { id: "post-balance-cert", nameKo: "통장 잔액증명서", nameEn: "Bank balance certificate", noteKo: "사본 또는 원본 · 내부보관", noteEn: "Copy or original · kept internally", destination: "internal" },
];

const POST_NEWSHARES_OVERSEAS: ExecutionDoc[] = [
  { id: "post-stock-certificate", nameKo: "Stock Certificate", nameEn: "Stock Certificate" },
  { id: "post-coi", nameKo: "Certificate of Incorporation", nameEn: "Certificate of Incorporation" },
  { id: "post-business-profile", nameKo: "Business Registration / Business Profile", nameEn: "Business Registration / Business Profile" },
  { id: "post-balance-cert", nameKo: "Bank Account Balance Certificate", nameEn: "Bank Account Balance Certificate" },
  { id: "post-shareholder-list", nameKo: "Shareholder List", nameEn: "Shareholder List", noteKo: "펀드명으로 SparkLabs 기재", noteEn: "SparkLabs written in name of fund" },
];

const POST_SAFE_DOMESTIC: ExecutionDoc[] = [
  { id: "post-receipt", nameKo: "투자금 수령 영수증", nameEn: "Receipt of investment", noteKo: "원본 · 주식미발행확인서 대신", noteEn: "Original · replaces the unissued-shares certificate", destination: "custodian" },
  { id: "post-corporate-seal", nameKo: "법인 인감증명서", nameEn: "Corporate seal certificate", noteKo: "원본", noteEn: "Original", destination: "custodian" },
  { id: "post-business-reg", nameKo: "사업자등록증", nameEn: "Business registration certificate", noteKo: "사본", noteEn: "Copy" },
  { id: "post-balance-cert", nameKo: "통장 잔액증명서", nameEn: "Bank balance certificate", noteKo: "사본 또는 원본", noteEn: "Copy or original", destination: "internal" },
  { id: "post-cap-table", nameKo: "투자 후 Cap Table", nameEn: "Post-investment cap table", noteKo: "투자금액·주식종류 포함 엑셀", noteEn: "Excel incl. amount and share class" },
];

const POST_SAFE_OVERSEAS: ExecutionDoc[] = [
  { id: "post-receipt", nameKo: "Receipt of Investment", nameEn: "Receipt of Investment" },
  { id: "post-coi", nameKo: "Certificate of Incorporation", nameEn: "Certificate of Incorporation" },
  { id: "post-business-profile", nameKo: "Business Registration / Business Profile", nameEn: "Business Registration / Business Profile" },
  { id: "post-balance-cert", nameKo: "Bank Account Balance Certificate", nameEn: "Bank Account Balance Certificate" },
  { id: "post-investment-list", nameKo: "Investment List", nameEn: "Investment List", noteKo: "펀드명으로 SparkLabs 기재", noteEn: "SparkLabs written in name of fund" },
];

// ---------------------------------------------------------------------------

/** Overseas deals can only run on a private fund - 모태 is not available. */
export function fundTypeAllowed(market: Market, fundType: FundType): boolean {
  return market === "overseas" ? fundType === "private" : true;
}

/** The 운용지시 document set for a deal's market and fund type. */
export function operatingInstructionDocs(
  market: Market,
  fundType: FundType,
): ExecutionDoc[] {
  if (market === "overseas") return OI_OVERSEAS;
  return fundType === "mother" ? OI_DOMESTIC_MOTHER : OI_DOMESTIC_PRIVATE;
}

/** The 투자납입 후 document set for a deal's structure and market. */
export function postPaymentDocs(
  market: Market,
  structure: InvestmentStructure,
): ExecutionDoc[] {
  if (structure === "safe") {
    return market === "overseas" ? POST_SAFE_OVERSEAS : POST_SAFE_DOMESTIC;
  }
  return market === "overseas" ? POST_NEWSHARES_OVERSEAS : POST_NEWSHARES_DOMESTIC;
}

/**
 * From the payment date, when the returned documents are due.
 *
 * Originals must reach the custodian bank within 30 days of payment, so 30 is
 * the hard deadline and 20 the working target the mentor sets. Returns null for
 * an unparseable or empty date.
 */
export function postPaymentDeadlines(
  paymentDate: string,
): { target: Date; hard: Date } | null {
  const base = new Date(paymentDate);
  if (Number.isNaN(base.getTime())) return null;

  const target = new Date(base);
  target.setDate(target.getDate() + 20);

  const hard = new Date(base);
  hard.setDate(hard.getDate() + 30);

  return { target, hard };
}
