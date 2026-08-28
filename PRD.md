# Product Requirements Document
## SparkLabs Korea — Investment Deal Tracker

**Version:** 1.0 (full product, as of 2026-08-28)
**Live app:** https://sparklabs-doc-tracker.vercel.app
**Author:** Evan Kang, SparkLabs Korea Internship
**Last updated:** 2026-08-28

---

## 1. Product Summary

SparkLabs Deal Tracker is a private internal web application that manages the full lifecycle of a startup investment — from first document submission through the final post-investment compliance filing. It is used by SparkLabs Korea's investment team and the portfolio companies they invest in.

The product consolidates five previously-separate workflows into one tool:

1. Collecting pre-investment documents from portfolio companies
2. Conducting and recording structured due diligence
3. Drafting and negotiating the investment agreement
4. Filing post-investment banking and compliance documents
5. Managing SAFE-to-equity conversions

Every step lives in one place. Both SparkLabs employees and startup founders use the same application, with separate views and carefully restricted permissions.

---

## 2. Background: How This Product Came to Be

This product was built over four weeks as an internship project at SparkLabs Korea.

**Week 1 — the original brief:** Build a document tracker. A company uploads files to a Google Drive folder; the app reads that folder and identifies which required documents have been submitted.

**What actually got built in Week 1:** a 3-screen app (home, document tracker, due diligence checklist) that read a sample Drive folder and displayed the state of that one folder. It demoed fine. It was useless in practice.

**Week 2 — the rewrite:** Two mentor corrections changed the direction entirely.

First: "It should be something where the company uploading the files is prompted to upload their files onto the website, case by case per company, not like right now where we just point at one folder." That moved the product from Drive-reading to direct upload and put the whole site behind a login.

Second: "The document list was wrong." Not 9 documents — 18 domestic and 11 overseas.

The rewrite added: Google login (SparkLabs accounts only), deal CRUD, batch management, comment threads on diligence items, AI cross-check that reads PDF contents, ZIP unpacking, and the contract drafting screen.

**Weeks 3–4 — building out the full workflow:** RCPS and SAFE contract types, per-company Google Drive folder creation, the execution tracker, the SAFE conversion tracker, messaging between SparkLabs and startups, the admin panel, the startup portal, a full security audit (29 vulnerabilities found and fixed), and the inline annotation and paragraph suggestion system.

The product grew from 4 screens to over 20 distinct pages and 60+ API routes.

---

## 3. Users

### 3.1 SparkLabs Employee

An investment team member at SparkLabs Korea. They manage deals day-to-day: uploading documents, running due diligence, drafting agreements, filing post-investment compliance documents.

Access is scoped by four feature permissions (Documents, Agreements, Execution, Conversion) set by the admin. Route middleware blocks access to pages a user is not permitted to see.

**Core needs:**
- See at a glance which companies need attention right now
- Draft, fill, and download investment agreements without leaving the browser
- Run and record due diligence with AI assistance
- Track post-investment filing deadlines across the whole portfolio
- Communicate with startups through the platform

### 3.2 Admin (Superior User)

One SparkLabs employee who also manages the platform. They configure user accounts, set permissions, onboard portfolio companies, and manage contract templates. One admin exists at a time; the role can be transferred.

**Core needs:**
- Add new employees and control what they can access
- Register portfolio companies and link them to startup Google accounts
- Upload updated contract templates without code changes
- Monitor team activity and send platform-wide messages to startups

### 3.3 Startup (Portfolio Company)

A founder or operations contact at a SparkLabs portfolio company. They access a purpose-built portal scoped only to their single deal. They cannot see other companies' data, the due diligence analysis, or the admin controls.

**Core needs:**
- Know which documents SparkLabs still needs, and upload them
- Fill in their company information in the investment agreement
- Propose changes to contract language and track the team's response
- Send and receive messages with SparkLabs without using email or KakaoTalk

---

## 4. Problem Statement

SparkLabs manages 10–30 active portfolio deals at a time, each following the same structured sequence of document collection → due diligence → agreement → execution → conversion. Before this product:

- **Documents were submitted by email.** There was no single place to see which requirements a company had satisfied. The team re-requested documents that had already been submitted.
- **Agreements lived in Word files passed back and forth.** Version confusion was constant. It was unclear what the startup had changed or which copy was current.
- **Post-investment deadlines were tracked in a spreadsheet.** The bank filing deadline is hard at 30 days. Missing it has real legal consequences. There was no automated surfacing of approaching deadlines.
- **Startups had no self-service visibility.** Founders had to email the team to find out their own submission status.
- **Context was siloed.** Diligence notes, agreement values, file submissions, and messages were all in separate files with no connection.

---

## 5. Design Principles

These constraints shaped every product decision and should be preserved in future work:

