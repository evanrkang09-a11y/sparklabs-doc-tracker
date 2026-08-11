/**
 * The list of documents we need to collect from a company, and the logic for
 * working out which document a given filename represents.
 *
 * This is the single source of truth for the whole app. To change what the
 * tracker asks for, edit this list - nothing else needs to change.
 *
 * The order and numbering follow the mentor's sample Drive folder.
 */

export type RequiredDocument = {
  id: string;
  nameKo: string;
  nameEn: string;
  /** Why this document matters, in one line. Shown in the UI as a hint. */
  purpose: string;
  /** Optional documents don't count toward the "missing" total. */
  optional?: boolean;
  /**
   * Filename fragments that identify this document. A document often has more
   * than one name in practice - e.g. 등기부등본 and 등기사항전부증명서 are the
   * same thing - so list every name you've actually seen.
   */
  keywords: string[];
};

export const REQUIRED_DOCUMENTS: RequiredDocument[] = [
  {
    id: "business-overview",
    nameKo: "사업소개서",
    nameEn: "Business Overview",
    purpose: "The company's own description of what it does.",
    keywords: ["사업소개서", "사업계획서", "business overview", "ir deck", "pitch deck"],
  },
  {
    id: "business-registration",
    nameKo: "사업자등록증",
    nameEn: "Business Registration Certificate",
    purpose: "Proves the company is a registered business entity.",
    keywords: ["사업자등록", "business registration", "biz registration"],
  },
  {
    id: "articles-of-incorporation",
    nameKo: "정관",
    nameEn: "Articles of Incorporation",
    purpose: "Company rulebook - shows whether preferred shares can be issued.",
    keywords: ["정관", "articles of incorporation", "aoi"],
  },
  {
    id: "corporate-seal",
    nameKo: "법인 인감증명서",
    nameEn: "Corporate Seal Certificate",
    purpose: "Verifies the company seal. Reused again at contract signing.",
    keywords: ["인감증명", "법인인감", "corporate seal", "seal certificate"],
  },
  {
    id: "corporate-registry",
    nameKo: "등기사항전부증명서",
    nameEn: "Corporate Registry Extract",
    purpose: "Official record of directors, capital, and shares issued.",
    // 등기부등본 is the older/common name for the same document.
    keywords: [
      "등기사항전부증명서",
      "등기사항증명서",
      "등기부등본",
      "등기부",
      "corporate registry",
      "registry extract",
    ],
  },
  {
    id: "financial-statements",
    nameKo: "재무제표",
    nameEn: "Financial Statements",
    purpose: "Revenue, assets, debt. Basis for checking loans and director advances.",
    keywords: ["재무제표", "감사보고서", "financial statement", "financials"],
  },
  {
    id: "shareholder-registry",
    nameKo: "주주명부",
    nameEn: "Shareholder Registry",
    purpose: "Who owns how many shares. Cross-checked against the registry extract.",
    keywords: ["주주명부", "shareholder registry", "shareholder list"],
  },
  {
    id: "social-insurance",
    nameKo: "4대보험 가입자명부",
    nameEn: "Social Insurance Enrollment List",
    purpose: "Confirms who is actually employed at the company.",
    keywords: ["4대보험", "사대보험", "social insurance", "insurance enrollment"],
  },
  {
    id: "bank-account",
    nameKo: "통장사본",
    nameEn: "Bank Account Copy",
    purpose: "Where the investment money actually gets wired.",
    keywords: ["통장사본", "통장 사본", "bank account", "bankbook"],
  },
  {
    id: "cap-table",
    nameKo: "Cap Table (자본구성표)",
    nameEn: "Capitalization Table",
    purpose: "Ownership breakdown. The glossary marks it required only for overseas deals.",
    optional: true,
    keywords: ["captable", "cap table", "자본구성표"],
  },
  {
    id: "venture-certificate",
    nameKo: "벤처기업확인증",
    nameEn: "Venture Business Certificate",
    purpose: "Only if the company has one - relates to LP tax benefits.",
    optional: true,
    keywords: ["벤처기업확인", "중소기업확인", "창업기업확인", "venture certificate"],
  },
];

/**
 * Strip out the things that vary between filenames but carry no meaning -
 * spaces, underscores, hyphens, capitalisation - so that
 * "Business_Registration.pdf" and "business registration.pdf" both match.
 */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s_\-().]/g, "");
}

/**
 * Work out which required document a filename refers to.
 * Returns null if we don't recognise it.
 */
export function matchDocument(filename: string): RequiredDocument | null {
  const haystack = normalize(filename);

  for (const document of REQUIRED_DOCUMENTS) {
    for (const keyword of document.keywords) {
      if (haystack.includes(normalize(keyword))) {
        return document;
      }
    }
  }

  return null;
}
