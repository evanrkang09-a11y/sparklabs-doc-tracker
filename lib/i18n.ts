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

/**
 * Content in lib/documents.ts and lib/diligence.ts carries its two languages as
 * separate `somethingKo` / `somethingEn` fields rather than a Phrase, so it
 * can't go through `tr`. These two cover that shape.
 *
 * `both` exists because most of the UI shows the chosen language with the other
 * underneath it, which is the same choice made twice in opposite directions -
 * easy to get subtly backwards when written out by hand.
 */
export function pick(lang: Lang, ko: string, en: string): string {
  return lang === "ko" ? ko : en;
}

/** Returns [chosen language, the other one] for a primary/secondary pair. */
export function both(lang: Lang, ko: string, en: string): [string, string] {
  return lang === "ko" ? [ko, en] : [en, ko];
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

  // --- company management ---
  addCompany: { ko: "기업 추가", en: "Add company" },
  addBatch: { ko: "배치 추가", en: "Add batch" },
  companyNameKo: { ko: "기업명 (한글)", en: "Company name (Korean)" },
  companyNameEn: { ko: "기업명 (영문)", en: "Company name (English)" },
  marketLabel: { ko: "국내 / 해외", en: "Domestic or overseas" },
  dealTypeLabel: { ko: "유형", en: "Type" },
  batchLabel: { ko: "배치", en: "Batch" },
  noBatch: { ko: "배치 없음", en: "No batch" },
  unassigned: { ko: "배치 미지정", en: "Unassigned" },
  batchName: { ko: "배치 이름", en: "Batch name" },
  batchNote: { ko: "메모 (선택)", en: "Note (optional)" },
  save: { ko: "저장", en: "Save" },
  saving2: { ko: "저장 중…", en: "Saving…" },
  cancel: { ko: "취소", en: "Cancel" },
  archive: { ko: "보관", en: "Archive" },
  unarchive: { ko: "보관 해제", en: "Unarchive" },
  archived: { ko: "보관됨", en: "Archived" },
  showArchived: { ko: "보관된 기업 보기", en: "Show archived" },
  hideArchived: { ko: "보관된 기업 숨기기", en: "Hide archived" },
  deleteCompany: { ko: "영구 삭제", en: "Delete permanently" },
  deleteBatchLabel: { ko: "배치 삭제", en: "Delete batch" },
  confirmDeleteCompany: {
    ko: "기업과 업로드된 서류, 실사 기록, 댓글이 모두 영구 삭제됩니다. 되돌릴 수 없습니다.",
    en: "This permanently deletes the company along with its documents, diligence record and comments. It cannot be undone.",
  },
  confirmDeleteBatch: {
    ko: "배치를 삭제할까요? 소속 기업은 삭제되지 않고 배치 미지정 상태가 됩니다.",
    en: "Delete this batch? Its companies aren't deleted — they just become unassigned.",
  },
  noCompanies: {
    ko: "아직 등록된 기업이 없습니다. '기업 추가'로 시작하세요.",
    en: "No companies yet. Start with 'Add company'.",
  },
  docsComplete: { ko: "서류 완료", en: "Documents complete" },
  docsMissing: { ko: "서류 미비", en: "documents missing" },
  ddComplete: { ko: "실사 완료", en: "Diligence complete" },
  ddRemaining: { ko: "실사 미확인", en: "checks outstanding" },
  statusUnknown: { ko: "상태 확인 불가", en: "Status unavailable" },

  // --- dashboard ---
  overview: { ko: "전체 현황", en: "Overview" },
  companiesTracked: { ko: "관리 중인 기업", en: "Companies tracked" },
  docsReady: { ko: "서류 완료", en: "Documents complete" },
  ddReady: { ko: "실사 완료", en: "Diligence complete" },
  needsAttention: { ko: "확인 필요", en: "Needs attention" },
  allCompanies: { ko: "전체 기업", en: "All companies" },
  progressDocs: { ko: "서류", en: "Documents" },
  progressDd: { ko: "실사", en: "Diligence" },

  // --- AI analysis ---
  aiAnalysis: { ko: "AI 분석", en: "AI analysis" },
  runAnalysis: { ko: "AI로 서류 분석하기", en: "Analyse documents with AI" },
  rerunAnalysis: { ko: "다시 분석", en: "Re-analyse" },
  analysing: { ko: "분석 중…", en: "Analysing…" },
  analysisIntro: {
    ko: "업로드된 서류를 읽고 각 실사 항목이 충족되는지 검토합니다. 체크는 사람이 직접 합니다.",
    en: "Reads the uploaded documents and assesses each check. Ticking stays a human decision.",
  },
  notAnalysed: { ko: "아직 분석하지 않았습니다.", en: "Not analysed yet." },
  verdictMet: { ko: "충족으로 보임", en: "Looks satisfied" },
  verdictIssues: { ko: "문제 발견", en: "Problems found" },
  verdictUnclear: { ko: "판단 불가", en: "Can't tell" },
  keyFacts: { ko: "확인된 내용", en: "What was found" },
  issuesFound: { ko: "문제점", en: "Problems" },
  whatToDo: { ko: "다음 할 일", en: "What to do next" },
  documentsRead: { ko: "읽은 서류", en: "Documents read" },
  analysedAt: { ko: "분석 시각", en: "Analysed" },
  analysisFailed: { ko: "분석 실패", en: "Analysis failed" },
  analysisStale: {
    ko: "분석 이후 서류가 변경되었습니다. 다시 분석하세요.",
    en: "Documents have changed since this ran — re-analyse.",
  },
  aiSuggested: { ko: "AI 추가 검토 제안", en: "Additional checks suggested by AI" },
  aiSuggestedIntro: {
    ko: "표준 체크리스트에는 없지만, 이 기업의 서류를 보고 확인이 필요하다고 판단한 항목입니다.",
    en: "Not on the standard checklist, but worth checking based on this company's documents.",
  },
  suggestExtra: { ko: "추가 검토 항목 찾기", en: "Find additional checks" },
  needMoreDocs: {
    ko: "서류가 더 업로드되어야 추가 검토 항목을 제안할 수 있습니다.",
    en: "More documents are needed before extra checks can be suggested.",
  },
  noExtraChecks: {
    ko: "표준 체크리스트 외에 추가로 확인할 사항은 발견되지 않았습니다.",
    en: "Nothing found beyond the standard checklist.",
  },

  // --- investment agreement ---
  tabAgreement: { ko: "투자계약서", en: "Agreement" },
  agreementTitle: { ko: "투자계약서 작성", en: "Investment Agreement" },
  agreementIntro: {
    ko: "노란색으로 표시되어 있던 값을 오른쪽에 입력하면 계약서에 자동으로 반영됩니다.",
    en: "Fill the fields on the right and the contract updates automatically.",
  },
  downloadDocx: { ko: "DOCX 내려받기", en: "Download DOCX" },
  downloadPdf: { ko: "PDF로 저장", en: "Save as PDF" },
  preparing: { ko: "준비 중…", en: "Preparing…" },
  saveAgreement: { ko: "저장", en: "Save" },
  savedBy: { ko: "저장", en: "Saved" },
  neverSaved: { ko: "아직 저장되지 않았습니다", en: "Not saved yet" },
  unsavedChanges: { ko: "저장되지 않은 변경사항", en: "Unsaved changes" },
  fieldsRemaining: { ko: "미입력 항목", en: "fields still empty" },
  allFieldsFilled: { ko: "모든 항목 입력 완료", en: "All fields filled" },
  standardChanged: {
    ko: "표준 조항이 변경되었습니다",
    en: "A standard term has been changed",
  },
  standardNote: {
    ko: "스파크랩 표준: 위약벌 12%, 퇴사제한 5년",
    en: "SparkLabs standard: 12% liquidated damages, 5-year restriction",
  },
  jumpToField: { ko: "해당 항목으로 이동", en: "Go to field" },
  copiesNote: {
    ko: "기본 3부 (스파크랩·회사·대표자). 대표자 외 이해관계인이 있으면 부수를 늘리고 그 정보도 계약서에 포함해야 합니다.",
    en: "3 copies by default (SparkLabs, company, representative). Extra interested parties mean extra copies, and their details must go in the agreement too.",
  },

  // --- comments ---
  comments: { ko: "코멘트", en: "Comments" },
  commentPlaceholder: {
    ko: "문제점이나 확인이 필요한 내용을 남기면 다른 팀원이 볼 수 있습니다.",
    en: "Raise a problem or something that needs checking — the rest of the team will see it.",
  },
  postComment: { ko: "등록", en: "Post" },
  posting: { ko: "등록 중…", en: "Posting…" },
  noComments: { ko: "아직 코멘트가 없습니다.", en: "No comments yet." },
  deleteComment: { ko: "삭제", en: "Delete" },
  commentFailed: { ko: "코멘트 저장 실패", en: "Could not post comment" },

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
  unpacking: { ko: "압축 해제 중…", en: "Unpacking…" },
  namingHint: {
    ko: "파일명에 서류 이름이 들어가야 자동으로 분류됩니다. ZIP 파일도 올릴 수 있으며 자동으로 압축이 풀립니다.",
    en: "Include the document name in the filename so it sorts itself. ZIP files work too — they're unpacked automatically.",
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