**The AI suggests; it never decides.** AI results are shown alongside human inputs as recommendations. The human controls every checkbox, field value, and approval. This is non-negotiable for a legal document and a regulated investment process.

**Login is enforced at the front door.** Authentication is checked in one file (`proxy.ts`) that every request passes through, with public pages listed by name as explicit exceptions. The default is blocked. Forgetting to add auth to a new page cannot open a hole.

**Everything the browser sends can be a lie.** "Who is this person?" is answered only from the server-held session, never from a value the browser sent. Author checks on comments, company checks on file operations, and role checks on API routes are all server-side.

**The AI is never handed the whole document set.** Each due diligence check gets only the documents it actually depends on, and there is a hard cap (16 MB) on what any single analysis request can send. A company with many documents cannot quietly produce a large AI bill.

**The blob store is private.** Knowing a file URL is not enough to open it. Real company documents (financial statements, shareholder registries, passports) are sensitive.

**One shared draft.** Agreement records belong to the deal, not to the person currently editing. A draft visible only to one person is useless for a team review.

**Document matching lives in exactly one place.** `lib/documents.ts` is the single source of truth for required document lists and keyword matching. The two screens that use this data (the deal tracker and the overview) cannot disagree.

---

## 6. Feature Specifications

### 6.1 Home / Deal Dashboard

#### 6.1.1 Deal List
The home page shows all active portfolio companies in a searchable, filterable list. Each row shows:
- Company name (Korean and English)
- Market (domestic / overseas) and deal type (Batch / TIPS / General)
- Document completeness badge (how many required docs are still missing)
- Due diligence completeness badge (how many required checks remain open)
- Post-investment payment deadline badge (red if overdue, amber if within 10 days)

Search matches Korean and English names. Filters: batch, fund, affiliation date range (1 / 3 / 6 / 12 months). Archived companies are hidden by default with a toggle to show them.

#### 6.1.2 Action Center
Above the deal list, time-sensitive items from all companies are surfaced in priority order:
- Post-investment bank filing deadlines approaching or past the 30-day hard deadline
- Missing pre-investment documents
- Outstanding due diligence checks

Each item links directly to the specific page. This replaces manual spreadsheet scanning.

#### 6.1.3 Recent Activity Recap
A personal activity widget shows the employee's own recent page views across the last 3 days, so returning users can quickly pick up where they left off.

#### 6.1.4 Sidebar Navigation
A fixed left-side sidebar lists all companies grouped by fund. Each company expands to links for its four feature pages (Documents, Diligence, Agreement, Execution). The current company auto-expands. Links to the Contract ZIP Archive and the Admin Panel appear at the bottom.

#### 6.1.5 Stage Filter
A sidebar filter lets employees narrow the list to companies at a specific point in the process — collecting documents, under due diligence, or agreement-ready — with a live count per stage.

---

### 6.2 Company Management

#### 6.2.1 Company Registry
Each company record holds: Korean name, English name, market (domestic / overseas), deal type (Batch / TIPS / General), batch assignment, fund assignment, affiliation date, and Google Drive folder IDs. Companies are added from the home screen and can be archived (hidden from the active list) or permanently deleted.

#### 6.2.2 Batch Management
Named cohorts (e.g. "Batch 14") group companies in the list and sidebar. Batches are created and deleted from the interface. Deleting a batch un-assigns its companies rather than deleting them.

#### 6.2.3 Fund Management
Funds have a name, category, currency, and optional Google Drive folder. Companies are assigned to a fund. Funds are created and managed from the interface.

#### 6.2.4 Company Overview Page
A per-company summary at `/overview/[dealId]` shows progress across all five investment stages with color-coded status cards. Each card has a progress bar, an icon, a link to the detail page, and editable start/end dates.

A header badge shows the overall health of the deal: green when all stages are done, amber with a count when anything needs attention. An "Attention" box lists specific blockers (missing documents, open diligence items, overdue deadline) with direct links. The execution card turns red-bordered when the 30-day filing deadline is overdue.

---

### 6.3 Document Collection (`/deal/[dealId]`)

#### 6.3.1 Required Document Checklist
Each company has a checklist of required pre-investment documents. Domestic companies need 18 documents; overseas companies need 11. Each list also includes optional documents that are tracked but don't count against completeness.

The two lists are genuinely different — not translations of each other. (Overseas requires a cap table; domestic requires the social insurance enrollment list.)

#### 6.3.2 File Upload
Files are uploaded via drag-and-drop or file picker. Multiple files can be selected at once. Files upload directly from the browser to Vercel Blob storage — they do not pass through the server — so the 50 MB per-file limit is not a server bottleneck. Progress is shown during upload.

#### 6.3.3 ZIP Unpacking
If a `.zip` file is uploaded, it is automatically unpacked server-side into its individual files. Korean filenames (CP949 encoding, common on Korean Windows machines) are decoded correctly.

