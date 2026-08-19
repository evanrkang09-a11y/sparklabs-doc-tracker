/**
 * The values that fill the SAFE (조건부지분인수계약서) template, and the tokens
 * each one lands in.
 *
 * The template (templates/safe-agreement.docx) was tokenised by
 * scripts-style verification (each {{sN}} was placed at a blank matched by its
 * unique surrounding text, and the placement was verified to occur exactly
 * once). Tokens s1–s15 correspond to the fields below.
 *
 * Draft — the mentor should review the first generated SAFE .docx before it is
 * used for a real deal. Signature-block cells and appendix boilerplate are left
 * to fill by hand, since they can't be anchored unambiguously.
 */

import type { AgreementGroup } from "./agreement-fields";

export const SAFE_GROUPS: AgreementGroup[] = [
  {
    id: "safe-parties",
    titleKo: "1. 당사자",
    titleEn: "1. Parties",
    fields: [
      {
        id: "investorName",
        labelKo: "투자자 (조합)",
        labelEn: "Investor (fund)",
        kind: "text",
        tokens: ["s1"],
        default: "스파크랩 테크 퍼스트 스텝 투자조합",
        hintKo: "전문의 투자자 표기",
        hintEn: "The investor named in the preamble",
      },
      {
        id: "companyName",
        labelKo: "회사명",
        labelEn: "Company name",
        kind: "text",
        tokens: ["s2"],
        hintKo: "전문의 '회사' 표기",
        hintEn: "The company named in the preamble",
      },
    ],
  },
  {
    id: "safe-terms",
    titleKo: "2. 투자 조건",
    titleEn: "2. Investment terms",
    fields: [
      {
        id: "valuationCap",
        labelKo: "가치한도 (원)",
        labelEn: "Valuation cap (KRW)",
        kind: "money",
        tokens: ["s3"],
        hintKo: "가치한도 및 할인율 표시 — 금 [ ] 원",
        hintEn: "The valuation cap in the cap/discount box",
      },
      {
        id: "discountRate",
        labelKo: "할인율 (%)",
        labelEn: "Discount rate (%)",
        kind: "percent",
        tokens: ["s4"],
      },
      {
        id: "discountExtendedYears",
        labelKo: "할인율 적용 기준 기간 (년)",
        labelEn: "Discount timeline (years)",
        kind: "number",
        tokens: ["s5"],
        default: "1",
        hintKo: "후속투자가 지급일로부터 이 기간 이후일 때 다른 할인율 적용",
        hintEn: "If the follow-on is after this many years, the extended discount applies",
      },
      {
        id: "discountExtendedRate",
        labelKo: "기간 초과 시 할인율 (%)",
        labelEn: "Extended discount rate (%)",
        kind: "percent",
        tokens: ["s6"],
      },
      {
        id: "investmentAmount",
        labelKo: "투자금 (원)",
        labelEn: "Investment amount (KRW)",
        kind: "money",
        tokens: ["s7"],
        hintKo: "제2조 투자금 — 금 [ ]원 (₩[ ])",
        hintEn: "The investment amount in Article 2",
      },
      {
        id: "accountHolder",
        labelKo: "입금계좌 예금주",
        labelEn: "Deposit account holder",
        kind: "text",
        tokens: ["s8"],
      },
    ],
  },
  {
    id: "safe-standards",
    titleKo: "3. 표준 조항",
    titleEn: "3. Standard terms",
    fields: [
      {
        id: "useOfFunds",
        labelKo: "투자금 사용목적",
        labelEn: "Use of funds",
        kind: "text",
        tokens: ["s9"],
        default: "[인력의 충원], [연구 개발], [마케팅 비용]",
        hintKo: "제5조 ①의 사용목적 문구 전체",
        hintEn: "The whole use-of-funds line in Article 5(1)",
      },
      {
        id: "penaltyLate",
        labelKo: "지연 시 연복리 (%)",
        labelEn: "Late-refund compound interest (%)",
        kind: "percent",
        tokens: ["s10"],
        default: "12",
        standard: true,
        hintKo: "스파크랩 표준 12%",
        hintEn: "SparkLabs standard is 12%",
      },
      {
        id: "penaltyBreach",
        labelKo: "위약벌 (%)",
        labelEn: "Liquidated damages (%)",
        kind: "percent",
        tokens: ["s11"],
        default: "12",
        standard: true,
        hintKo: "스파크랩 표준 12%",
        hintEn: "SparkLabs standard is 12%",
      },
      {
        id: "damages",
        labelKo: "손해배상 기준 (%)",
        labelEn: "Damages basis (%)",
        kind: "percent",
        tokens: ["s12"],
        default: "120",
        standard: true,
        hintKo: "스파크랩 표준 120%",
        hintEn: "SparkLabs standard is 120%",
      },
    ],
  },
  {
    id: "safe-sign-investor",
    titleKo: "4. 서명란 — 투자자",
    titleEn: "4. Signature block — investor",
    fields: [
      {
        id: "invSigCompany",
        labelKo: "투자자 — 조합/회사명",
        labelEn: "Investor — name",
        kind: "text",
        tokens: ["s16"],
        default: "스파크랩 테크 퍼스트 스텝 투자조합",
      },
      { id: "invSigAddress", labelKo: "투자자 — 주소", labelEn: "Investor — address", kind: "text", tokens: ["s17"] },
      { id: "invSigBizNo", labelKo: "투자자 — 사업자등록번호", labelEn: "Investor — business reg. no.", kind: "text", tokens: ["s18"] },
      { id: "invSigPhone", labelKo: "투자자 — 전화", labelEn: "Investor — phone", kind: "text", tokens: ["s19"] },
    ],
  },
  {
    id: "safe-sign-company",
    titleKo: "5. 서명란 — 회사",
    titleEn: "5. Signature block — company",
    fields: [
      { id: "coSigCompany", labelKo: "회사 — 회사명", labelEn: "Company — name", kind: "text", tokens: ["s20"] },
      { id: "coSigAddress", labelKo: "회사 — 주소", labelEn: "Company — address", kind: "text", tokens: ["s21"] },
      { id: "coSigBizNo", labelKo: "회사 — 사업자등록번호", labelEn: "Company — business reg. no.", kind: "text", tokens: ["s22"] },
      { id: "coSigPhone", labelKo: "회사 — 전화", labelEn: "Company — phone", kind: "text", tokens: ["s23"] },
    ],
  },
  {
    id: "safe-appendix",
    titleKo: "6. 별지3 — 경업금지",
    titleEn: "6. Appendix 3 — non-compete",
    fields: [
      {
        id: "noncompeteYears",
        labelKo: "경업금지 기간 (년)",
        labelEn: "Non-compete period (years)",
        kind: "number",
        tokens: ["s24"],
        default: "2",
        standard: true,
        hintKo: "재직·퇴사 후 경업금지 기간 (2곳)",
        hintEn: "Applies in both non-compete clauses",
      },
      {
        id: "noncompletePenalty",
        labelKo: "경업 위반 위약벌 (원)",
        labelEn: "Non-compete breach penalty (KRW)",
        kind: "money",
        tokens: ["s25"],
        default: "50,000,000",
        standard: true,
      },
      {
        id: "resignPenalty",
        labelKo: "퇴사제한 위반 위약벌 (원)",
        labelEn: "Early-resignation penalty (KRW)",
        kind: "money",
        tokens: ["s26"],
        hintKo: "별지3 I. 퇴사제한 위반 시 위약벌",
        hintEn: "Appendix 3 §I early-resignation penalty",
      },
    ],
  },
  {
    id: "safe-date",
    titleKo: "7. 체결일",
    titleEn: "7. Signing date",
    fields: [
      {
        id: "signYear",
        labelKo: "체결일 — 연도",
        labelEn: "Signing date — year",
        kind: "year",
        tokens: ["s13"],
        default: "2026",
      },
      {
        id: "signMonth",
        labelKo: "체결일 — 월",
        labelEn: "Signing date — month",
        kind: "number",
        tokens: ["s14"],
      },
      {
        id: "signDay",
        labelKo: "체결일 — 일",
        labelEn: "Signing date — day",
        kind: "number",
        tokens: ["s15"],
      },
    ],
  },
];
