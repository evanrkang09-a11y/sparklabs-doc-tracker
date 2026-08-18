/**
 * The full SparkLabs Korea investment-operations process, as knowledge for the
 * in-app assistant.
 *
 * Source: the mentor's end-to-end process document (Deal Flow → Interview →
 * Decision → Pre-investment → Due diligence → Contract → Overseas/BOK →
 * Payment → Post-payment → SAFE conversion → KIBO). Transcribed and organised
 * so the assistant can answer questions grounded only in this text.
 *
 * Korean is the working language of the source; English glosses are kept beside
 * key terms. When Korean and English disagree, the Korean is authoritative.
 */

export const PROCESS_KNOWLEDGE = `# SparkLabs Korea — Investment Operations Process

## #Base. Deal Flow
- Deals are tracked in a Deal Flow Google Sheet.
- Scorecard: always use the standard form. Collect the combined scorecard when a company is batch-selected. Secure a Scorecard even for non-batch companies.

## #0. 투자 논의 (Investment discussion / Interview)
- Attend interviews where possible, to record each partner's notes. These notes feed the Scorecard "comment" section and are reference for later investment-term and due-diligence discussion.
- Scorecard: for KF funds, the Scorecard replaces the investment review report. It may be recorded in the Accelerator App too. Collect the Original version per General Partner where possible; use the Short version only when the Original is not feasible.
- General Partner contact points:
  - 이한주 대표님 (via Bespin Global secretary's office): hanjoo.lee@bespinglobal.com; secretary 양소영 과장 soyoung.yang@bespinglobal.com / 010-6707-8692 (info as of 2023.03).
  - 버나드문 대표님 (contact directly): bernard@sparklabsglobal.com / WhatsApp +1 (650) 454-5244. Lives on the US West Coast — mind the time zone; he speaks in PST.

## #1. 투자 결정 (Investment decision)
- Before finalising any investment, double-check that the partners have agreed. If in doubt, send an email securing the record of all partners' agreement before proceeding.
- Send the offer letter to the company stating the final agreed terms: investment amount, Post Value, ownership %, share class/type.
- If the offer letter is accepted, begin the investment-contract process.
- Payment timing: within Week 8–10, and at the latest before Demo Day. If there is a disqualifying issue, discuss and decide whether to invest.

## #2. 투자 진행 전 (Before investment)
### #2-A. Review process (Overall)
1. Request investment documents from a company that accepted the offer letter.
2. Pre-investment document list — DOMESTIC (국내):
   - 최신 사업소개서 (latest IR deck, PDF)
   - 사업자등록증 [원본대조필]
   - 등기부등본 [원본, 말소사항 포함]
   - 정관 [원본대조필]
   - 법인 인감증명서 [원본]
   - 주주명부
   - 4대보험 가입자명부 [원본대조필]
   - 스톡옵션 수여자 명단 및 상세 (성명/생년월일/자격/부여방법/행사가격/부여주식수/행사가능기간)
   - 법인 통장사본 (투자금 납입용)
   - 통장잔액증명서
   - 재무제표 (전기·당기 포함)
   - 가수금/차입금 상세
   - 대표자 및 주요 인력 이력서
   - 매출 추정 (향후 5개년, Excel)
   - 대표자 신분증 및 주민등록등본 사본
   - 주주간 계약서 (지정 양식)
   - 대표자의 타 법인/개인사업자 보유 여부
   - 법인 및 대표자 납세증명서
   - (해당 시) 벤처기업확인증 / 중소기업확인서 / 창업기업확인서
   - (해당 시) 특허 등록/출원서, 상표 등록/출원서
   - If pre-incorporation: ask expected incorporation timing; government/labour-cost support programs; 3-month Cash Flow (purchases); related-party transactions; Cash flow form.
3. Pre-investment document list — OVERSEAS (해외):
   - Latest Company Intro Deck (IR deck)
   - Certificate of Incorporation
   - Articles of Incorporation (Bylaws)
   - Financial Statements (Balance Sheet, Income/Cashflow/Changes in Equity)
   - Wiring Info (bank copy / remittance info)
   - Capitalization Table (Cap Table)
   - Shareholder List (include both new-share and SAFE investors)
   - CEO ID (passport or driver's license copy)
   - CEO & co-founder's CV
   - Revenue Forecast (5 years)
   - (If applicable) Patent or Trademark Registrations/Applications
- Tip: for venture investment associations, LPs may ask about domestic companies' 벤처기업확인증/중소기업확인서/창업기업확인서 for tax benefits, so collect these up front.
- After receiving documents: organise hard copies in a clear file (labelled binder); scan and organise soft copies in the Google Drive folder (e.g. "15th Batch > 15th_Investment Related docs > company folder").
- Then proceed to #3 Document due diligence.
### #2-B. Document-request email templates
- Domestic and overseas templates exist. Double-check English wording. For overseas, because you must file the foreign investment with the Bank of Korea, you may need extra documents during that filing.

## #3. 서류 실사 (Document due diligence — IMPORTANT ⭐⭐⭐)
1. Business type matches across 사업자등록증, 등기부등본, 정관. Check the "사업의 종류" (biz registration) and "목적" (registry) describe similar/identical activities; the articles' business purpose too. Tip: if an unrelated business category is registered, find out why.
2. Issued share count and par value reconcile across 법인등기부등본 and 주주명부. Check total authorised shares and founding capital; the share issuance history (usually shown struck through); that issued preferred classes/quantities in the registry match the shareholder registry. Tip: registry and shareholder registry sometimes disagree — either the latest shareholder registry wasn't submitted, or a filing was missed.
3. Articles (정관):
   - Check whether preferred (class) shares can be issued, and the pre-emptive rights of shareholders and third parties. Tip: if only common shares are permitted, ask to amend so preferred shares can be issued. SparkLabs invests as a third party, so confirm new shares can be issued to a third party.
   - Stock options: option pool preferably within 15%. If options granted, request detail (number/name/DOB/eligibility/grant method/exercise price/shares granted/exercise window). Under the Commercial Act a company can grant options over up to 10% of shares; a certified venture company up to 50%. If the pool exceeds 15%, discuss amending to ~10–15%.
   - Order of registration: amend articles first (shareholder-meeting resolution), then new-share issuance (board resolution). Filing separately is textbook, but can be done together depending on whether the company has a board. No board: both can be agreed at once, but the articles must allow the shareholder meeting to resolve on new-share issuance. With a board: amend articles at the shareholder meeting, set the amendment effective immediately, then the board resolves to issue new shares.
4. Debt review: check short/long-term borrowings and 가수금 (director advances) in the financials. If any, request detail (counterparty/amount/interest/maturity/drawdown date/repayment plan). Tip: borrowings cannot be repaid from investment funds — confirm they'll be settled from revenue. 가수금 usually arises when the CEO covers a cash shortfall; if the CEO won't be repaid, propose converting it to capital to lower the debt ratio and capital-erosion risk.
5. Shareholders: check the CEO and key personnel hold enough equity; check for concerning shareholders (non-employee relatives/related parties); check whether an advisor/auditor shareholder also draws fees/salary. Where key personnel or interested parties exist, check a shareholders' agreement is in place. An "interested party" (이해관계인) is a shareholder holding 10%+ who must be added as a signatory to the investment agreement.
6. IP ownership: confirm patents/trademarks are held by the company, not an individual. If none, ask about acquisition plans (having none is unfavourable for a TIPS recommendation).
7. Final cross-check across linked documents: share count (주주명부 = 등기부등본); business purpose (등기부등본 = 사업자등록증 = 정관); look for anomalies such as a director not appearing in the registry.
8. Put questions to the company in writing (email). Default CC: the responsible director (상무) and team lead; CC the company contact where relevant. Tip: ask the company team to reply-all.
9. Tell the company you are working from the preliminary DD checklist (예비실사 체크리스트), so they know more documents may be requested, and to bring a signed copy on the contract date. Tip: confirm the corporate account is an ordinary deposit account (never an overdraft) with no auto-transfers — otherwise back-pay or card bills can go out the moment the investment lands (funds must not be spent before registration).
10. Calculate the new-share count and issue price, draft the contract, confirm mutually. Raise adjustments with the finance team. Standard contract is in Google Drive [표준계약서 2023].
11. Execute the contract: fill company details into the template to draft, share with the company to confirm. Tip: most run on the standard contract, but the company may ask to change figures like the penalty %.
12. Share with finance (재무팀): the contract, all documents, and the DD checklist — by CC'ing finance on the operating instruction (finance@sparklabs.co.kr). Share the Drive link with the company's pre-investment documents.
13. Write the investment review report. KF/Batch: Scorecard replaces it. Overseas: required for the Bank of Korea review. Domestic TIPS: required for the written review.

## #4. 투자 계약서 체결 (Contract signing)
1. Re-confirm the terms, then draft: check the offer letter; set up the SparkLabs Seed money calculation; use the latest contract version (Drive). Standardise 위약벌 (liquidated damages) 12% and 퇴사제한 (employment restriction) 5 years for all.
2. Confirm the total number of contract copies. Parties: SparkLabs / company / company representative (interested party) / other interested parties (case by case). Tip: usually 3 copies (SparkLabs, company, representative). Each extra interested party adds a copy, and their info must be in the contract.
3. Sealing:
   - SparkLabs: request seal/nameplate use in FLEX → replace page-margin seals with perforation → after approval, seal the contract (cover and inner pages).
   - Company: after receiving SparkLabs' sealed contract, the company (and interested parties) seal it. Tip: tell the company to carefully seal the cover 간인, page 간인, and inner-page sealing sections — some miss these.
   - SAFE contracts: use the sealing-method guide.

## #Extra. 해외 투자 시 — 한국은행 외국환거래 신고 (Overseas — Bank of Korea foreign-exchange filing)
- Overseas investments require a securities-acquisition filing with the Bank of Korea. Prepare a full package of documents (for 모태펀드 see the overseas-SAFE reference).
- Prepare the BOK submission package (BOK Gangnam head office). Tip: prepare the full package and mark each document with index Post-its (treat as effectively mandatory). At intake, staff may briefly review and ask for corrections — note them and resubmit (usually by email).
- A completion notice text arrives to the filer's contact point; visit and collect it. This 증권취득신고서 is used later in #5 (payment / operating instruction).
- After payment (#5), the custodian bank stamps the 증권취득신고서 with remittance confirmation; scan and keep in Drive, keep the original in the company's clear file (losing the original is a serious problem).
- After everything, complete the overseas securities-acquisition Log.
- Overseas companies also have post-payment documents — collect them.
- Overseas SAFE maturity is 3 years from the filing date; the BOK SAFE maturity extension has its own process.

## #5. 투자금 납입 / 운용지시 (Payment / operating instruction)
### #5-A. Overall
- After the contract is sealed, scan and save it to the Google Drive folder.
- The operating-instruction date and the payment date must differ by at least one day (consider bank hours).
- Payout timing by fund type: 민간펀드 (private) pays out on the payment date in the morning; 모태펀드 (fund-of-funds) pays around 3pm after 모태 approval.
- Overseas investment is only possible with a private fund — 모태 does not apply.
- Operating-instruction document list — DOMESTIC, 모태펀드: 운용지시서(날인), 투자심의위원회의사록(날인), 사업자등록증, 주주명부, 통장사본, 투자계약서(날인), 준법사항 체크리스트, 의무기재사항 확인서.
- Operating-instruction document list — DOMESTIC, 민간펀드: 운용지시서(날인), 투자심의위원회의사록(날인), 사업자등록증, 주주명부, 통장사본, 투자계약서(날인), 예비실사 체크리스트 서명본.
- Operating-instruction document list — OVERSEAS, 민간펀드: 증권취득신고서, 운용지시서(날인), 외화송금신청서, 투자심의위원회의사록(날인), COI, 송금정보, 투자계약서(날인). The 증권취득신고서 is the one issued after BOK acceptance (before the custodian seal). The original must go to the Management Support Division for the custodian bank.
### #5-B. Email template
- Share with the Management Support Division (경영지원본부). Tip: the figures on the 운용지시서, 투자계약서, and 투자심의위원회 의사록 must all match.

## #6. 투자납입 후 (After payment)
### #6-A. Overall
- Process: SparkLabs sends the post-payment document guide email → company prepares and returns → SparkLabs shares with the Management Support Division → they submit to the custodian bank.
- Send the guide email in the morning of the payment day; use scheduled send so it arrives that morning (to secure a bank balance certificate showing the deposited funds).
- Return the post-payment documents within 30 days max, ideally within 20, because originals must reach the custodian bank within 30 days.
- The company must register the new-share issuance promptly (except secondary/구주 deals) and must not spend the investment before registration completes.
- Post-payment document list — 신주발행 DOMESTIC: 주식미발행확인서 [원본], 주주명부 [원본], 법인 인감증명서 [원본], 법인 등기부등본 [원본], 통장 잔액증명서 [사본 또는 원본].
- Post-payment document list — 신주발행 OVERSEAS: Stock Certificate, Certificate of Incorporation, Business Registration/Business Profile, Bank Account Balance Certificate, Shareholder List (SparkLabs written as the fund name). Overseas new-share investment also needs an '해외투자사실확인서' issued via a law firm (original sent to the custodian bank).
- Post-payment document list — SAFE DOMESTIC: 투자금 수령 영수증 [원본], 법인 인감증명서 [원본], 사업자등록증 [사본], 통장 잔액증명서 [사본 또는 원본], 투자 후 Cap Table (Excel with amount and share class).
- Post-payment document list — SAFE OVERSEAS: Receipt of Investment, Certificate of Incorporation, Business Registration/Business Profile, Bank Account Balance Certificate, Investment List (SparkLabs as fund name).
- SAFE note: a SAFE does not make you a shareholder on payment — only when the condition is met. So collect the '투자금 수령 영수증' and 'balance certificate' to protect the investor's rights.
### #6-C. Receiving documents
- Check documents for errors (share count, issue price, dates).
- Scan all to Drive ("Investment Related Docs" > company folder > new "투자(등기) 후 제출서류" folder).
- Route to the Management Support Division (for the custodian bank): 주주명부, 주식미발행확인서 (SAFE: 투자금 수령 영수증 instead), 법인인감증명서, 법인등기부등본 (원본).
- Keep internally (company clear file): 법인등기부등본 (사본), 잔액증명서.
### #6-D. Notes
- These documents support physical share deposit for the equity SparkLabs acquired. ㉠㉡㉢㉣ go to the custodian bank; the 사본 registry and balance certificate are for SparkLabs' internal files.
- Secondary (구주) deals have no balance certificate — only the non-issuance confirmation is needed (funds went to a personal account, not the company account).
- Overseas: after payment, the custodian bank returns the 증권취득신고서 and the FX remittance receipt/wire message — email these to the Bank of Korea.

## #7. SAFE 투자 지분 전환 (When a SAFE converts to equity)
Documents required to start: follow-on investor's agreement (to check price), conversion cap table, share subscription agreement (신주인수계약서), operating instruction form.
Documents after conversion: shareholders'/board minutes, corporate registry, seal certificate, business registration, stock non-issuance confirmation, shareholder list.
### Overall process
1. Request documents from the company. IMPORTANT: when shareholder/board approval is obtained for the follow-on that triggers conversion, SparkLabs' SAFE conversion must be included in the approved matters. The follow-on registration and the SAFE-conversion registration must complete simultaneously (if prices differ, split into 1st/2nd-class shares for administrative purposes).
2. Explain the upcoming process together with the request.
3. Schedule the signing/sealing date of the SAFE conversion agreement. The company reviews and picks a signing date based on the payment date. Representative and interested parties need corporate and personal seals. The conversion agreement must be signed before the follow-on payment completes. Ideally the refund is received before the follow-on payment date.
4. Prepare the draft; send at least 3 days before the contract date (SparkLabs → company).
5. After the company reviews, sign/seal.
6. Receive the refund amount, on or before the follow-on round's payment date.
### Request (SparkLabs → company): cap table reflecting SparkLabs' conversion; copy of the follow-on (lead) investor's agreement; most recent shareholder list before the follow-on; most recent corporate registry before the follow-on.
### Draft two agreements (get the lead investor's agreement in advance and align): SAFE Follow-on Agreement and Share Subscription Agreement. Required materials include the SparkLabs SAFE conversion calculation (reflect the company's articles, options, discounts; apply the Valuation Cap or discount rate from SparkLabs' existing SAFE; estimate how many shares the amount buys — template "00. Template_SparkLabs SAFE Equity Conversion..."), the lead investor's agreement, and the existing SAFE agreement.
### Contract execution: prepare based on the same-round lead investor's agreement. Confirm at the end: (1) fractional-share (단주대금) payment date; (2) registration schedule — ideally within 2 weeks of the fractional-share payment, normally within 20 days, max 30.
### After execution: request the refund; confirm the registration schedule; confirm receipt of the refund; after signing, prepare an operating instruction form for returning the remaining amount and share it internally with the Management Support Division. Then, after new shares are issued, request the post-conversion documents (deadline: within 2 weeks / 20 / max 30 days of the signing date). The fund name for registration is "SparkLabs Tech First Step Investment Association".
### Post-conversion documents to REQUEST: 주식미발행확인서 [원본 2부] (dated on the fractional-share payment date); 전환 후 주주명부(날인) [원본 2부] (reflect the new issuance; within 1 month of payment; shareholder name = fund name); 법인등기부등본(말소사항 포함) [원본 2부] (reflect the new issuance); 법인인감증명서 [원본 2부] (issued within 3 months before/after signing); 잔액증명서 또는 이체확인증 [1부]; 공증된 (임시)주총/이사회 의사록 [사본 1부].
### Submit to CUSTODIAN bank (via Management Support): 주식미발행확인서 [원본 1부]; 전환 후 주주명부(날인) [원본 1부]; 법인등기부등본(말소 포함) [사본 또는 원본 1부]; 법인인감증명서 [원본 1부].
### SparkLabs INTERNAL files: 주식미발행확인서 [원본 1부]; 전환 후 주주명부(날인) [원본 1부]; 법인등기부등본(말소 포함) [원본 1부]; 법인인감증명서 [원본 1부]; 사업자등록증 [사본 1부]; 공증된 (임시)주총/이사회 의사록 [사본 1부].

## #외전. 기술보증기금(KIBO) 기술평가 BBB (Reference)
- For investment screening, a 14-level technology-evaluation certificate is recognised, not the standard 10-level TCB rating system (investment/startup use).
- BBB in the Technology Credit Rating system is recognised.
`;
