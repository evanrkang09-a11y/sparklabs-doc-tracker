/**
 * 서류 실사 체크리스트 / Document due-diligence checklist.
 *
 * Source: the mentor's "#3. 서류 실사" document. Where the collection tracker
 * asks "did this file arrive?", this asks "does what is inside these files hold
 * up?" - almost every check reads two or three documents against each other.
 *
 * The source document numbers its 13 points as one flat list. They fall into
 * two groups that behave differently on screen, so they are split here:
 * points 1-7 verify the submitted documents, points 8-13 are the process that
 * follows once verification is done.
 *
 * Where a single numbered point covered several unrelated judgements (point 3,
 * 정관, covers share classes, the option pool, and registration order), it is
 * split so that each thing you can be satisfied about separately gets its own
 * checkbox. `sourceRef` records where each item came from in the original.
 *
 * The source is Korean only. The English fields are translations kept beside
 * the original so a non-Korean reader can work the checklist; where they
 * disagree, the Korean is authoritative.
 *
 * NOTE: this is not the 예비실사 체크리스트. That is SparkLabs' internal
 * standard form, referenced but not included in the source document; point 9
 * here is about telling the company you are working from it.
 */

import type { Market } from "./documents";

export type DiligenceSection = {
  id: string;
  titleKo: string;
  titleEn: string;
  blurbKo: string;
  blurbEn: string;
  items: DiligenceItem[];
};

export type DiligenceItem = {
  id: string;
  titleKo: string;
  titleEn: string;
  /** Where this came from in the mentor's document, e.g. "실사 #2". */
  sourceRef: string;
  /** What to actually look at, in order. */
  detailsKo: string[];
  /** Same list in English. The source document is Korean-only; these are translations. */
  detailsEn: string[];
  /** The mentor's 💡 Tips - the part that is hard-won and easy to forget. */
  tipsKo?: string[];
  tipsEn?: string[];
  /**
   * Ids from lib/documents.ts that this check reads. The screen uses these to
   * show whether the documents a check depends on have even arrived yet.
   * Ids that don't exist in a given market's list are simply ignored.
   */
  relatedDocumentIds: string[];
};

// ---------------------------------------------------------------------------