#### 6.3.4 Automatic Document Matching
When a file is uploaded, its filename is matched against each required document's keyword list. A match ticks the corresponding checklist item. A file that matches nothing appears in an "unclassified" section. The keyword lists carry multiple aliases per document — for example, `등기사항전부증명서`, `법인 등기부등본`, and `등기부` all map to the same document — because the same legal document appears under different names in different contexts.

#### 6.3.5 AI Document Classification
An "AI Guess" button sends unmatched files to Gemini. For each file, the AI returns a suggested document type, a confidence percentage, and a one-sentence reason. Suggestions below 60% confidence are hidden. Suggestions are advisory — the employee confirms or overrides them.

The AI is only given files the keyword matcher couldn't identify. Keyword matching runs first and always wins; the AI handles the leftovers. This keeps AI costs low and predictable.

#### 6.3.6 File Type Detection
File MIME type is determined from the first few bytes of the file content, not from the file extension. A file named `...등기부등본.pdf의 사본` (a Korean "copy of" suffix that removes the `.pdf` extension) is recognized as a PDF from its `%PDF` magic bytes and treated accordingly. This prevents silent analysis failures when companies rename files.

#### 6.3.7 Google Drive Integration
A button creates a Google Drive folder for the company with a standard subfolder structure, shared with the entire `sparklabs.co.kr` domain and any individual Gmail accounts in the allowlist. The folder ID is stored in the deal record.

Once created, Drive files are read into the document checklist as a secondary source alongside uploaded files. Drive-sourced files are read-only — they cannot be deleted through the app. The Drive folder can be deleted from the interface.

#### 6.3.8 File Deletion
Files uploaded through the app can be deleted by an employee with a confirmation click. The deletion endpoint rebuilds the storage path server-side and refuses any filename containing path traversal characters (`../`).

---

### 6.4 Due Diligence Checklist (`/diligence/[dealId]`)

#### 6.4.1 Checklist Structure
Each deal has 13 due diligence items in two groups:

- **Document Verification (items 1–7):** Cross-check submitted documents for accuracy — business purpose match, share count match, articles / preferred shares / subscription rights, option pool, registration order, borrowings and director advances, shareholder composition, IP ownership, and a final cross-check.
- **Follow-up Process (items 8–13):** Procedural steps after verification — written communication, preliminary DD notice, contract drafting, execution, sharing with finance, investment review report.

#### 6.4.2 Item State
Each item has: checked/unchecked toggle, a free-text note field (auto-saves 800ms after the user stops typing), a verified timestamp, and indicators showing which uploaded documents the item depends on (green when present, grey when missing).

#### 6.4.3 Collapsible UX
Items are collapsed by default, showing a one-line summary (status badge, source reference, document pills, verified date, memo/comment indicators). Click to expand the full detail. Controls for Expand All / Collapse All appear at the top.

#### 6.4.4 Filter Bar and Stat Cards
Four filter buttons — All / Issues / Blocked / Unchecked / Done — each with a live count, narrow the visible list. Four summary cards above the list show: Checked, AI Coverage, Issues Found, Docs Missing.

#### 6.4.5 Comment Threads
Each checklist item has a comment thread shared across the team. Comments are append-only, attributed to the author by name, and timestamped. Collapsed items show a 💬 N badge so you can see where discussion is happening without opening every card. Comments are stored separately (not inside the checklist state file) so two people commenting simultaneously cannot erase each other's words.

**Note: Due diligence comments are visible to SparkLabs employees only.** Startup users are explicitly blocked from reading them.

#### 6.4.6 AI Analysis Per Item
An "Analyse" button on each expanded item sends the item's criteria and its related documents (PDFs and images passed as base64) to Gemini. The model returns a recommendation (pass / fail / unclear), a one-sentence summary, and detailed reasoning in both Korean and English. Results are stored and displayed alongside the checkbox. A "Re-analyse" button re-runs the analysis for a single item.

#### 6.4.7 Bulk Accept
A "Bulk Accept AI-cleared" button marks every AI-verified item as checked in one click, without clicking through each item individually.

#### 6.4.8 AI Extra Checks
A "Suggest extra items" mode sends all uploaded documents to Gemini, which proposes additional checks beyond the standard 13 based on what it finds in the documents. Proposed items are displayed separately and do not automatically add to the checklist.

---

### 6.5 Investment Agreement Editor (`/agreement/[dealId]`)

#### 6.5.1 Contract Types
Three contract types are supported:
- **CPS** — 전환우선주 (Convertible Preferred Shares)
- **RCPS** — 상환전환우선주 (Redeemable Convertible Preferred Shares)
- **SAFE** — 조건부지분인수계약 (Simple Agreement for Future Equity)

