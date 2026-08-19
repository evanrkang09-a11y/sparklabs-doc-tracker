/**
 * The values that fill the RCPS (상환전환우선주) investment agreement, and the
 * tokens each one lands in.
 *
 * The template (templates/rcps-agreement.docx) was tokenised by a verified
 * cursor scan: each {{rN}} was placed at a placeholder anchored by its unique
 * preceding label, and every token was confirmed to occur exactly once.
 *
 * Draft — the mentor should review the first generated RCPS .docx before it is
 * used for a real deal. The many standard terms (배당 1%, 연복리 12%, 잔여재산
 * 7%, IPO/M&A 70%, 상환 2년, 퇴사제한 4년 등) are left at their printed values;
 * only the deal-specific fields below are filled.
 */

import type { AgreementGroup } from "./agreement-fields";

export const RCPS_GROUPS: AgreementGroup[] = [
  {
    id: "rcps-dates",
    titleKo: "1. 날짜",
    titleEn: "1. Dates",
    fields: [
      { id: "signYear", labelKo: "체결일 — 연도", labelEn: "Signing — year", kind: "year", tokens: ["r1"], default: "2026" },
      { id: "signMonth", labelKo: "체결일 — 월", labelEn: "Signing — month", kind: "number", tokens: ["r2"] },
      { id: "signDay", labelKo: "체결일 — 일", labelEn: "Signing — day", kind: "number", tokens: ["r3"] },
      { id: "paymentYear", labelKo: "납입기일 — 연도", labelEn: "Payment — year", kind: "year", tokens: ["r26"], default: "2026" },
      { id: "paymentMonth", labelKo: "납입기일 — 월", labelEn: "Payment — month", kind: "number", tokens: ["r27"] },
      { id: "paymentDay", labelKo: "납입기일 — 일", labelEn: "Payment — day", kind: "number", tokens: ["r28"] },
      { id: "financialsYear", labelKo: "재무제표 기준일 — 연도", labelEn: "Financials — year", kind: "year", tokens: ["r29"] },
      { id: "financialsMonth", labelKo: "재무제표 기준일 — 월", labelEn: "Financials — month", kind: "number", tokens: ["r30"] },
      { id: "financialsDay", labelKo: "재무제표 기준일 — 일", labelEn: "Financials — day", kind: "number", tokens: ["r31"] },
    ],
  },
  {
    id: "rcps-parties",
    titleKo: "2. 당사자",
    titleEn: "2. Parties",
    fields: [
      { id: "investorName", labelKo: "투자자명 (표지)", labelEn: "Investor name (cover)", kind: "text", tokens: ["r4"], default: "스파크랩 디스커버리펀드8호 개인투자조합" },
      { id: "investorAddress", labelKo: "투자자 주소", labelEn: "Investor address", kind: "text", tokens: ["r6"] },
      { id: "gpName", labelKo: "업무집행조합원", labelEn: "General partner", kind: "text", tokens: ["r7"], default: "주식회사 스파크랩" },
      { id: "gpRep", labelKo: "업무집행조합원 대표이사", labelEn: "GP representative", kind: "text", tokens: ["r8"], default: "김유진" },
      { id: "companyName", labelKo: "회사명 (표지)", labelEn: "Company name (cover)", kind: "text", tokens: ["r5"] },
      { id: "companyAddress", labelKo: "회사 주소", labelEn: "Company address", kind: "text", tokens: ["r9"] },
      { id: "companyRep", labelKo: "회사 대표자", labelEn: "Company representative", kind: "text", tokens: ["r10"] },
      { id: "interestedAddress", labelKo: "이해관계인 주소", labelEn: "Interested party address", kind: "text", tokens: ["r11"] },
      { id: "interestedBirthYear", labelKo: "이해관계인 생년 (YYYY)", labelEn: "Interested party birth year", kind: "number", tokens: ["r12"] },
      { id: "interestedBirthMonth", labelKo: "이해관계인 생월", labelEn: "Interested party birth month", kind: "number", tokens: ["r13"] },
      { id: "interestedBirthDay", labelKo: "이해관계인 생일", labelEn: "Interested party birth day", kind: "number", tokens: ["r14"] },
    ],
  },
  {
    id: "rcps-terms",
    titleKo: "3. 투자 조건",
    titleEn: "3. Investment terms",
    fields: [
      { id: "newShares", labelKo: "본건 종류주식 수 (상환전환우선주)", labelEn: "New RCPS shares", kind: "number", tokens: ["r15"] },
      { id: "authShares", labelKo: "발행할 주식의 총수", labelEn: "Total authorised shares", kind: "number", tokens: ["r16"] },
      { id: "commonShares", labelKo: "기 발행 보통주 총수", labelEn: "Existing common shares", kind: "number", tokens: ["r17"] },
      { id: "existingPreferred", labelKo: "기 발행 상환전환우선주 수", labelEn: "Existing RCPS shares", kind: "number", tokens: ["r18"] },
      { id: "issueShares", labelKo: "본건 종류주식 종류와 수", labelEn: "Class and count issued", kind: "number", tokens: ["r19"] },
      { id: "parValue", labelKo: "1주당 액면가액 (숫자)", labelEn: "Par value (figures)", kind: "money", tokens: ["r20"] },
      { id: "parValueParen", labelKo: "1주당 액면가액 (괄호)", labelEn: "Par value (parenthesis)", kind: "money", tokens: ["r21"] },
      { id: "issuePrice", labelKo: "1주당 발행가액 (숫자)", labelEn: "Issue price (figures)", kind: "money", tokens: ["r22"] },
      { id: "issuePriceParen", labelKo: "1주당 발행가액 (괄호)", labelEn: "Issue price (parenthesis)", kind: "money", tokens: ["r23"] },
      { id: "totalAmount", labelKo: "총 인수대금 (숫자)", labelEn: "Total amount (figures)", kind: "money", tokens: ["r24"] },
      { id: "totalAmountParen", labelKo: "총 인수대금 (괄호)", labelEn: "Total amount (parenthesis)", kind: "money", tokens: ["r25"] },
    ],
  },
];
