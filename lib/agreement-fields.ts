/**
 * The values a person fills in, and where each one lands in the contract.
 *
 * The template (templates/investment-agreement.docx) carries 77 tokens, but
 * they are not 77 questions - the share count appears in four places and the
 * signing date in ten. So a field maps to a LIST of tokens: type the number
 * once, and every place that quotes it is filled.
 *
 * Labels are taken from the contract's own wording rather than invented, so a
 * field can always be traced back to the clause it fills.
 *
 * The values in `fixed` fields are the ones the mentor standardised: 12%
 * 위약벌 and a 5-year 퇴사제한. They're editable, because a deal can depart
 * from the standard, but the screen says when they have.
 */

export type FieldKind = "text" | "number" | "money" | "words" | "percent" | "year";

export type AgreementField = {
  id: string;
  labelKo: string;
  labelEn: string;
  kind: FieldKind;
  /** Tokens in templates/investment-agreement.docx this value fills. */
  tokens: string[];
  /** Shown under the input - the clause this appears in. */
  hintKo?: string;
  hintEn?: string;
  /** Prefilled. For `standard` fields, departing from it is flagged. */
  default?: string;
  /** A term SparkLabs standardises; changing it is worth noticing. */
  standard?: boolean;
};

export type AgreementGroup = {
  id: string;
  titleKo: string;
  titleEn: string;
  fields: AgreementField[];
};