Each type has a verified `.docx` template. Template slots were processed once in advance (`scripts/prepare-template.py`): the yellow-highlighted fields in the original Word file were identified, their internal XML fragments were joined into single markers (`{{f1}}`, `{{r10}}`, `{{s27}}`), and the yellow editing marks were stripped. Filling the contract is then pure string replacement — fast and safe.

#### 6.5.2 Field Entry
The right side of the screen shows a structured form with fields grouped into logical sections. Each contract type has its own field set (investment amount, share count, issue price, dates, company details, representative details, notice details, penalty rates, interested parties, signature blocks, and standard terms). Date fields are collected as a single YYYY-MM-DD input.

One input field can fill multiple places in the document at once. For example, the company representative's name appears in 4 clauses and all 4 update simultaneously from one field.

#### 6.5.3 Live Contract Preview
The contract renders on the left side in real time. Every keystroke updates the preview instantly. Token slots with no value display the field name as a visible placeholder (e.g. `{{회사명}}`) so it is obvious what is missing. Empty slots are never left as blank whitespace — blank reads as a term intentionally left empty.

#### 6.5.4 Non-Standard Term Alerts
Fields that deviate from SparkLabs' standard investment terms are highlighted in the form with an amber border. Standard values are pre-filled (e.g. liquidated damages at 12%, employment restriction at 5 years, 3 contract copies). Changing a standard value immediately shows the alert.

#### 6.5.5 Orphan Token Handling
Template tokens present in the `.docx` file but not registered as a named field (e.g. tokens added during template revisions) are detected and exposed as plain-text inputs in the sidebar, so they are never silently left unfilled in the downloaded document.

#### 6.5.6 Autosave and Shared Draft
Changes autosave after a 1.5-second idle debounce. A manual Save button is also available. If unsaved changes exist, the browser warns before navigation. The record shows who last saved and when. The draft belongs to the deal — any team member can read and edit it.

#### 6.5.7 Paragraph Overrides
Plain-text contract paragraphs can be edited directly by employees, replacing template content with custom text. Overrides are stored separately from field values and are visually distinguished in the preview.

#### 6.5.8 AI Field Suggestion
An "Suggest from docs" button reads the deal's uploaded documents and proposes values for agreement fields — company name, address, representative name, etc. Suggestions appear inline with an Apply button per field and an Apply All button. Suggestions are advisory; the employee applies them individually.

#### 6.5.9 DOCX Download
The filled contract is downloaded as a `.docx` file, rendered by inserting field values into the original template. Special XML characters (`& < > " '`) are escaped so Word does not report a corrupt file.

#### 6.5.10 ZIP Download and Archive
The agreement can also be downloaded as a `.zip` that packages the contract with supporting documents. A separate Contract ZIP Archive page (`/zip-archive`) lists all deals with saved agreements and provides one-click ZIP download per company — useful for batch export. This page is visible to employees and admin only.

#### 6.5.11 SAFE Panel
SAFE agreements use a distinct panel (`safe-panel.tsx`) accessed via a `⚡ SAFE +` button — intentionally separated from the CPS/RCPS tab strip to prevent accidental selection. The panel includes:
- A live investment-summary header (amount / valuation cap / discount rate)
- A conversion simulator showing both the cap path and the discount path, highlighting whichever gives the investor more shares
- 8 collapsible sections arranged by analytical priority: core terms, payment, parties, interested party, signing date, non-compete, signature blocks, standard terms

---

### 6.6 Annotation System (Employee Comments on Contracts)

#### 6.6.1 Inline Commenting
Employees can leave comments on specific passages of the rendered contract, anchored to the paragraph where the text appears. This replicates the "comment on this text" behavior of Google Docs.

