/**
 * The documents a company must submit before investment, and the logic for
 * working out which document a given filename represents.
 *
 * Source: the mentor's "투자 전 제출 서류 리스트" (#2-A 투자 검토 프로세스).
 * There are two separate lists - one for Korean companies, one for overseas -
 * and they are genuinely different, not translations of each other.
 *
 * This is the single source of truth for the whole app. To change what the
 * tracker asks for, edit this file and nothing else.
 */

export type Market = "domestic" | "overseas";

export type RequiredDocument = {
  id: string;
  nameKo: string;
  nameEn: string;
  /** Format requirements from the source list, e.g. [원본대조필]. */
  note?: string;
  /** The same note in English. Falls back to `note` when absent. */
  noteEn?: string;
  /** Optional / "해당 시" documents don't count toward the missing total. */
  optional?: boolean;
  /**
   * Filename fragments that identify this document. A document often has more
   * than one name in practice - 등기부등본 and 등기사항전부증명서 are the same
   * thing - so list every name you have actually seen.
   */
  keywords: string[];
};

// ---------------------------------------------------------------------------
// 국내 기업 / Korean companies
// ---------------------------------------------------------------------------

export const DOMESTIC_DOCUMENTS: RequiredDocument[] = [
  {
    id: "ir-deck",
    nameKo: "최신 사업소개서 (IR덱)",
    nameEn: "Latest IR Deck",
    note: "PDF 형식",
    noteEn: "PDF format",
    keywords: ["사업소개서", "회사소개서", "irdeck", "ir덱", "ir자료", "pitchdeck"],
  },
  {
    id: "business-registration",
    nameKo: "사업자등록증",
    nameEn: "Business Registration Certificate",
    note: "원본대조필",
    noteEn: "Certified true copy",
    keywords: ["사업자등록", "businessregistration"],
  },
  {
    id: "corporate-registry",
    nameKo: "등기부등본",
    nameEn: "Corporate Registry Extract",
    note: "원본, 말소사항 포함",
    noteEn: "Original, including cancelled entries",
    keywords: [
      "등기사항전부증명서",
      "등기사항증명서",
      "등기부등본",
      "등기부",
      "corporateregistry",
    ],
  },
  {
    id: "articles-of-incorporation",
    nameKo: "정관",
    nameEn: "Articles of Incorporation",
    note: "원본대조필",
    noteEn: "Certified true copy",
    keywords: ["정관", "articlesofincorporation"],
  },
  {
    id: "corporate-seal",
    nameKo: "법인 인감증명서",
    nameEn: "Corporate Seal Certificate",
    note: "원본",
    noteEn: "Original",
    keywords: ["인감증명", "법인인감", "corporateseal"],
  },
  {
    id: "shareholder-registry",
    nameKo: "주주명부",
    nameEn: "Shareholder Registry",
    keywords: ["주주명부", "shareholderregistry", "shareholderlist"],
  },
  {
    id: "social-insurance",
    nameKo: "4대보험 가입자명부",
    nameEn: "Social Insurance Enrollment List",
    note: "원본대조필",
    noteEn: "Certified true copy",
    keywords: ["4대보험", "사대보험", "socialinsurance"],
  },
  {
    id: "stock-options",
    nameKo: "스톡옵션 수여자 명단 및 상세",
    nameEn: "Stock Option Grantee List",
    note: "성명·생년월일·자격·부여방법·행사가격·부여주식수·행사가능기간",
    noteEn: "Name, DOB, eligibility, grant method, exercise price, shares granted, exercise window",
    keywords: ["스톡옵션", "주식매수선택권", "stockoption"],
  },
  {
    id: "bank-account",
    nameKo: "법인 통장사본",
    nameEn: "Corporate Bank Account Copy",
    note: "투자금 납입용",
    noteEn: "For receiving the investment",
    keywords: ["통장사본", "법인통장", "bankaccount", "bankbook"],
  },
  {
    id: "bank-balance",
    nameKo: "통장잔액증명서",
    nameEn: "Bank Balance Certificate",
    keywords: ["잔액증명", "통장잔액", "balancecertificate"],
  },
  {
    id: "financial-statements",
    nameKo: "재무제표",
    nameEn: "Financial Statements",
    note: "전기·당기 포함",
    noteEn: "Prior and current year",
    keywords: ["재무제표", "감사보고서", "financialstatement"],
  },
  {
    id: "loans-and-advances",
    nameKo: "가수금 / 차입금 상세",
    nameEn: "Director Advances & Borrowings Detail",
    keywords: ["가수금", "차입금", "가지급금"],
  },
  {
    id: "key-personnel-cv",
    nameKo: "대표자 및 주요 인력 이력서",
    nameEn: "CEO & Key Personnel CVs",
    keywords: ["이력서", "약력", "cv", "resume"],
  },
  {
    id: "revenue-forecast",
    nameKo: "매출 추정 (향후 5개년)",
    nameEn: "Revenue Forecast (5 years)",
    note: "Excel로 작성",
    noteEn: "Written in Excel",
    keywords: ["매출추정", "매출전망", "revenueforecast", "매출계획"],
  },
  {
    id: "ceo-id",
    nameKo: "대표자 신분증 및 주민등록등본",
    nameEn: "CEO ID & Resident Registration",
    note: "사본",
    noteEn: "Photocopy",
    keywords: ["신분증", "주민등록등본", "주민등록초본"],
  },
  {
    id: "shareholders-agreement",
    nameKo: "주주간 계약서",
    nameEn: "Shareholders' Agreement",
    note: "지정 양식 참조",
    noteEn: "Use the designated template",
    keywords: ["주주간계약", "주주간협약", "shareholdersagreement"],
  },
  {
    id: "other-entities",
    nameKo: "대표자의 타 법인 / 개인사업자 보유여부",
    nameEn: "CEO's Other Business Entities",
    keywords: ["타법인", "법인사업자보유", "개인사업자보유", "겸직"],
  },
  {
    id: "tax-clearance",
    nameKo: "법인 및 대표자 납세증명서",
    nameEn: "Tax Payment Certificates",
    keywords: ["납세증명", "국세완납", "지방세납세"],
  },

  // ----- 해당 시 제출 / only if applicable -----
  {
    id: "venture-certificate",
    nameKo: "벤처기업확인증 / 중소기업확인서 / 창업기업확인서",
    nameEn: "Venture / SME / Startup Certificate",
    note: "해당 시 · LP 세제혜택 관련",
    noteEn: "If applicable - relates to LP tax benefits",
    optional: true,
    keywords: ["벤처기업확인", "중소기업확인", "창업기업확인"],
  },
  {
    id: "patents",
    nameKo: "특허 등록 또는 출원서",
    nameEn: "Patent Registrations / Applications",
    note: "해당 시",
    noteEn: "If applicable",
    optional: true,
    keywords: ["특허", "patent"],
  },
  {
    id: "trademarks",
    nameKo: "상표 등록 또는 출원서",
    nameEn: "Trademark Registrations / Applications",
    note: "해당 시",
    noteEn: "If applicable",
    optional: true,
    keywords: ["상표", "trademark"],
  },
];