export const AGREEMENT_GROUPS: AgreementGroup[] = [
  {
    id: "dates",
    titleKo: "1. 날짜",
    titleEn: "1. Dates",
    fields: [
      {
        id: "signYear",
        labelKo: "체결일 — 연도",
        labelEn: "Signing date — year",
        kind: "year",
        // The template wrote 2026 as literal text, so this was never a
        // placeholder. Tokenised deliberately - otherwise every agreement is
        // stuck in 2026.
        tokens: ["f78", "f79", "f82", "f84", "f85"],
        default: "2026",
        hintKo: "표지·전문·서명란·별지2의 연도를 함께 바꿉니다",
        hintEn: "Changes the year on the cover, preamble, signature block and appendix 2",
      },
      {
        id: "signMonth",
        labelKo: "체결일 — 월",
        labelEn: "Signing date — month",
        kind: "number",
        // Cover, preamble, signature date, and both dates in 별지2.
        tokens: ["f4", "f6", "f55", "f72", "f70"],
        hintKo: "표지·전문·서명란·별지2에 함께 반영됩니다",
        hintEn: "Fills the cover, preamble, signature block and appendix 2",
      },
      {
        id: "signDay",
        labelKo: "체결일 — 일",
        labelEn: "Signing date — day",
        kind: "number",
        tokens: ["f3", "f5", "f54", "f71", "f69"],
      },
      {
        id: "paymentYear",
        labelKo: "납입기일 — 연도",
        labelEn: "Payment date — year",
        kind: "year",
        tokens: ["f80"],
        default: "2026",
      },
      {
        id: "paymentMonth",
        labelKo: "납입기일 — 월",
        labelEn: "Payment date — month",
        kind: "number",
        tokens: ["f28"],
        hintKo: "본건 종류주식의 납입기일",
        hintEn: "Payment date for the preferred shares",
      },
      {
        id: "paymentDay",
        labelKo: "납입기일 — 일",
        labelEn: "Payment date — day",
        kind: "number",
        tokens: ["f27"],
      },
      {
        id: "closingYear",
        labelKo: "거래완결 기한 — 연도",
        labelEn: "Closing deadline — year",
        kind: "year",
        tokens: ["f81"],
        default: "2026",
      },
      {
        id: "closingMonth",
        labelKo: "거래완결 기한 — 월",
        labelEn: "Closing deadline — month",
        kind: "number",
        tokens: ["f33"],
        hintKo: "이 날까지 완결되지 않으면 해제 사유가 됩니다",
        hintEn: "Missing this date is grounds for termination",
      },
      {
        id: "closingDay",
        labelKo: "거래완결 기한 — 일",
        labelEn: "Closing deadline — day",
        kind: "number",
        tokens: ["f32"],
      },
      {
        id: "financialsYear",
        labelKo: "재무제표 기준일 — 연도",
        labelEn: "Financial statements as of — year",
        kind: "year",
        // The template printed this as "202X년", so it always needed filling -
        // it just wasn't highlighted.
        tokens: ["f83"],
        hintKo: "원본 서식에는 '202X년'으로 비어 있었습니다",
        hintEn: "The template left this as '202X년'",
      },
      {
        id: "financialsMonth",
        labelKo: "재무제표 기준일 — 월",
        labelEn: "Financial statements as of — month",
        kind: "number",
        tokens: ["f68"],
        hintKo: "진술 및 보장의 기준이 되는 재무제표 일자",
        hintEn: "The financials the warranties are given against",
      },
      {
        id: "financialsDay",
        labelKo: "재무제표 기준일 — 일",
        labelEn: "Financial statements as of — day",
        kind: "number",
        tokens: ["f67"],
      },
    ],
  },

  {
    id: "investor",
    titleKo: "2. 투자자",
    titleEn: "2. Investor",
    fields: [
      {
        id: "investorName",
        labelKo: "투자자명",
        labelEn: "Investor name",
        kind: "text",
        tokens: ["f1", "f7", "f75"],
        hintKo: "표지·전문·별지2에 반영",
        hintEn: "Cover, preamble and appendix 2",
        default: "스파크랩 디스커버리펀드8호 개인투자조합",
      },
      {
        id: "investorAddress",
        labelKo: "투자자 주소",
        labelEn: "Investor address",
        kind: "text",
        tokens: ["f8"],
      },
      {
        id: "investorRep",
        labelKo: "투자자 대표자",
        labelEn: "Investor representative",
        kind: "text",
        tokens: ["f9"],
      },
    ],
  },

  {
    id: "fund",
    titleKo: "3. 조합 · 업무집행조합원",
    titleEn: "3. Fund & general partner",
    fields: [
      {
        id: "fundName",
        labelKo: "조합명",
        labelEn: "Fund name",
        kind: "text",
        tokens: ["f10", "f29"],
        hintKo: "계약서에서 '회사'로 표기된 두 번째 당사자 블록입니다 — 멘토님께 확인 필요",
        hintEn: "The second party block, labelled '회사' in the template — worth confirming",
        default: "스파크랩 디스커버리펀드8호 개인투자조합",
      },
      {
        id: "fundAddress",
        labelKo: "조합 주소",
        labelEn: "Fund address",
        kind: "text",
        tokens: ["f11"],
        default: "서울특별시 강남구 역삼로180, 3층(역삼동, 마루180)",
      },
      {
        id: "gpName",
        labelKo: "업무집행조합원",
        labelEn: "General partner",
        kind: "text",
        tokens: ["f12", "f56"],
        hintKo: "서명란에도 반영됩니다",
        hintEn: "Also fills the signature block",
        default: "주식회사 스파크랩",
      },
      {
        id: "gpAddress",
        labelKo: "업무집행조합원 주소",
        labelEn: "General partner address",
        kind: "text",
        tokens: ["f57"],
        default: "서울특별시 강남구 역삼로 180, 3층(역삼동, 마루180)",
      },
      {
        id: "gpRepLine",
        labelKo: "업무집행조합원 대표이사 (문구 전체)",
        labelEn: "GP representative (whole line)",
        kind: "text",
        tokens: ["f13"],
        hintKo: "이 줄은 전체가 치환됩니다 — '대표이사 : ' 를 포함해 입력하세요",
        hintEn: "This replaces the entire line, so include the '대표이사 : ' label",
        default: "대표이사 : 김유진",
      },
      {
        id: "gpRepName",
        labelKo: "업무집행조합원 대표자 (서명란)",
        labelEn: "GP representative (signature)",
        kind: "text",
        tokens: ["f58"],
        default: "김유진",
      },
    ],
  },

  {
    id: "company",
    titleKo: "4. 회사 (투자대상)",
    titleEn: "4. Company (investee)",
    fields: [
      {
        id: "companyName",
        labelKo: "회사명",
        labelEn: "Company name",
        kind: "text",
        tokens: ["f2", "f59", "f74"],
        hintKo: "표지·서명란·별지2에 반영",
        hintEn: "Cover, signature block and appendix 2",
      },
      {
        id: "companyAddress",
        labelKo: "회사 주소",
        labelEn: "Company address",
        kind: "text",
        tokens: ["f60"],
      },
      {
        id: "companyRep",
        labelKo: "회사 대표자",
        labelEn: "Company representative",
        kind: "text",
        tokens: ["f61"],
      },
    ],
  },

  {
    id: "interested",
    titleKo: "5. 이해관계인",
    titleEn: "5. Interested party",
    fields: [
      {
        id: "interestedName",
        labelKo: "이해관계인",
        labelEn: "Interested party",
        kind: "text",
        tokens: ["f14", "f62", "f73"],
        hintKo: "보통 대표자입니다. 대표자 외에 추가 이해관계인이 있으면 계약서 부수가 늘어납니다.",
        hintEn: "Usually the representative. Additional parties increase the number of copies.",
      },
      {
        id: "interestedAddress",
        labelKo: "이해관계인 주소",
        labelEn: "Interested party address",
        kind: "text",
        tokens: ["f15", "f63"],
      },
      {
        id: "interestedBirth",
        labelKo: "이해관계인 생년월일",
        labelEn: "Interested party date of birth",
        kind: "text",
        tokens: ["f16", "f64"],
      },
    ],
  },

  {
    id: "terms",
    titleKo: "6. 투자 조건",
    titleEn: "6. Investment terms",
    fields: [
      {
        id: "newShares",
        labelKo: "본건 종류주식 수 (전환우선주)",
        labelEn: "Preferred shares issued",
        kind: "number",
        tokens: ["f17", "f18", "f20", "f30"],
        hintKo: "계약서 4곳에 함께 반영됩니다",
        hintEn: "Fills four places in the contract",
      },
      {
        id: "existingShares",
        labelKo: "기 발행주식 총수 (보통주)",
        labelEn: "Existing common shares",
        kind: "number",
        tokens: ["f19", "f65"],
        hintKo: "제2조 및 진술·보장 조항",
        hintEn: "Article 2 and the warranties",
      },
      {
        id: "parValue",
        labelKo: "1주당 액면가액 (숫자)",
        labelEn: "Par value per share (figures)",
        kind: "money",
        tokens: ["f21", "f66"],
      },
      {
        id: "parValueWords",
        labelKo: "1주당 액면가액 (한글)",
        labelEn: "Par value per share (words)",
        kind: "words",
        tokens: ["f22"],
        hintKo: "예: 오천",
        hintEn: "e.g. 오천",
      },
      {
        id: "issuePrice",
        labelKo: "1주당 발행가액 (숫자)",
        labelEn: "Issue price per share (figures)",
        kind: "money",
        tokens: ["f23"],
      },
      {
        id: "issuePriceWords",
        labelKo: "1주당 발행가액 (한글)",
        labelEn: "Issue price per share (words)",
        kind: "words",
        tokens: ["f24"],
      },
      {
        id: "totalAmount",
        labelKo: "총 인수대금 (숫자)",
        labelEn: "Total subscription amount (figures)",
        kind: "money",
        tokens: ["f25", "f31"],
      },
      {
        id: "totalAmountWords",
        labelKo: "총 인수대금 (한글)",
        labelEn: "Total subscription amount (words)",
        kind: "words",
        tokens: ["f26"],
      },
      {
        id: "copies",
        labelKo: "계약서 부수",
        labelEn: "Number of copies",
        kind: "number",
        tokens: ["f53"],
        default: "3",
        hintKo: "기본 3부: 스파크랩·회사·대표자. 추가 이해관계인이 있으면 그만큼 늘립니다.",
        hintEn: "3 by default: SparkLabs, company, representative. Add one per extra interested party.",
      },
    ],
  },

  {
    id: "preferred",
    titleKo: "7. 우선주 조건 · 표준 조항",
    titleEn: "7. Preferred terms & standards",
    fields: [
      {
        id: "penaltyCompany",
        labelKo: "위약벌 — 회사 (%)",
        labelEn: "Liquidated damages — company (%)",
        kind: "percent",
        tokens: ["f41"],
        default: "12",
        standard: true,
        hintKo: "스파크랩 표준 12%",
        hintEn: "SparkLabs standard is 12%",
      },
      {
        id: "penaltyInterested",
        labelKo: "위약벌 — 이해관계인 (%)",
        labelEn: "Liquidated damages — interested party (%)",
        kind: "percent",
        tokens: ["f42"],
        default: "12",
        standard: true,
        hintKo: "스파크랩 표준 12%",
        hintEn: "SparkLabs standard is 12%",
      },
      {
        id: "resignYears",
        labelKo: "퇴사제한 기간 (년)",
        labelEn: "Employment restriction (years)",
        kind: "number",
        tokens: ["f77"],
        default: "5",
        standard: true,
        hintKo: "스파크랩 표준 5년",
        hintEn: "SparkLabs standard is 5 years",
      },
      {
        id: "ipoResignYears",
        labelKo: "상장 후 퇴사제한 해제 (년)",
        labelEn: "Restriction lifted after listing (years)",
        kind: "number",
        tokens: ["f76"],
        default: "1",
      },
      {
        id: "dividendRate",
        labelKo: "우선배당률 (%)",
        labelEn: "Preferred dividend rate (%)",
        kind: "percent",
        tokens: ["f34"],
        default: "1",
      },
      {
        id: "lateDividendRate",
        labelKo: "배당금 지연배상 이율 (%)",
        labelEn: "Late dividend interest (%)",
        kind: "percent",
        tokens: ["f35"],
        default: "15",
      },
      {
        id: "liquidationRate",
        labelKo: "잔여재산 분배 이율 (%)",
        labelEn: "Liquidation preference rate (%)",
        kind: "percent",
        tokens: ["f36"],
        default: "2",
      },
      {
        id: "ipoConversionPct",
        labelKo: "IPO 전환비율 조정 기준 (%)",
        labelEn: "IPO conversion adjustment (%)",
        kind: "percent",
        tokens: ["f37"],
        default: "70",
      },
      {
        id: "maConversionPct",
        labelKo: "M&A 전환가액 조정 기준 (%)",
        labelEn: "M&A conversion adjustment (%)",
        kind: "percent",
        tokens: ["f38"],
        default: "70",
      },
      {
        id: "buybackInterest",
        labelKo: "주식매수 시 연복리 (%)",
        labelEn: "Buyback compound interest (%)",
        kind: "percent",
        tokens: ["f40"],
        default: "12",
      },
      {
        id: "buybackLookbackYears",
        labelKo: "주식매수 단가 산정 기간 (년)",
        labelEn: "Buyback price lookback (years)",
        kind: "number",
        tokens: ["f39"],
        default: "1",
      },
    ],
  },

  {
    id: "notices",
    titleKo: "8. 통지 수신처",
    titleEn: "8. Notices",
    fields: [
      {
        id: "noticeInvestorTo",
        labelKo: "투자자 — 수신인",
        labelEn: "Investor — recipient",
        kind: "text",
        tokens: ["f43"],
      },
      {
        id: "noticeInvestorAddress",
        labelKo: "투자자 — 주소",
        labelEn: "Investor — address",
        kind: "text",
        tokens: ["f44"],
        default: "서울특별시 강남구 역삼로180, 3층(역삼동, 마루180)",
      },
      {
        id: "noticeCompanyTo",
        labelKo: "회사 — 수신인",
        labelEn: "Company — recipient",
        kind: "text",
        tokens: ["f45"],
      },
      {
        id: "noticeCompanyAddress",
        labelKo: "회사 — 주소",
        labelEn: "Company — address",
        kind: "text",
        tokens: ["f46"],
      },
      {
        id: "noticeCompanyPhone",
        labelKo: "회사 — 전화",
        labelEn: "Company — phone",
        kind: "text",
        tokens: ["f47"],
      },
      {
        id: "noticeCompanyEmail",
        labelKo: "회사 — 이메일",
        labelEn: "Company — email",
        kind: "text",
        tokens: ["f48"],
      },
      {
        id: "noticeInterestedTo",
        labelKo: "이해관계인 — 수신인",
        labelEn: "Interested party — recipient",
        kind: "text",
        tokens: ["f49"],
      },
      {
        id: "noticeInterestedAddress",
        labelKo: "이해관계인 — 주소",
        labelEn: "Interested party — address",
        kind: "text",
        tokens: ["f50"],
      },
      {
        id: "noticeInterestedPhone",
        labelKo: "이해관계인 — 전화",
        labelEn: "Interested party — phone",
        kind: "text",
        tokens: ["f51"],
      },
      {
        id: "noticeInterestedEmail",
        labelKo: "이해관계인 — 이메일",
        labelEn: "Interested party — email",
        kind: "text",
        tokens: ["f52"],
      },
    ],
  },
];