const VERIFICATION: DiligenceItem[] = [
  {
    id: "business-purpose-match",
    titleKo: "사업목적 일치 확인",
    titleEn: "Business purpose matches across all three documents",
    sourceRef: "실사 #1",
    detailsKo: [
      "사업자등록증 상의 '사업의 종류'와 법인 등기부등본 상의 '목적'이 서로 유사·비슷·동일한 내용으로 기재되어 있는지 확인",
      "정관 상의 사업목적도 같은 내용인지 확인",
    ],
    detailsEn: [
      "Check that the 'type of business' on the business registration certificate and the 'purpose' clause in the corporate registry describe similar or identical activities",
      "Check the business purpose in the articles of incorporation says the same thing",
    ],
    tipsKo: [
      "이해하고 있는 사업내용과 관련 없어 보이는 업태·업종이 등록되어 있다면, 어떤 이유인지 확인이 필요합니다.",
    ],
    tipsEn: [
      "If a registered business category looks unrelated to the business as you understand it, find out why.",
    ],
    relatedDocumentIds: [
      "business-registration",
      "corporate-registry",
      "articles-of-incorporation",
    ],
  },
  {
    id: "share-count-match",
    titleKo: "발행주식수·액면가 일치 확인",
    titleEn: "Issued share count and par value reconcile",
    sourceRef: "실사 #2",
    detailsKo: [
      "등기부등본상 '총 발행 가능한 주식수' 및 '설립 자본금' 등 기본 정보 확인",
      "등기부등본상 주식 발행 이력(History) 확인",
      "등기부등본상 기발행된 종류주식·수량이 주주명부의 종류주식·수량과 일치하는지 확인",
    ],
    detailsEn: [
      "Check the basics in the corporate registry: total authorised shares and founding capital",
      "Check the share issuance history in the corporate registry",
      "Check that the classes and quantities of shares already issued per the registry match the shareholder registry",
    ],
    tipsKo: [
      "발행 이력은 보통 취소선으로 기재되어 있습니다.",
      "등기부등본의 주식수와 주주명부가 일치하지 않는 경우가 있습니다. 주주명부를 최신본으로 제출하지 않았거나, 등기를 누락했을 수도 있어 확인이 필요합니다.",
    ],
    tipsEn: [
      "Issuance history is usually shown struck through.",
      "The registry and the shareholder registry do sometimes disagree. Either the shareholder registry submitted wasn't the latest version, or a filing was missed — either way, check.",
    ],
    relatedDocumentIds: ["corporate-registry", "shareholder-registry", "cap-table"],
  },
  {
    id: "articles-share-classes",
    titleKo: "정관: 종류주식 발행 가능 여부 및 신주인수권",
    titleEn: "Articles allow preferred shares and third-party subscription",
    sourceRef: "실사 #3",
    detailsKo: [
      "정관상 '종류주식 발행 가능 여부' 확인",
      "정관상 '주주 및 제3자의 신주인수권' 조항 확인",
    ],
    detailsEn: [
      "Check whether the articles permit issuing preferred (class) shares at all",
      "Check the clause covering pre-emptive rights for shareholders and third parties",
    ],
    tipsKo: [
      "정관에 보통주만 발행 가능한 것으로 기재된 경우, 종류주식 발행이 가능하도록 수정을 요청해야 합니다.",
      "스파크랩은 기존 주주 이외에 제3자로서 투자하는 주체이므로, 스파크랩(제3자)에게 신주발행이 가능한 상황인지 반드시 체크해야 합니다.",
    ],
    tipsEn: [
      "If the articles only permit common shares, you have to ask the company to amend them so preferred shares can be issued.",
      "SparkLabs invests as a third party rather than an existing shareholder, so confirm that new shares can actually be issued to a third party.",
    ],
    relatedDocumentIds: ["articles-of-incorporation", "bylaws"],
  },
  {
    id: "option-pool",
    titleKo: "주식매수선택권(스톡옵션) 확인 — 옵션풀 15% 이내 선호",
    titleEn: "Stock options reviewed; option pool preferably under 15%",
    sourceRef: "실사 #3-2",
    detailsKo: [
      "스톡옵션이 부여된 경우 세부 내역 요청: 번호·성명·생년월일·자격·부여방법·행사가격·부여주식수·행사가능기간",
      "정관상 옵션풀 비율 확인",
    ],
    detailsEn: [
      "If options have been granted, request the detail: number, name, date of birth, eligibility, grant method, exercise price, shares granted, exercise window",
      "Check the option pool percentage set in the articles",
    ],
    tipsKo: [
      "상법상 주식회사는 발행주식총수의 10%까지 스톡옵션을 발행할 수 있으나, 벤처기업인증을 받은 기업은 최대 50%까지 부여할 수 있습니다.",
      "정관상 옵션풀이 15%를 넘게 설정되어 있다면, 10~15% 정도로 정관 변경이 가능할지 논의해볼 수 있습니다.",
    ],
    tipsEn: [
      "Under the Commercial Act a company may grant options over up to 10% of total issued shares; a certified venture company may grant up to 50%.",
      "If the articles set the pool above 15%, it's worth discussing an amendment down to roughly 10–15%.",
    ],
    relatedDocumentIds: [
      "stock-options",
      "articles-of-incorporation",
      "venture-certificate",
    ],
  },
  {
    id: "registration-sequence",
    titleKo: "정관 변경 등기 → 신주발행 등기 순서 확인",
    titleEn: "Order of amendment and new-share registration agreed",
    sourceRef: "실사 #3-4",
    detailsKo: [
      "순차적으로 개별 등기하는 것이 정석이나, 한 번에 진행할 수도 있음",
      "회사별 이사회 존재 여부에 따라 진행 방식이 달라지므로 먼저 확인",
      "안건1 정관 변경 = 주주총회 결의사항 / 안건2 신주발행 결의 = 이사회 결의사항",
    ],
    detailsEn: [
      "Filing each step separately is the textbook approach, but they can be done together",
      "Which applies depends on whether the company has a board — check that first",
      "Item 1, amending the articles, is a shareholder-meeting resolution; item 2, resolving to issue new shares, is a board resolution",
    ],
    tipsKo: [
      "이사회가 없는 경우: 2가지 안건을 한 번에 합의할 수 있습니다. 단, 신주발행 결의를 주주총회에서 진행하려면 정관에 미리 주주총회로 결의할 수 있다는 규정이 있어야 합니다.",
      "이사회가 있는 경우: 정관 변경은 주주총회 결의사항이므로 먼저 진행하고, 변경된 정관의 효력이 결의 즉시 발생하도록 설정하면 그 정관을 기반으로 바로 이사회에서 신주발행 결의를 진행할 수 있습니다.",
    ],
    tipsEn: [
      "No board: both items can be agreed at once — but for the shareholder meeting to resolve on issuing new shares, the articles must already say it may.",
      "With a board: amend the articles at the shareholder meeting first, set the amendment to take effect immediately on resolution, and the board can then resolve to issue new shares on that basis straight away.",
    ],
    relatedDocumentIds: ["articles-of-incorporation", "corporate-registry"],
  },
  {
    id: "debt-review",
    titleKo: "차입금·가수금 등 부채 내용 확인",
    titleEn: "Borrowings and director advances reviewed",
    sourceRef: "실사 #4",
    detailsKo: [
      "재무제표 상의 장·단기 차입금, 가수금 등 부채 내용 확인",
      "존재 시 세부 사항 요청: 대상·금액·이자율·만기일·대출일·상환계획",
    ],
    detailsEn: [
      "Review short- and long-term borrowings, director advances and other liabilities in the financial statements",
      "Where any exist, request the detail: counterparty, amount, interest rate, maturity, drawdown date, repayment plan",
    ],
    tipsKo: [
      "장·단기 차입금은 투자금으로 상환할 수 없습니다. 기업의 매출과 수익 등으로 상환해야 하므로, 각 차입금의 성격과 상환일정·상환계획을 확인하여 스파크랩 투자금 이외의 방식으로 해결할 예정임을 확인합니다.",
      "가수금은 주로 대표자가 법인에 현금이 부족할 때 자기비용을 더 넣은 경우입니다. 대표자가 상환받을 계획이 없다면 자본금 전환을 제안할 수 있으며, 이는 부채 비중을 낮춰 자본잠식 위험을 낮출 수 있습니다.",
    ],
    tipsEn: [
      "Borrowings cannot be repaid out of investment funds — they have to come from revenue and profit. Confirm the nature and repayment schedule of each, and that the company plans to settle them by means other than SparkLabs' money.",
      "Director advances usually arise when the CEO puts personal money in to cover a cash shortfall. If the CEO has no plan to be repaid, you can propose converting it to capital, which lowers the debt ratio and the risk of capital erosion.",
    ],
    relatedDocumentIds: ["financial-statements", "loans-and-advances"],
  },
  {
    id: "shareholder-review",
    titleKo: "주주 구성 및 이해관계인 확인",
    titleEn: "Shareholder composition and related parties reviewed",
    sourceRef: "실사 #5",
    detailsKo: [
      "대표자 포함 핵심인력의 지분이 충분한지 확인",
      "직원이 아닌 혈연·특수관계인 등 의심·우려되는 주주가 없는지 확인",
      "고문·감사 등으로 있는 주주가 자문료·급여까지 받는 관계는 아닌지 확인",
      "핵심인력 및 이해관계인이 존재하는 경우 주주간 계약서가 체결되어 있는지 확인",
    ],
    detailsEn: [
      "Check the CEO and key personnel hold enough equity between them",
      "Check for concerning shareholders — relatives or related parties who aren't employees",
      "Check whether any shareholder serving as an advisor or auditor is also drawing fees or salary",
      "Where key personnel or interested parties exist, check a shareholders' agreement is in place",
    ],
    tipsKo: [
      "교직원(교수)이 핵심인력으로 창업팀에 존재하는 경우, 재직 중인 학교에 20%가량의 지분을 나누어 주어야 하는 이슈가 있어 - 이를 회피하고자 자문료 형태로 인건비를 지불하는 경우에 해당할 수 있습니다.",
      "이해관계인이란 지분 10% 이상을 소유한 주주로서, 투자계약서의 '이해관계인'으로 서명 주체에 추가되어야 하는 주주입니다.",
    ],
    tipsEn: [
      "When a university professor is on the founding team, roughly 20% of equity may have to go to their institution — paying them as an advisor instead can be a way of sidestepping that.",
      "An 'interested party' is a shareholder holding 10% or more, who must be added as a signatory to the investment agreement in that capacity.",
    ],
    relatedDocumentIds: [
      "shareholder-registry",
      "shareholder-list",
      "shareholders-agreement",
      "key-personnel-cv",
      "other-entities",
    ],
  },
  {
    id: "ip-ownership",
    titleKo: "지식재산권 소유자가 기업으로 되어 있는지 확인",
    titleEn: "IP is owned by the company, not an individual",
    sourceRef: "실사 #6",
    detailsKo: ["특허·상표의 소유 주체가 개인이 아닌 법인인지 확인"],
    detailsEn: [
      "Check that patents and trademarks are held by the company, not by an individual",
    ],
    tipsKo: [
      "지식재산권이 없다면 앞으로의 취득 계획에 대해 문의합니다. (없다면 팁스 추천에 불리합니다.)",
    ],
    tipsEn: [
      "If there is no IP, ask about plans to acquire some — having none counts against a TIPS recommendation.",
    ],
    relatedDocumentIds: ["patents", "trademarks", "ip-filings"],
  },
  {
    id: "cross-check",
    titleKo: "상호 연결된 자료들의 정보 일치 최종 확인",
    titleEn: "Final cross-check across all linked documents",
    sourceRef: "실사 #7",
    detailsKo: [
      "주식 수: 주주명부 = 등기부등본",
      "사업목적: 등기부등본 = 사업자등록증 = 정관",
      "등기부등본 상에 확인되지 않은 이사가 있는 등의 특이사항 확인",
    ],
    detailsEn: [
      "Share count: shareholder registry = corporate registry",
      "Business purpose: corporate registry = business registration = articles of incorporation",
      "Look for anomalies such as a director who doesn't appear in the corporate registry",
    ],
    relatedDocumentIds: [
      "corporate-registry",
      "shareholder-registry",
      "business-registration",
      "articles-of-incorporation",
    ],
  },
];