#### 6.6.2 Interaction Flow
Selecting any text in the contract preview shows a floating action bubble above the selection. Clicking "💬 Comment" keeps the selection live (preventing the browser's default behavior of deselecting on click) and opens a floating input. The comment is saved and the paragraph gains a yellow background highlight plus a 💬 badge in the right margin showing the count.

#### 6.6.3 Viewing and Deletion
Clicking the 💬 badge opens a floating card listing all annotations on that paragraph — author name, role, timestamp, and comment text. Annotations can be deleted by their author.

#### 6.6.4 Access Control
Annotations are visible to SparkLabs employees and admin only. Startup users cannot see or create annotations. This is enforced server-side.

---

### 6.7 Startup Suggestion System

#### 6.7.1 Purpose
Startups cannot directly edit the investment agreement beyond a small set of company-information fields. To request changes to terms or contract language, they use the suggestion system. SparkLabs employees then review and accept or reject each suggestion.

#### 6.7.2 Field Suggestions
The startup selects any agreement field and submits a proposed value with an optional note. Resubmitting replaces the prior pending suggestion — one pending suggestion per field per startup at a time.

#### 6.7.3 Paragraph Suggestions (Text-Level Edits)
The startup selects any text within a contract paragraph and proposes replacement text. This covers clause-level changes that aren't tied to a named form field. The original selected text and the proposed replacement are both stored.

#### 6.7.4 Startup View
The startup's pending suggestions are listed in their sidebar with the current status (pending / approved / rejected) and a Retract button for any pending suggestion.

#### 6.7.5 Employee Review in the Contract
Pending field suggestions appear as orange highlights on the relevant form field. Pending paragraph suggestions appear as orange highlights on the paragraph with a struck-through view of the original and the proposed replacement shown below, with Accept and Reject buttons.

A "Paragraph changes suggested" section in the employee sidebar lists all pending paragraph suggestions as a fallback when they are hard to find in a long document.

#### 6.7.6 Approval Effect
Accepting a field suggestion updates the agreement field value. Accepting a paragraph suggestion applies the replacement as a paragraph override (the same mechanism as a direct employee edit): the client extracts the current text from the rendered DOM, applies the find-replace, and sends the result to the server, which stores it as `overrides[blockKey]`. Rejected suggestions are marked and archived.

---

### 6.8 Execution Tracker (`/execution/[dealId]`)

#### 6.8.1 Purpose
Tracks post-signing compliance obligations in two sequential stages: 운용지시 (Operating Instruction — initiating the bank payment) and 투자납입 후 (Post-Payment Document Collection — compliance filings due within 30 days of payment).

#### 6.8.2 Configuration
The employee sets the fund type (모태펀드 or 민간펀드; overseas is always private) and the investment structure (new shares or SAFE). These two settings determine which document checklists apply.

#### 6.8.3 Operating Instruction Checklist
Document requirements by configuration:
- Domestic + 모태펀드: 8 documents
- Domestic + 민간펀드: 7 documents
- Overseas: 7 documents

Each item has a checkbox, a file upload slot, and a free-text comment field.

#### 6.8.4 Post-Payment Checklist
4–5 documents depending on investment structure. Each document specifies its routing destination (custodian bank or SparkLabs internal file).

#### 6.8.5 Key Dates and Deadline Tracking
The tracker records the instruction date and payment date. The post-payment document deadline is calculated from the payment date: 20 days (target) and 30 days (hard bank deadline). The home page Action Center surfaces the hard deadline when within 30 days.

#### 6.8.6 Number Consistency Cross-Check
Three key figures — share count, price per share, and total investment amount — must match across three documents: the investment agreement, the operating instruction, and the committee minutes. The tracker has a side-by-side table where the employee enters the figures as they appear in each source document, and mismatches are immediately flagged.

#### 6.8.7 AI Number Extraction
An AI button reads the uploaded OI documents and attempts to extract the share count, price per share, and total amount to pre-fill the consistency table.

#### 6.8.8 AI Execution Review
An "AI Review" button sends the current execution state to Gemini, which returns a structured summary: overall progress, missing items, deadline risks, and recommended next actions.

#### 6.8.9 Email Drafts Panel
A sub-panel helps draft the operational emails that accompany bank filings. An AI-powered tool reads uploaded documents to extract the company's contact email address. Email composition opens a Gmail compose window (the email body is copied to the clipboard for pasting, as browser `mailto:` links have character limits and may fail if no mail client is configured).

#### 6.8.10 Autosave
All changes autosave after a 700ms idle debounce.

---

### 6.9 SAFE Conversion Tracker (`/conversion/[dealId]`)

#### 6.9.1 Purpose
Manages the event when a portfolio company's SAFE converts into equity shares during a follow-on funding round.

#### 6.9.2 Process Steps
Six sequential steps with checkboxes: request documents → explain process to company → schedule signing → prepare draft agreement → sign and seal → receive refund.

#### 6.9.3 Document Collection
Four pre-conversion documents to request from the company. Six post-conversion documents to collect, each with a copy count and routing label (custodian bank or SparkLabs internal file).

#### 6.9.4 Key Dates and Deadlines
Three date fields: lead payment date, signing date, fractional-share payment date. The registration deadline is calculated from the fractional-share payment date: 14 days (ideal), 20 days (normal), 30 days (maximum).

#### 6.9.5 Conversion Calculator
A client-side calculator estimates the conversion outcome. Two methods: discount method and cap method. Inputs: SAFE investment amount, follow-on round price per share, discount percentage, valuation cap, pre-round fully diluted share count. Output: conversion price and estimated share count. This is an estimate for internal planning — not an authoritative legal calculation.

#### 6.9.6 AI Calculator Fill
AI reads uploaded documents and auto-fills the calculator inputs.

#### 6.9.7 AI Conversion Review
Same structure as the execution AI review — a structured advisory summary of progress, gaps, and recommended actions.

#### 6.9.8 Autosave
700ms idle debounce.

---

### 6.10 Messaging

#### 6.10.1 Per-Deal Thread
Each deal has one message thread between SparkLabs and the startup. Messages carry sender attribution (SparkLabs or startup, plus the sender's name) and a timestamp.

#### 6.10.2 Startup Access
The startup portal's Messages tab shows the full thread. The portal polls every 30 seconds when the tab is open so new messages appear without a page reload.

#### 6.10.3 Read Receipts
The startup's last-read timestamp is tracked. The Admin Panel's Portfolio Companies tab shows this timestamp so the team can see whether a startup has read their most recent message.

#### 6.10.4 Email Notifications
When SparkLabs sends a message, the Resend email service sends a notification to the startup's registered address with a link to their portal. If Resend is not configured, this step is silently skipped — the in-app message is always sent regardless.

---

### 6.11 Startup Portal (`/startup/[dealId]`)

A purpose-built interface for portfolio company contacts. The portal is scoped entirely to the startup's own deal — they cannot navigate to any other company's data or any internal SparkLabs page.

**Four sections:**

- **Home:** Status overview. Shows which documents are submitted and which are outstanding, and the current phase of the investment process.
- **Documents:** Upload pre-investment documents. Drag-and-drop or file picker. Same ZIP-unpacking and document matching as the employee view.
- **Execution:** Upload post-investment compliance documents requested during the execution phase.
- **Messages:** Two-way message thread with SparkLabs. Polls for new messages every 30 seconds.

**Agreement access (conditional):** If the admin grants the startup the "Agreement" permission, a fifth section appears: the investment agreement. The startup sees the same contract editor but in a restricted mode:
- They can directly edit a small allowlisted set of company-information fields (company name, address, representative name, contact information, notice details).
- Any change to other fields or contract language goes through the suggestion system.
- The Submit Suggestion button is surfaced wherever they can interact.

The startup nav bar is sticky (stays visible while scrolling the contract).

---

### 6.12 Admin Panel (`/admin`)

Accessible to the admin only. Five tabs:

#### 6.12.1 SparkLabs Team
Lists all employee accounts. For each: name, email, last-seen timestamp, and a permission matrix (checkboxes for Documents, Agreements, Execution, Conversion). Changes take effect on the employee's next sign-in. Also contains the form to transfer the Superior User role to another employee.

#### 6.12.2 Portfolio Companies
Lists all startup accounts. For each: email, linked deal, company name, active/inactive toggle, per-startup permissions (Documents, Agreement), last-message read-receipt timestamp.

Add new startup account form: email, deal assignment, display name, permissions. Remove startup account.

#### 6.12.3 Activity Log
Shows page-view events across all employee accounts over the last 10 days (who visited which page and when). Backed by session logging that runs on every page load.

#### 6.12.4 Broadcast
Sends a single message simultaneously to all active startup accounts via the in-app messaging system.

#### 6.12.5 Templates
Manage the `.docx` contract templates for CPS, RCPS, and SAFE. Each template shows whether a custom upload is in use or the bundled default is active, with the upload date and file size. Admin can upload a new template or revert to the bundled default — no developer involvement needed.

---

### 6.13 AI Features — Full List

All AI features require `GOOGLE_AI_API_KEY`. All are triggered by a user action — nothing runs automatically. Model: `gemini-2.5-flash-lite` (overridable via `GEMINI_MODEL` environment variable).

| Feature | Where | What it does |
|---|---|---|
| Document classification | Deal tracker | Reads unmatched filenames/contents, suggests which required document each file is, with confidence % |
| Execution doc classification | Execution tracker | Same, for execution-phase documents |
| Due diligence analysis | Diligence checklist | Per-item: reads related uploaded documents, returns pass/fail/unclear + reasoning (Korean + English) |
| Extra DD checks | Diligence checklist | Reads all documents, proposes additional checks beyond the standard 13 |
| Agreement field suggestion | Agreement editor | Reads uploaded documents, proposes values for all agreement form fields |
| Number extraction | Execution tracker | Reads OI documents, extracts share count, price, and amount |
| Execution review | Execution tracker | Summarizes progress, missing items, deadline risks, next actions |
| SAFE calculator fill | Conversion tracker | Reads documents to fill conversion calculator inputs |
| Conversion review | Conversion tracker | Same advisory structure as execution review |
| Email extraction | Execution email drafts | Reads uploaded documents to find the company's contact email address |
| Process assistant | Anywhere (widget) | Chat grounded in SparkLabs process documentation; can answer general investment questions; can load a specific deal as context |

**Model selection rationale:** A benchmark was run against six representative filename classification cases (including one deliberately unanswerable case — `IMG_4821.jpg`). `gemini-2.5-flash-lite` scored 6/6 at a cost of $0.000233/run, making it 13× cheaper than Claude Haiku and 3× cheaper than `gemini-3.1-flash-lite` for identical accuracy. Since all candidate models tied on quality, price decided. The model is called directly via the Gemini API (not through a proxy), removing one network hop and a per-call markup.

---

### 6.14 Bilingual Support

The product is bilingual in Korean and English. A language toggle appears in the application header. All labels, document names, checklist items, contract field labels, AI analysis outputs, and error messages have both language variants. English is the default on load.

Korean company names are used as URL identifiers (e.g. `/deal/제스트`). Korean is the canonical language for legal document names and due diligence criteria — English labels are translations, not replacements.

---

## 7. Security

### 7.1 Authentication
All authentication goes through Google OAuth (NextAuth v5). No passwords are received, stored, or managed by the application. Google confirms the user's identity; the application checks the result.

Two conditions must both be true to grant access:
1. The signed-in email must be one Google has verified the user owns (not self-reported).
2. The email must be on the `sparklabs.co.kr` domain OR appear in the `ALLOWED_EMAILS` list.

### 7.2 Authorization
Role is determined server-side on every request by matching the signed-in email against the startup accounts list, the admin config, and the employee list. Route middleware (`proxy.ts`) enforces role-based access for every page. Each API route independently checks authentication and role — middleware alone is not trusted.

### 7.3 Startup Isolation
Startup users are restricted to:
- Their single deal's pages and API routes
- A narrow allowlist of API paths (`/api/deals/{their dealId}/status`, `/api/deals/{their dealId}/files`, `/api/deals/{their dealId}/agreement`)
- Writing only to their own file upload folder
- Writing only to the allowlisted agreement fields

They are explicitly blocked from: due diligence routes, analysis routes, stage-review routes, execution routes, conversion routes, classify routes, unzip routes, the assistant with another company's deal context, and all admin routes.

### 7.4 Storage
Vercel Blob is configured with private access. Files are not publicly addressable by URL. Real company documents (financial statements, shareholder registries, passports, corporate registry filings) require an authenticated signed URL to access.

### 7.5 Path Traversal Prevention
File deletion and upload routes rebuild the storage path server-side from the deal ID and the filename, and refuse any filename containing `/` or `..` sequences.

### 7.6 Security Audit
A comprehensive security audit was run across all API routes and authentication code in Week 4 (2026-08-25). 29 confirmed vulnerabilities were found (Critical 3, High 16, Medium 7, Low 3) and all were fixed before the production redeploy.

---

## 8. Technical Architecture

### 8.1 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.3 (App Router, server + client components) |
| Language | TypeScript 5, React 19 |
| Styling | Tailwind CSS 4 |
| Auth | NextAuth v5 (Google OAuth) |
| Storage | Vercel Blob (all files and JSON data, private access) |
| AI | Google Gemini API (direct) — `gemini-2.5-flash-lite` |
| Email | Resend (optional — silently no-ops if unconfigured) |
| Google Drive | googleapis SDK |
| ZIP | fflate |
| Deployment | Vercel |

### 8.2 Storage Model

All application data is stored as JSON files in Vercel Blob. There is no relational database. Concurrency model: last-write-wins. This is intentional for a small team — the complexity of conflict resolution is not justified at this scale.

Key data files:

| Path | Contents |
|---|---|
| `config/deals.json` | Company registry and batch list |
| `config/funds.json` | Fund list |
| `agreements/{dealId}.json` | Agreement field values, paragraph overrides, metadata |
| `agreement-suggestions/{dealId}.json` | Startup suggestions (field and paragraph) |
| `annotations/{dealId}.json` | Employee contract annotations |
| `diligence/{dealId}.json` | Diligence checklist state (checks, notes, timestamps) |
| `analysis/{dealId}.json` | AI analysis results per diligence check |
| `comments/{dealId}.json` | Diligence item comment threads |
| `execution/{dealId}.json` | Execution tracker state |
| `conversion/{dealId}.json` | Conversion tracker state |
| `messages/{dealId}.json` | Per-deal message thread |
| `sessions/{email}.json` | Page-view event log per employee (last 10 days) |
| `timeline/{dealId}.json` | Phase start/end dates |
| `admin/admin-users.json` | Employee accounts and permissions |
| `admin/admin-startups.json` | Startup accounts |
| `admin/admin-config.json` | Superior user designation |
| `templates/cps-agreement.docx` | CPS contract template |
| `templates/rcps-agreement.docx` | RCPS contract template |
| `templates/safe-agreement.docx` | SAFE contract template |
| `deals/{dealId}/{filename}` | Uploaded pre-investment documents |
| `execution-oi/{dealId}/{filename}` | Uploaded operating instruction documents |
| `execution-post/{dealId}/{filename}` | Uploaded post-payment documents |

### 8.3 Key API Routes

```
GET/POST  /api/companies                                Create / list companies
GET/PATCH/DELETE /api/companies/[dealId]                Read / update / delete company
DELETE    /api/batches/[batchId]                        Delete batch
GET/POST  /api/funds                                    List / create fund

GET       /api/deals/[dealId]/status                    Document checklist status
DELETE    /api/deals/[dealId]/files                     Delete uploaded file
POST      /api/deals/[dealId]/unzip                     Unpack ZIP upload
POST      /api/deals/[dealId]/classify                  AI classify doc-stage files
POST      /api/deals/[dealId]/classify-exec             AI classify execution files
POST/DELETE /api/deals/[dealId]/drive-folder            Create / delete Drive folder

GET/PUT   /api/deals/[dealId]/agreement                 Read / save agreement record
POST      /api/deals/[dealId]/agreement/suggest         AI suggest field values
GET       /api/deals/[dealId]/agreement/download        Download as .docx
GET       /api/deals/[dealId]/agreement/zip             Download as .zip
GET/POST/DELETE /api/deals/[dealId]/agreement/annotations   Annotations CRUD
GET/POST  /api/deals/[dealId]/agreement/suggestions     List / create suggestions
PATCH/DELETE /api/deals/[dealId]/agreement/suggestions/[id] Review / delete suggestion

GET/PUT   /api/deals/[dealId]/diligence                 Read / save diligence state
GET/POST  /api/deals/[dealId]/comments                  Read / post check comments
GET/POST  /api/deals/[dealId]/analysis                  Read / trigger AI analysis

GET/PUT   /api/deals/[dealId]/execution                 Read / save execution record
POST      /api/deals/[dealId]/execution/ai-numbers      AI extract numbers from OI docs
GET/POST/DELETE /api/deals/[dealId]/execution/oi-files  OI file management
GET/POST/DELETE /api/deals/[dealId]/execution/post-files Post-payment file management

GET/PUT   /api/deals/[dealId]/conversion                Read / save conversion record
POST      /api/deals/[dealId]/conversion/ai-calc        AI fill conversion calculator
POST      /api/deals/[dealId]/stage-review              AI stage review
POST      /api/deals/[dealId]/suggest-email             AI extract company email
GET/PATCH /api/deals/[dealId]/timeline                  Read / update phase dates

GET/POST  /api/messages/[dealId]                        Read thread / post message
POST      /api/messages/[dealId]/read                   Mark messages as read

POST      /api/upload                                   Issue Vercel Blob upload token
POST      /api/assistant                                AI process assistant (chat)
POST      /api/session-log                              Log page view event

GET/PATCH /api/admin/users                              Employee accounts / permissions
POST/PATCH/DELETE /api/admin/startup-accounts           Startup account management
POST      /api/admin/superior                           Transfer admin role
GET       /api/admin/activity                           Activity log
POST      /api/admin/broadcast                          Broadcast message to all startups
GET/POST/DELETE /api/admin/templates                    Contract template management
```

---

## 9. Design Constraints

1. **No database.** All data is JSON in Vercel Blob. Features requiring transactions, relational queries, or strong consistency are out of scope for the current version.
2. **No real-time collaboration.** Two users editing the same record simultaneously will have the later save silently win. This is acceptable for a team of 5–10.
3. **AI is always on-demand.** Nothing runs automatically. Every AI call is a user action. Cost is controlled; bills are predictable.
4. **Small scale.** Designed for 5–10 internal users and up to ~50 active startup accounts. Not designed for horizontal scale.
5. **Korean-first content.** Korean names are canonical in URLs and document metadata.
6. **Email is optional.** The product functions fully without Resend. Notifications are a convenience.
7. **PDF is browser-print.** The `.docx` is the authoritative download for anything requiring a stamp or signature. The PDF (generated by the browser's print function) is for sharing and review. Layout may differ slightly.

---

## 10. Known Limitations

- **No change history.** Edits to agreements, diligence state, and execution records replace prior state without versioning. There is no rollback.
- **No real-time employee notifications.** There is no in-app notification bell for employees when a startup submits a suggestion or sends a message. Employees must check manually.
- **No multi-deal startup accounts.** A startup account is tied to exactly one deal.
- **No PDF conversion service.** The PDF export is browser-print. For legally submitted documents, the `.docx` download is the correct format.
- **No offline support.** The app is fully server-dependent.
- **Drive integration is read-only for Drive files.** Files from Google Drive appear in the checklist but cannot be deleted through the app.
- **Last-write-wins.** Two employees editing the same record simultaneously will silently lose one set of changes.

---

## 11. Remaining Work

- [ ] Obtain the internal 예비실사 체크리스트 (Preliminary Diligence Checklist) standard form and add it as a formal checklist section
- [ ] Wire in a server-side PDF conversion service if a byte-identical PDF is required for submission
- [ ] Clean up the unused `OPENROUTER_API_KEY` environment variable from the Vercel dashboard (replaced by `GOOGLE_AI_API_KEY`)
- [ ] In-app notification for employees when a startup submits a suggestion or message
