/**
 * Korean / English text for the interface.
 *
 * The document and checklist *content* already carries both languages in
 * lib/documents.ts and lib/diligence.ts. This file is only the surrounding
 * chrome - buttons, headings, status messages.
 *
 * Korean is the default because the users are a Korean VC and the companies
 * they invest in. English exists so someone who can't read Korean can still
 * work the tool.
 */

export type Lang = "ko" | "en";

export type Phrase = { ko: string; en: string };

/** Picks the right side of a bilingual pair. */
export function tr(phrase: Phrase, lang: Lang): string {
  return phrase[lang];
}

export const T = {
  // --- chrome ---
  org: { ko: "SparkLabs Korea", en: "SparkLabs Korea" },
  home: { ko: "홈", en: "Home" },
  tabDocuments: { ko: "서류 취합", en: "Documents" },
  tabDiligence: { ko: "서류 실사", en: "Due Diligence" },
  internalOnly: { ko: "내부용", en: "Internal" },
  langToggle: { ko: "English", en: "한국어" },

  // --- login ---
  signInTitle: { ko: "로그인", en: "Sign in" },
  signInWithGoogle: { ko: "Google 계정으로 로그인", en: "Sign in with Google" },
  signInDomainNote: {
    ko: "계정만 로그인할 수 있습니다.",
    en: "accounts only.",
  },
  signInNoPassword: {
    ko: "비밀번호는 Google에서 입력하며, 이 사이트는 비밀번호를 저장하지 않습니다.",
    en: "You enter your password on Google. This site never sees or stores it.",
  },
  signInRefused: {
    ko: "이 계정으로는 로그인할 수 없습니다. 회사 계정으로 다시 시도해 주세요.",
    en: "That account can't sign in here. Try again with your company account.",
  },
  signInError: {
    ko: "로그인 중 문제가 발생했습니다. 다시 시도해 주세요.",
    en: "Something went wrong signing in. Please try again.",
  },
  signOut: { ko: "로그아웃", en: "Sign out" },

  // --- home ---
  appName: { ko: "서류 취합 트래커", en: "Document Collection Tracker" },
  appTagline: {
    ko: "투자 전 제출 서류 관리",
    en: "Pre-investment document management",
  },
  homeIntro: {
    ko: "기업이 보내온 서류를 해당 기업 페이지에 업로드하면, 무엇이 제출됐고 무엇이 남았는지 자동으로 정리됩니다.",
    en: "Upload the documents a company sends in to that company's page, and what's arrived and what's still outstanding sorts itself out.",
  },
  homeInternalWarning: {
    ko: "사내 전용 도구입니다. 링크를 외부에 공유하지 마세요.",
    en: "Internal tool. Do not share these links outside the company.",
  },
  domesticCompany: { ko: "국내 기업", en: "Korean company" },
  overseasCompany: { ko: "해외 기업", en: "Overseas company" },
  requiredCount: { ko: "필수", en: "required" },
  items: { ko: "건", en: "" },

  // --- deal / upload ---
  preInvestmentDocs: { ko: "투자 전 제출 서류", en: "Pre-investment documents" },
  checking: { ko: "확인 중…", en: "Checking…" },
  loadFailed: {
    ko: "서류 현황을 불러오지 못했습니다",
    en: "Could not load document status",
  },
  allSubmitted: { ko: "필수 서류 모두 제출 완료", en: "All required documents received" },
  allSubmittedSub: {
    ko: "감사합니다.",
    en: "Thank you.",
  },
  dropHere: { ko: "서류를 여기에 끌어다 놓으세요", en: "Drag your documents here" },
  dropHereSub: {
    ko: "여러 개를 한 번에 올려도 됩니다.",
    en: "You can drop several at once.",
  },
  chooseFiles: { ko: "파일 선택", en: "Choose files" },
  uploading: { ko: "업로드 중…", en: "Uploading…" },
  namingHint: {
    ko: "파일명에 서류 이름이 들어가야 자동으로 분류됩니다. 예: 사업자등록증_회사명.pdf",
    en: "Include the document name in the filename so it sorts itself. e.g. business-registration_company.pdf",
  },
  uploadFailed: { ko: "업로드 실패", en: "Upload failed" },
  deleteFailed: { ko: "삭제 실패", en: "Delete failed" },
  deleting: { ko: "삭제 중…", en: "Deleting…" },
  deleteLabel: { ko: "삭제", en: "Delete" },
  confirmDelete: {
    ko: "파일을 삭제할까요? 되돌릴 수 없습니다.",
    en: "Delete this file? This cannot be undone.",
  },
  ifApplicable: { ko: "해당 시", en: "If applicable" },
  notSubmitted: { ko: "미비", en: "Missing" },
  notSubmittedOptional: {
    ko: "미제출 (해당 시 제출)",
    en: "Not submitted (only if applicable)",
  },
  fromDrive: { ko: "(드라이브)", en: "(Drive)" },
  unclassified: { ko: "분류되지 않은 파일", en: "Unclassified files" },
  unclassifiedSub: {
    ko: "업로드는 되었지만 어떤 서류인지 파일명으로 판별하지 못했습니다.",
    en: "Uploaded, but the filename didn't identify which document it is.",
  },
  aiGuess: { ko: "AI로 추정하기", en: "Guess with AI" },
  aiWorking: { ko: "확인 중…", en: "Working…" },
  aiFailed: { ko: "AI 추정 실패", en: "AI guess failed" },
  aiNoIdea: {
    ko: "어떤 서류인지 추정하지 못했습니다. 파일명을 알아보기 쉽게 바꿔서 다시 올려주세요.",
    en: "Couldn't identify these. Try renaming them more clearly and uploading again.",
  },
  aiResultNote: {
    ko: "AI 추정 결과입니다. 확인 후 파일명을 바꿔서 다시 업로드하면 자동으로 분류됩니다.",
    en: "AI suggestions. Check them, then rename and re-upload to have them sort automatically.",
  },
  confidence: { ko: "확신도", en: "confidence" },
  lastChecked: { ko: "마지막 확인", en: "Last checked" },
  autoRefresh: { ko: "자동 새로고침", en: "auto-refresh" },
  seconds: { ko: "초", en: "s" },

  // --- diligence ---
  diligenceTitle: { ko: "서류 실사", en: "Document Due Diligence" },
  internalBanner: {
    ko: "이 페이지는 내부 검토용입니다. 투자기업에 공유하지 마세요.",
    en: "This page is for internal review. Do not share it with the company.",
  },
  allChecked: { ko: "실사 항목 전체 확인 완료", en: "All checks complete" },
  ofChecked: { ko: "확인", en: "checked" },
  outOf: { ko: "개 중", en: "of" },
  missingDocsWarning: {
    ko: "아직 제출되지 않은 필수 서류가 있습니다. 서류가 모두 도착한 뒤 실사를 진행하는 것이 원칙입니다.",
    en: "Some required documents haven't arrived yet. Due diligence is normally done once everything is in.",
  },
  viewSubmissions: { ko: "제출 현황 보기", en: "View submission status" },
  autosaveHint: { ko: "변경하면 자동으로 저장됩니다.", en: "Changes save automatically." },
  saving: { ko: "저장 중…", en: "Saving…" },
  saved: { ko: "저장됨", en: "Saved" },
  saveFailed: { ko: "저장 실패", en: "Save failed" },
  relatedDocs: { ko: "관련 서류", en: "Related documents" },
  memoPlaceholder: {
    ko: "메모 — 확인한 내용, 기업에 질의할 사항 등",
    en: "Notes — what you checked, what to ask the company",
  },
  submitted: { ko: "제출됨", en: "Submitted" },
  diligenceSource: {
    ko: "출처: 사내 '#3. 서류 실사' 문서. 예비실사 체크리스트(사내 표준 양식)는 별도 문서입니다.",
    en: "Source: the internal '#3. 서류 실사' document. The preliminary DD checklist (internal standard form) is a separate document.",
  },
} satisfies Record<string, Phrase>;