export const ALL_FIELDS: AgreementField[] = AGREEMENT_GROUPS.flatMap(
  (group) => group.fields,
);

/**
 * Which field fills a given token - the reverse of `field.tokens`.
 *
 * The screen needs this to answer "what goes here?" when looking at a slot in
 * the contract, where the field list answers "where does this go?".
 */
export const FIELD_BY_TOKEN: Record<string, AgreementField> = Object.fromEntries(
  ALL_FIELDS.flatMap((field) => field.tokens.map((token) => [token, field])),
);

/** Values keyed by field id, as typed. */
export type AgreementValues = Record<string, string>;

export function defaultValues(): AgreementValues {
  const values: AgreementValues = {};
  for (const field of ALL_FIELDS) {
    if (field.default) values[field.id] = field.default;
  }
  return values;
}

/**
 * Expands field values into the token replacements the template needs.
 *
 * A field with no value leaves its tokens alone, so an unfinished contract shows
 * {{f12}} where something is missing rather than a blank that reads as
 * deliberate. A blank in a legal document is far worse than a visible gap.
 */
export function tokenValues(values: AgreementValues): Record<string, string> {
  const out: Record<string, string> = {};

  for (const field of ALL_FIELDS) {
    const value = values[field.id]?.trim();
    if (!value) continue;

    for (const token of field.tokens) out[token] = value;
  }

  return out;
}

/** Fields still empty - the screen uses this to say what's outstanding. */
export function missingFields(values: AgreementValues): AgreementField[] {
  return ALL_FIELDS.filter((field) => !values[field.id]?.trim());
}

/** Standardised terms that have been changed away from the house position. */
export function departsFromStandard(values: AgreementValues): AgreementField[] {
  return ALL_FIELDS.filter(
    (field) =>
      field.standard && field.default && (values[field.id]?.trim() ?? "") !== field.default,
  );
}