// ---------------------------------------------------------------------------
// 해외 기업 / Overseas companies
// ---------------------------------------------------------------------------

export const OVERSEAS_DOCUMENTS: RequiredDocument[] = [
  {
    id: "intro-deck",
    nameKo: "최신 회사소개서 / IR 자료",
    nameEn: "Latest Company Intro Deck (IR Deck)",
    keywords: ["introdeck", "irdeck", "pitchdeck", "회사소개서", "사업소개서"],
  },
  {
    id: "certificate-of-incorporation",
    nameKo: "법인 설립 인증서",
    nameEn: "Certificate of Incorporation",
    keywords: ["certificateofincorporation", "incorporation", "사업자등록"],
  },
  {
    id: "bylaws",
    nameKo: "정관",
    nameEn: "Articles of Incorporation (Bylaws)",
    keywords: ["articlesofincorporation", "bylaws", "정관"],
  },
  {
    id: "financial-statements",
    nameKo: "재무제표 / 현금흐름표",
    nameEn: "Financial Statements",
    note: "Balance Sheet, Income / Cashflow / Changes in Equity",
    keywords: ["financialstatement", "balancesheet", "cashflow", "재무제표"],
  },
  {
    id: "wiring-info",
    nameKo: "통장사본 (송금정보)",
    nameEn: "Wiring Info",
    keywords: ["wiringinfo", "wireinstructions", "bankdetails", "통장사본"],
  },
  {
    id: "cap-table",
    nameKo: "자본구성표",
    nameEn: "Capitalization Table",
    keywords: ["captable", "capitalizationtable", "자본구성표"],
  },
  {
    id: "shareholder-list",
    nameKo: "주주명부",
    nameEn: "Shareholder List",
    note: "신주발행 투자 및 SAFE 투자자 모두 포함",
    noteEn: "Include both new-share and SAFE investors",
    keywords: ["shareholderlist", "shareholderregistry", "주주명부"],
  },
  {
    id: "ceo-id",
    nameKo: "대표자 신분증 사본",
    nameEn: "CEO ID (Passport or Driver's License)",
    keywords: ["passport", "driverslicense", "ceoid", "신분증", "여권"],
  },
  {
    id: "founder-cv",
    nameKo: "대표자 및 핵심인력 이력서",
    nameEn: "CEO & Co-Founder's CV",
    keywords: ["cv", "resume", "이력서"],
  },
  {
    id: "revenue-forecast",
    nameKo: "매출 추정 (향후 5개년)",
    nameEn: "Revenue Forecast (5 years)",
    keywords: ["revenueforecast", "매출추정", "forecast"],
  },
  {
    id: "ip-filings",
    nameKo: "특허 / 상표 등록 또는 출원서",
    nameEn: "Patent or Trademark Registrations / Applications",
    note: "If applicable",
    optional: true,
    keywords: ["patent", "trademark", "특허", "상표"],
  },
];

// ---------------------------------------------------------------------------

export function documentsFor(market: Market): RequiredDocument[] {
  return market === "overseas" ? OVERSEAS_DOCUMENTS : DOMESTIC_DOCUMENTS;
}

/**
 * Strip out the things that vary between filenames but carry no meaning -
 * spaces, underscores, hyphens, capitalisation - so that
 * "Business_Registration.pdf" and "business registration.pdf" both match.
 */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s_\-().]/g, "");
}

/**
 * Work out which document a filename refers to, within one market's list.
 * Returns null if we don't recognise it.
 */
export function matchDocument(
  filename: string,
  market: Market = "domestic",
): RequiredDocument | null {
  const haystack = normalize(filename);

  for (const document of documentsFor(market)) {
    for (const keyword of document.keywords) {
      if (haystack.includes(normalize(keyword))) {
        return document;
      }
    }
  }

  return null;
}

/** Kept so existing callers keep working; domestic is the default list. */
export const REQUIRED_DOCUMENTS = DOMESTIC_DOCUMENTS;