const PROCESS: DiligenceItem[] = [
  {
    id: "written-comms",
    titleKo: "질의·확인 사항은 서면(메일)으로 진행",
    titleEn: "Raise all questions in writing (email)",
    sourceRef: "실사 #8",
    detailsKo: [
      "상기 실사항목 확인 후 투자기업과 질의·확인해야 할 내용이 있는 경우, 최대한 서면(메일)으로 communication 진행",
      "기본 CC: 담당 상무님 / 담당 팀장님",
      "경우에 따라 CC: 투자기업 담당자 (예: 담당 매니저, RA 등)",
    ],
    detailsEn: [
      "Once the checks above are done, put any questions to the company in writing (email) wherever possible",
      "Always CC: the responsible director and team lead",
      "CC where relevant: the company-side contact (their manager, RA, etc.)",
    ],
    tipsKo: [
      "전체회신이 아닌 메일 송부자에게만 회신하는 경우가 종종 발생합니다. 기업팀에게 '전체회신'으로 회신해달라 요청하는 것이 좋습니다.",
    ],
    tipsEn: [
      "People often reply to the sender only rather than to all. Ask the company team to use reply-all.",
    ],
    relatedDocumentIds: [],
  },
  {
    id: "prelim-checklist-notice",
    titleKo: "예비실사 체크리스트 기준으로 진행 중임을 사전 고지",
    titleEn: "Tell the company you are working from the preliminary DD checklist",
    sourceRef: "실사 #9",
    detailsKo: [
      "기업으로 하여금 세부 기준을 알게 하여, 제출한 자료 이외에도 추가 제출을 요청할 수 있음을 알림",
      "예비실사 체크리스트 상의 내용 확인 후, 기업에 확인 요청 및 투자계약 체결일에 서명본을 지참하도록 안내",
    ],
    detailsEn: [
      "Let the company see the detailed criteria, so they know further documents may be requested beyond what they've already sent",
      "After working through the preliminary DD checklist, ask the company to confirm it and to bring a signed copy on the contract date",
    ],
    tipsKo: [
      "특히 법인 통장이 일반 예금 통장이 맞는지(마이너스 통장 엄금), 해당 계좌에 자동이체가 걸려 있는 것은 없는지 확인하는 것을 추천합니다. 투자금이 납입되자마자 밀린 월급이 이체되거나 카드대금이 결제되는 경우가 발생하기 때문입니다. (본래 등기가 완료되기 전에는 투자금을 사용해서는 안 됩니다.)",
    ],
    tipsEn: [
      "In particular, confirm the corporate account is an ordinary deposit account — never an overdraft — and that no automatic transfers are set up on it. Otherwise back-pay or card bills can go out the moment the investment lands. (Investment funds must not be spent before the registration is complete.)",
    ],
    relatedDocumentIds: ["bank-account", "bank-balance", "wiring-info"],
  },
  {
    id: "contract-drafting",
    titleKo: "신주의 수와 발행가액 계산 및 계약서 작성",
    titleEn: "Calculate new shares and price; draft the contract",
    sourceRef: "실사 #10",
    detailsKo: [
      "신주의 수와 발행가액 등을 계산하여 계약서 작성하고 상호 확인",
      "조정의견 있을 시 재무팀 질의",
      "표준계약서는 구글 드라이브 [표준계약서] 폴더에서 확인",
    ],
    detailsEn: [
      "Work out the number of new shares and the issue price, draft the contract, and confirm it with the company",
      "Raise any proposed adjustments with the finance team",
      "The standard contract template is in the [표준계약서] folder on Google Drive",
    ],
    relatedDocumentIds: ["shareholder-registry", "cap-table"],
  },
  {
    id: "contract-execution",
    titleKo: "투자계약 체결",
    titleEn: "Execute the investment contract",
    sourceRef: "실사 #11",
    detailsKo: [
      "계약서 양식에 기업의 정보를 기입하여 초안 작성",
      "초안을 투자기업에게 공유하여 이상 없는지 확인 요청",
    ],
    detailsEn: [
      "Fill the company's details into the contract template to produce a draft",
      "Share the draft with the company and ask them to confirm it",
    ],
    tipsKo: [
      "대부분 표준계약서로 진행하나, 위약벌 % 등 구체적인 숫자에 대해 투자기업 측에서 수정 요청이 들어올 수 있습니다. 합의한 투자계약 체결일·투자금 납입일 등의 타임라인을 고려하여 초안부터 최종본까지의 소요 시간을 산정하고 업무 우선순위를 설정하세요.",
    ],
    tipsEn: [
      "Most deals run on the standard contract, but the company may ask to change specific figures such as the penalty percentage. Work backwards from the agreed signing and payment dates to estimate how long draft-to-final will take, and prioritise accordingly.",
    ],
    relatedDocumentIds: ["shareholders-agreement"],
  },
  {
    id: "finance-team-share",
    titleKo: "재무팀 공유: 계약서, 서류일체 및 예비실사 체크리스트",
    titleEn: "Share contract, all documents and DD checklist with finance",
    sourceRef: "실사 #12",
    detailsKo: [
      "운용지시 시 CC하는 형태로 공유",
      "서류일체의 경우, 투자 기업의 투자 전 서류가 업로드되어 있는 드라이브 링크를 공유",
    ],
    detailsEn: [
      "Share by CC'ing finance on the operating instruction",
      "For the document set, share the Drive link holding the company's pre-investment documents",
    ],
    relatedDocumentIds: [],
  },
  {
    id: "investment-report",
    titleKo: "투자심사보고서 작성",
    titleEn: "Write the investment review report",
    sourceRef: "실사 #13",
    detailsKo: [
      "KF·Batch 선발 기업의 경우: Scorecard로 대체",
      "해외기업의 경우: 한국은행 심사 시 필수서류",
      "팁스기업(국내)의 경우: 서면심사 시 필수서류",
    ],
    detailsEn: [
      "For KF / Batch-selected companies: a Scorecard replaces it",
      "For overseas companies: required for Bank of Korea review",
      "For domestic TIPS companies: required for the written review",
    ],
    relatedDocumentIds: ["ir-deck", "intro-deck", "financial-statements"],
  },
];

export const DILIGENCE_SECTIONS: DiligenceSection[] = [
  {
    id: "verification",
    titleKo: "서류 검증",
    titleEn: "Document verification",
    blurbKo: "제출된 서류들을 서로 대조하여 내용이 맞는지 확인합니다.",
    blurbEn: "Read the submitted documents against each other and confirm they agree.",
    items: VERIFICATION,
  },
  {
    id: "process",
    titleKo: "후속 절차",
    titleEn: "Follow-up process",
    blurbKo: "검증이 끝난 뒤 계약 체결까지 진행되는 절차입니다.",
    blurbEn: "What happens between finishing verification and signing the contract.",
    items: PROCESS,
  },
];

/**
 * The checklist is the same for domestic and overseas deals - the source
 * document does not split them - but `market` is taken so that a future
 * overseas-only variation has an obvious place to go.
 */
export function diligenceSectionsFor(_market: Market): DiligenceSection[] {
  return DILIGENCE_SECTIONS;
}

export function allDiligenceItems(): DiligenceItem[] {
  return DILIGENCE_SECTIONS.flatMap((section) => section.items);
}

export function isKnownCheckId(id: string): boolean {
  return allDiligenceItems().some((item) => item.id === id);
}
