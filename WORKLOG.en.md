# Work Log — Document Collection Tracker & Due Diligence Checklist

*English version of `WORKLOG.md`. Same content, for readability.*

Author: Evan Kang
Date: 2026-08-13 (first written 2026-08-12)
Live app: https://sparklabs-doc-tracker.vercel.app

> Written for whoever does this internship next. The prompts and the dead ends
> are recorded as they actually happened, not cleaned up afterwards.

---

## 1. What this is

Four screens. (Week 1 had only ② and ③; ① and ④ arrived in week 2.)

**⚠️ The assumption that changed — who uploads:** the first version gave each company a link to upload through. Then the mentor clarified it: **companies email their documents in, and a SparkLabs employee uploads them.** So the **whole site now sits behind a login** and no screen is reachable by an outsider. That one sentence changed the design substantially (see §6).

**① Home / progress** — `/`
The company list with each company's progress. A sidebar on the left filters by batch and holds the archive; a summary sits across the top. You can **add a company from the screen** (name / Korean or overseas / deal type), create batches, and assign companies to them. Finished companies can be **archived**, or **permanently deleted** if it really has to go. A **stage filter** in the sidebar lets you narrow the list to companies at a given point in the process — collecting docs, under due diligence, or agreement ready — with live counts for each.

**② Document collection tracker** — `/deal/<company>`
The documents a company owes us before investment. When a file arrives, its filename is matched against the checklist and the item ticks itself. Wrongly uploaded files can be removed, and anything the filename matcher can't identify gets **an AI guess at which document it is**. If the company sent everything as **one ZIP, it gets unpacked** into individual documents.

**③ Due diligence checklist** — `/diligence/<company>`
The 13 checks that read the submitted documents against each other. Each has a checkbox and a memo field, and saves automatically. Each item also has a **comment thread the whole team shares**.
And **the AI reads the actual documents** — not the filenames, the PDF contents. It judges whether the item's standard is met, explains why, and suggests whether to tick it. Anything it notices outside the standard 13 items goes in a separate section.

**④ Investment agreement** — `/agreement/<company>`
The mentor's Word contract template, **filled in on the site**. The 85 places that were highlighted yellow in the original are wired to 57 input fields on the right, so typing shows up immediately in the contract preview on the left. When it's complete, **download it as .docx or .pdf**. An **AI autofill** button reads the uploaded documents and suggests values for empty fields as grey placeholder text — an Apply chip appears next to each suggested field, and an Apply all button fills everything at once. The Save and Save as PDF buttons are visually distinct (green filled vs. bordered) so they cannot be confused at a glance.

### The checklist

- Korean companies: 18 required + 3 "if applicable"
- Overseas companies: 10 required + 1 "if applicable"

The two lists are **genuinely different documents, not translations of each other.** (Overseas requires a cap table; Korean requires the social insurance enrollment list.)

### Due diligence items

The 13 points from the mentor's "#3. 서류 실사" document, split into two groups:

- **Document verification (1–7)** — business purpose match, share count match, articles/preferred shares/subscription rights, option pool, registration order, borrowings and director advances, shareholder composition, IP ownership, final cross-check
- **Follow-up process (8–13)** — written communication, preliminary DD notice, contract drafting, execution, sharing with finance, investment review report

### Stack

| | |
|---|---|
| Framework | Next.js 16.3 (App Router) + React 19.2 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| File storage | Vercel Blob (private) |
| AI | Google Gemini API (direct) — `gemini-2.5-flash-lite` |
| Login | Auth.js (next-auth v5) + Google sign-in, `@sparklabs.co.kr` only |
| Contracts | Fills the Word (.docx) file directly — `fflate` |
| Hosting | Vercel |

### Where the code lives

| File | Job |
|---|---|
| `lib/documents.ts` | Required documents + filename matching. **Change the checklist here and nowhere else.** |
| `lib/diligence.ts` | The 13 due-diligence items |
| `lib/deals.ts` | Company and batch types + the sample companies you start with |
| `lib/deals-store.ts` | Add, edit, archive and delete companies (this is where screen-added companies live) |
| `lib/deal-status.ts` | Works out which documents have arrived (shared by every screen) |
| `lib/storage.ts` | Lists, reads and deletes uploaded files |
| `lib/unzip.ts` | Unpacks ZIP archives (including Korean filenames) |
| `lib/diligence-store.ts` | Saves checkbox and memo state |
| `lib/comments-store.ts` | Per-item comments (one comment = one file) |
| `lib/classify.ts` | The AI filename guesser |
| `lib/analysis.ts` | **The AI reads document contents and judges each DD item** |
| `lib/openrouter.ts` | The single door to the AI — calls Google Gemini directly; swap the model here |
| `lib/agreement-suggest.ts` | AI reads uploaded documents and returns suggested values for agreement fields |
| `auth.ts` / `proxy.ts` | Login, and turning away anyone who isn't signed in |
| `lib/agreement-fields.ts` | The map from 57 input fields to 85 places in the template |
| `lib/agreement-docx.ts` | Puts the values into the Word file |
| `lib/agreement-store.ts` | Saves the draft (per company, shared by everyone) |
| `templates/investment-agreement.docx` | The contract template with its fillable slots marked |
| `app/deal/[dealId]/` | The upload screen |
| `app/diligence/[dealId]/` | The DD screen |
| `app/agreement/[dealId]/` | The contract screen |
| `app/api/deals/[dealId]/agreement/suggest/` | POST endpoint for AI autofill suggestions |
| `app/api/upload/` | Issues upload tokens |
| `scripts/bench-models.mjs` | AI model comparison harness (see §5) |
| `scripts/prepare-template.py` | Turns the yellow highlights in the contract into fillable slots (see §10) |

---

## 2. The rewrite

**The first version was pointed the wrong way.** It read the mentor's sample Google Drive folder and displayed the state of that one folder. It demoed fine and was useless in practice.

Three pieces of mentor feedback:

1. **Companies must be able to upload their own files.** Not us peering into a folder — a per-company link, and the company uploads.
2. **The document list was wrong.** Not 9 documents; 18 domestic and 10 overseas.
3. **The gaps at #6 and #9 in the file numbering meant nothing.** He'd removed a few files when assembling a sample batch, that's all.

Point 3 stung, because I had written **"need to confirm with the mentor what documents #6 and #9 are"** into the first work log as a finding. Not every pattern in the data means something. I should have asked before recording a guess as a fact.

### ⚠️ Where this deliberately departs from the written brief (on the mentor's instruction)

**What the brief says** (Sheet 3, core requirement #2):

> **Google Drive upload recognition** — when document files are placed in a Drive folder the mentor has prepared, the web app identifies which document each one is from its filename.

**What was actually built:** **direct upload** through a per-company link. The app does not read a Drive folder.

**Why:** the mentor instructed otherwise, verbally. His words: it should be something where the person uploading is prompted to upload their files onto the website, **case by case per company**, rather than us pointing at one folder and displaying what we find.

So: **the document says Drive recognition; the mentor asked for direct upload, and that's what shipped.** In real practice a company submits its own paperwork rather than us reading a folder over their shoulder, so the verbal instruction matches the actual workflow better than the written one.

**The Drive integration was switched off, not deleted** (`lib/drive.ts`, `readsSampleDriveFolder: false`). If the original requirement ever needs honouring literally, it's a config flag, not a rebuild.

**Lesson:** when the document and a person disagree, the person is the more recent source. But **write down why you diverged** — otherwise you have no answer when someone asks why requirement #2 wasn't done.

**What survived the rewrite:** the Drive integration (`lib/drive.ts`) wasn't deleted, just switched off (`readsSampleDriveFolder: false`). It can be turned back on, and it's in git either way.

---

## 3. How it was built

Built entirely by talking to Claude Code, an AI coding tool that runs in a terminal. I started this with no programming experience.

**The biggest lesson: there was no single magic prompt.** Short back-and-forth beat long, detailed requests every time.

### The prompts I actually used

Understanding the assignment:

```
can you find the original korean file for me and just translate it
```

→ There were English versions of the spreadsheet, but they were incomplete. Reading the Korean original directly was more accurate.

Changing direction (the most important prompt of the project):

```
ok so basically, what we have right now is not good enough. i talked with my
mentor. he said that firstly, we want it to be something where the person who
is uploading these files can be prompted to upload their files onto the
website, so that it is user by user case, not like right now where we just
went and showed our results to our specific file. also, our list of documents
needed was incorrect. we needed much more, ill attach the list.
```

→ **Passing on the mentor's words verbatim worked better than summarising them.** Summarising loses the part you didn't realise was load-bearing.

Checking the work:

```
hey so where did you get the info regarding zest, and why is it checking off
which documents we apparently have without the user having uploaded a file
```

→ If the screen looks wrong, say so immediately. That one was a real bug (② below).

Choosing a model:

```
we have an openrouter api that was given to me to find the most cost efficient
and best fitting api for our tasks. so find the best one please.
```

→ Not "pick the best one" but **"pick the best one *by these criteria*"** — naming cost and fit is what turned it into a measurement instead of an opinion.

When lost:

```
im kinda lost, what did you just do. explain it to me like im 5
```

**The three prompts that worked best in week 2 —**

When I didn't know how something should work, I asked **"is this possible" rather than "build it":**

```
my mentor wants a login page that only accepts sparkslabs employees. how would
we do that and is that possible without their explcit passwords to their
sparkslabs emails?
```

→ I got **the options before the code.** That's where I learned we never have to handle passwords.

When an assumption changed, I passed on **exactly that one sentence:**

```
companies wont be the ones uplaoding the files, it will be sparklabs employees
that upload them once the companies send it to them externally
```

→ That single line moved the entire site behind a login. **"Who uses this" has to be settled before the features.**

When something was broken:

```
theres an issue with the ai analysis, it says ai analysis failed on every
single check. we need this fixed right now
```

→ **"Every" and "always" are real information.** One failing check is a problem with that document; all of them failing means there's a single shared cause.

---

## 4. What went wrong, and how it got fixed

The brief says evaluation weighs process over polish, so every dead end is recorded here.

### ① The same document had two different names — the most important bug

The file in the Drive folder is called `등기사항전부증명서`. The glossary calls the same document `법인 등기부등본`. Two names, one document.

The first version of the matching logic only looked for `등기부등본`, so it **would have reported the document as missing while it was sitting right there in the folder.**

**Fix:** let each document carry several aliases.

```ts
keywords: ["등기사항전부증명서", "등기사항증명서", "등기부등본", "등기부", ...]
```

**Lesson:** if I'd built purely from the glossary without looking at the actual files first, the demo would have been wrong. Look at the real data before writing the code.

### ② Documents were ticked off before anything was uploaded

I opened the new upload screen and **several documents were already ticked, with nothing uploaded.** It was still reading the mentor's sample Drive folder.

From the company's point of view, that's a screen claiming they'd submitted things they hadn't. Fixed by switching the Drive source off.

**Lesson:** don't scroll past something that looks odd. Asking about it is what caught this.

### ③ Files bigger than 4.5MB

IR decks run 15–20MB (Zest's is 17MB). Uploads that pass through the server cap out at 4.5MB.

**Fix:** the browser now uploads straight to storage without going through the server. The server only issues a token saying "this path is allowed." Limit set to 50MB.

### ④ Environment variables that silently didn't save

I entered them in the Vercel dashboard and they never saved. Nothing on screen indicated a problem — the deployed app just kept showing sample data.

```
npx vercel env ls
```

**Lesson:** environment variables only apply to deployments created **after** they're saved. Save them, then deploy again.

### ⑤ An invisible character broke authentication

Pasting an environment variable brought an invisible character (a BOM) along with it. The value looked identical on screen and authentication failed anyway.

**Fix:** trim whitespace when reading the value.

### ⑥ Spaces in an environment variable name

I put the OpenRouter key in `.env.local` as `OPENROUTER API KEY`. **Environment variable names cannot contain spaces.** It has to be `OPENROUTER_API_KEY`.

The error just says the key is missing, so you stare at a file that visibly contains the key and can't see why.

**Lesson:** environment variable names are **capitals and underscores only**.

### ⑦ PowerShell wouldn't run npx

```
npx : File ...\npx.ps1 cannot be loaded because running scripts is disabled
```

**Fix:** use `npx.cmd` instead of `npx`, or set this once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### ⑧ `!` is not a PowerShell command

In the Claude Code input box, prefixing a line with `!` means "skip the AI, run this in the terminal." Typing that same line **into PowerShell itself** is an error — in PowerShell, `!` means "not".

| Where you're typing | What to type |
|---|---|
| PowerShell (`PS C:\...>`) | `notepad .env.local` |
| Claude Code input box | `! notepad .env.local` |

### ⑨ A test showed Korean as `???` — and the app was fine

Saving a Korean memo and reading it back returned `???`. It looked like an app bug. It was PowerShell mangling the request on the way out; sending explicit UTF-8 bytes proved the app stored and returned Korean correctly all along.

**Lesson: when a test fails, suspect the test first.** Check before changing the thing being tested.

### ⑩ SparkLabs emails couldn't log in — another invisible character

Login went up, and the mentor's attempt with their company account returned **`The OAuth client was not found`**.

I compared the client ID registered with Google against the value in Vercel **character by character. They were identical.** So I looked at the URL the browser actually sends to Google, and there was **one invisible character (a BOM)** sitting in front of `client_id=`. As far as Google was concerned, that client didn't exist.

The cause was mine: PowerShell prepended a BOM when I piped the value into Vercel.

**Two fixes —**

1. Writing values: `$OutputEncoding = New-Object System.Text.UTF8Encoding($false)`
2. Reading values: the code that reads environment variables (`lib/env.ts`) strips a BOM. Better for the code to prevent it than for a person to remember.

**That was the third time a BOM cost time on this project** (⑤ the Drive credential, this login, and once when I put a BOM *inside* the code I was writing to strip BOMs). **When something looks identical but doesn't work, suspect a character you can't see.**

### ⑪ A security hole I wrote myself — anyone could delete anyone's comment

Comments on DD items could be posted and deleted. To decide *who* was deleting, I trusted **a value the browser sent**.

Which means changing that value in the browser lets you **delete a colleague's comment.** I thought I'd restricted deletion to your own comments; in reality nothing was being enforced at all.

**Fix:** the server **re-reads the stored comment** and compares its recorded author against the signed-in user.

**Lesson: everything the browser sends can be a lie.** "Who is this" can only be answered from the login the server holds.

### ⑫ The ZIP upload "didn't work"

Companies often send everything as a single ZIP. Uploading one appeared to do nothing.

It turned out **the upload worked perfectly** (7.2 MB, verified in the store). Nothing existed to unpack it. "Didn't work" meant **not built**, not failed.

A problem that surfaced while building it: **Korean filenames came out as garbage.** ZIPs made on Korean Windows store filenames as CP949, not UTF-8. The ZIP format has a flag saying "these names are UTF-8", so when that flag is missing the names get decoded as CP949.

### ⑬ Every AI analysis failed — files with no extension

All 13 DD items showed "AI analysis failed". Reproducing it locally with the real documents produced the actual cause:

```
Unsupported MIME type: application/octet-stream
```

The file was named `..._등기부등본.pdf의 사본` — "copy of". **It doesn't end in `.pdf`,** so it was stored as "file of unknown type", and Google rejects unknown types.

**Fix: don't trust the extension, look at the first few bytes of the file.** A PDF starts with `%PDF`. Whatever it's called, if the contents are a PDF it's treated as one.

**Fixed alongside it:** the on-screen `provider returned error` carried no information. The real message was buried inside the response at `error.metadata.raw`. It's surfaced now, so the next person sees the cause immediately instead of hunting for twenty minutes.

**Lesson: don't trust the failure message on screen — find the real error.** And when you show it to a user, show the real one.

### ⑭ Square brackets in a folder name — `[dealId]`

Editing several files at once with PowerShell's `Resolve-Path` **silently skipped every folder with brackets in its name.** PowerShell reads `[dealId]` as a pattern meaning "one of the characters d, e, a, l". Next.js uses brackets for folder names, so that's most of the project.

**Fix:** paths that aren't interpreted as patterns (`Join-Path` plus literal paths). Source code changes now go through the editing tool only.

### ⑮ The build failed on a 60-second limit — and the code wasn't the problem

The pre-deploy build failed because pages that **do nothing at all** — `/_not-found`, `/favicon.ico` — took more than 60 seconds.

It's tempting to blame whatever you just wrote, but **the pages that failed had nothing to do with the new code.** The laptop was simply busy with something else. Clearing the cache (`.next`) and rerunning passed.

**Lesson: look at what the failures have in common.** If it's "everything got slow" rather than "the thing I touched", it's the environment, not the code.

---

## 5. How the AI model was chosen

SparkLabs supplied an OpenRouter API key. **OpenRouter is a middleman** — one key reaches 400+ models from Google, OpenAI, Anthropic and others. No separate signup or billing per provider.

The task was "find the most cost-efficient model that fits." Rather than pick on instinct, I **built a test and measured** (`scripts/bench-models.mjs`).

The test cases are **six filenames the keyword matcher genuinely fails on** — e.g. `제스트_등기_최신본_v3.pdf` (corporate registry), `주주_명단_최종.xlsx` (shareholder registry). The last one is `IMG_4821.jpg`, where **the correct answer is "I don't know."** A model that confidently labels that one is actively dangerous here.

Results (2026-08-12, costed from real token usage):

| Model | Score | Time | Cost/run | Runs per $1 |
|---|---|---|---|---|
| **google/gemini-2.5-flash-lite** | 6/6 | 2.9s | **$0.000233** | **4,301** |
| google/gemini-3.1-flash-lite | 6/6 | 2.1s | $0.000683 | 1,464 |
| openai/gpt-5-mini | 6/6 | 9.9s | $0.002321 | 431 |
| anthropic/claude-haiku-4.5 | 6/6 | 6.7s | $0.003187 | 314 |

**All four scored 6/6.** At this difficulty the models don't separate on quality — so **when quality ties, price decides**. gemini-2.5-flash-lite is **13× cheaper** than claude-haiku-4.5 for identical answers.

Honest limitations:

- Six cases is a small eval and doesn't strongly separate the models.
- gemini-2.5-flash-lite returned confidence `1.0` on every correct answer — its confidence scale is coarse. It did give `0.1` to the unanswerable one, which is the distinction that actually matters.
- If finer calibration is ever needed, gemini-3.1-flash-lite was better at it — 3× the price, still under a tenth of a cent per run.

**Switching models is one environment variable, no code change:** `GEMINI_MODEL=...`. Re-run the benchmark before changing it.

> Note: the brief says "Claude API integration." OpenRouter includes Claude, so `GEMINI_MODEL=anthropic/claude-haiku-4.5` makes this a Claude integration as-is. It's the same answer at 13× the cost, which is why Gemini is the default.

### After the benchmark: removing the middleman

Once `gemini-2.5-flash-lite` was confirmed as the best fit, **OpenRouter was replaced with a direct Google Gemini API call.** OpenRouter is a useful exploration tool — one key, 400 models — but in production it adds a markup on every call, introduces an extra network hop, and depends on a third-party staying in business. Calling the model directly costs less and has one fewer moving part.

The change was entirely internal to `lib/openrouter.ts` (the file kept its name so call sites needed no edits). The environment variable switched from `OPENROUTER_API_KEY` to `GOOGLE_AI_API_KEY`; the auth method switched from a `Bearer` header to a `?key=` query parameter; and the request/response shape was translated from OpenRouter's format to Gemini's. All four AI callers in the codebase needed zero changes.

---

## 6. Design decisions worth keeping

**The company-facing and internal screens are separated.** The DD checklist lives at `/diligence/<company>`, not one segment below the link you hand the company. A page adjacent to a link you gave out is a page you half gave out. It's also marked noindex.

**(Updated in week 2 — it is access control now.)** The paragraph above was true when there was no login. The **whole site sits behind sign-in** today; knowing the URL gets you a redirect to the login page.

**Login is enforced at the front door, not on each screen.** Checking "are they signed in?" inside every page means the first screen you forget is the screen that leaks. So it's enforced in the one file every request passes through (`proxy.ts`), with the handful of URLs that must stay open listed by name as exceptions. When the default is "blocked", forgetting can't open a hole.

**The AI is never handed the whole document set.** Each DD item gets **only the documents that item actually depends on** (`relatedDocumentIds`), and there's a ceiling (16 MB) on how much any one analysis can send — so a company with a lot of paperwork doesn't quietly produce a large bill.

**The same document isn't read thirteen times.** The articles of incorporation feed five checks and the registry feeds four; a document read once is reused for 60 seconds.

**One comment is one file.** Storing them all in a single file means that when two people comment at the same time, **whoever saves second erases the first person's words.** This is a feature for a team, so it was built that way from the start.

**A contract draft belongs to the company, not to the person typing it.** A draft only I can see is useless to the colleague who has to review it.

**Companies can only write to, and delete from, their own folder.** On delete, the storage path is rebuilt server-side from the deal id and any filename containing `/` is refused. Without that, a filename like `../../diligence/zest.json` would let someone **delete the due-diligence notes** through the upload page.

**"Has this document arrived?" is answered in exactly one place.** `lib/deal-status.ts` is shared by both screens, so they cannot disagree.

**The AI suggests; it never ticks.** Even at 90% confidence from a filename, that isn't grounds for marking a legal document as received. A person decides.

**The AI cannot invent a document.** A JSON schema forces the *shape* of the answer but guarantees nothing about its truthfulness, so every returned document id is checked against the real checklist and dropped if it isn't there. Anything under 60% confidence is hidden too.

**The AI only sees what keywords missed.** Keyword matching runs first and always wins; the AI handles the leftovers.

**Each DD check shows the documents it depends on**, green when uploaded — so you can see at a glance which checks you're not yet in a position to do.

**Every 💡 Tip from the mentor's document is preserved.** The professor-consulting-fee issue, no overdraft accounts, borrowings can't be repaid from investment funds.

**The blob store is private.** Real company documents go here; knowing the URL isn't enough to open them.

---

## 7. Security notes

- `service-account.json` and `.env.local` are in `.gitignore`. **Never commit them.**
- **Never paste an API key into a chat window.** Put it in the file yourself, or into the Vercel dashboard.
- The Vercel Blob store was created with `--access private`.
- Drive access requests only the `drive.readonly` scope, so the app cannot delete or modify files by mistake.
- The delete endpoint blocks path traversal (`../`).
- Real company documents are sensitive; only anonymized samples are used.
- Neither the Drive folder ID nor any API key appears in this document.
- **The whole site is behind sign-in.** Pages redirect to the login screen (302); APIs are refused (401).
- **Only accounts Google has verified the email for** get through. Checking the domain alone would let through an account that simply typed an unverified address into its profile.
- Passwords are **neither received nor stored.** Google does the identity check; we get the result. Keeping staff passwords out of our hands was the point.
- Filled contracts (`*-filled-agreement.docx`) are in `.gitignore` too. **A test contract must not get committed.**

### A real key exposure (2026-08-11)

**What happened:** running `vercel blob create-store` to set up the Blob store **silently also ran `vercel env pull`** — the command that downloads every environment variable stored on Vercel into your local `.env.local`. The Google service account's **private key came down with it and was printed to the terminal**, ending up in the working log.

**How far it spread (verified):**

| Location | Status |
|---|---|
| Local conversation log (`.jsonl`) | 1 occurrence |
| Git history | **None** — every commit checked |
| GitHub or anywhere external | **None** — this repo has no remote and has never been pushed |

**Risk: low**, for three reasons —

1. It never left the laptop.
2. The key only carries the `drive.readonly` scope, so it can read files but cannot delete or modify them.
3. The Drive integration is currently switched off (`readsSampleDriveFolder: false`), so no code uses this key at all.

**Action: delete, don't rotate.** There's no reason to issue a replacement for a key nothing uses. Google Cloud Console → IAM & Admin → Service Accounts → Keys → delete. **A key that doesn't exist can't leak.** If Drive support is ever switched back on, generate a fresh one then.

**→ Deleted 2026-08-13.** The value still sitting in the log file now opens nothing.

**The lesson — and we avoided it the second time.** When the OpenRouter key arrived a few days later, the handling changed: the key was never typed into the chat at all. It went **straight into Notepad and the Vercel dashboard by hand**, and when the variable *name* needed checking, each line was split at the `=` and **only the left-hand side** printed. Verified result: **zero** occurrences of the OpenRouter key in the log.

> **Rule: name the file the key goes in. Never ask for the value, and never print it.**

---

## 8. What has actually been tested

- Dragging a file into the browser → upload → the checklist ticking, end to end
- Deleting a file → the checklist un-ticking
- Sending `../diligence/zest.json` to the delete endpoint → **400, refused**
- AI guess: `제스트_등기_최신본_v3.pdf` → 등기부등본, 90% (local)
- AI guess: `주주_명단_최종.xlsx` → 주주명부, 95% (production)
- Saving a DD check and memo, reloading, and finding it still there
- Editing only the memo and confirming the checkbox doesn't come undone
- Requests for a non-existent check item or company being refused
- Korean text saving and reading back correctly

**Added in week 2:**

- Every URL requested while signed out → pages 302 to login, APIs 401. **All confirmed**
- Including the new contract screen and endpoints (`/agreement/zest` → 302, both contract APIs → 401)
- ZIP unpacking, against a ZIP actually made on Korean Windows — **Korean filenames intact**
- AI document analysis, against real scanned Korean PDFs — reads them and reaches a judgement
- A file with no extension (`...pdf의 사본`) being recognised as a PDF from its contents
- Filling the contract: filled from the real template and **opened in Word**, company name / share count / Korean amount-in-words all landed, `&` escaped, the 12% penalty present, **no yellow editing marks left**
- The 85 template slots against the 57 input fields — **nothing missing, nothing claimed twice**
- All re-checked on the deployed site after deploying

**Confirmed by a person in a browser (2026-08-13):**

- Adding a company, archiving it, permanently deleting it
- Creating a batch and assigning companies to it
- Writing and deleting comments — someone else's comment **refused to delete**, as intended
- Filling a contract, saving it, signing in as another account, and finding it there unchanged
- Downloading the contract as .docx and .pdf
- Stage filter in sidebar — toggling each stage, deselecting, live counts
- AI autofill suggestions on the agreement screen — per-field Apply chip, Apply all button

---

## 9. How the login works

The mentor's requirement: **only SparkLabs employees get in.** My question was "do we have to handle their passwords?", and the answer is **no.**

**The approach: Google sign-in plus a domain check.** An employee clicks "sign in with Google" and picks the company account they're already signed into. Google tells us "this person is `someone@sparklabs.co.kr`", and **we check that the part after the @ is `sparklabs.co.kr`**. No password ever passes through us.

**Two traps found while building it —**

1. **The `hd` option is not a security control.** Google takes a parameter saying "this domain only", but it only **hints to the account chooser**. The actual enforcement has to happen on our server.
2. **You have to check whether the email is verified.** Domain alone would let through an account that typed an unverified address into its own profile. So only accounts Google marks as verified are allowed.

**There's an exceptions list (`ALLOWED_EMAILS`).** As an intern I have no company account, so my personal one is on the list. When exceptions exist, the `hd` hint above has to be dropped — with it on, Google won't even offer the personal account.

---

## 10. How the contract gets filled

**The problem:** a Word file that reads as one sentence is stored **broken into fragments** internally. A single slot like `[이억이천사백사만육천칠백육십]` can be six separate pieces. Reassembling those on every request would be slow and would risk **corrupting a legal document.**

**The fix: do the hard part once, in advance.** `scripts/prepare-template.py` was run **exactly once** to find the yellow-highlighted slots, join their fragments, and replace each with a single marker like `{{f1}}`. After that, filling the contract is **string replacement** — simple and safe. The yellow highlighting was stripped at the same time; a finished contract shouldn't arrive covered in editing marks.

**Values the mentor standardised:** liquidated damages **12%**, employment restriction **5 years**. They're pre-filled, and if someone changes one the field gets an **amber border** saying "this departs from the standard". Contracts are normally in **3 copies** (SparkLabs / company / representative), more when there are additional interested parties.

**Three problems that came up —**

1. **The years were frozen.** The template had `2026년` as plain text, not highlighted, so the first pass walked straight past it — which would mean you couldn't write next year's contract on this site. The financial statements section had `202X년`, left blank. → The years are fields now. But **the new markers were appended at the end** (from 78 onwards): inserting them in the middle would shift every later number by one and break all 77 existing mappings at once.
2. **A single `&` makes Word refuse the file.** A company name containing `&` gets "the file is corrupt", because Word is XML underneath and `&` is special there. → `& < > " '` are escaped as values go in.
3. **The 회사 party block in the template holds SparkLabs fund details.** The company being invested in appears in the signature block. **Confirmed by the mentor (2026-08-13): this is correct.** The 회사 block intentionally holds the SparkLabs fund information, not the investee company. The fields are editable on the agreement screen.

**Empty slots stay visible as `{{f27}}` rather than going blank.** A blank reads as a term deliberately left empty; a visible marker makes it obvious nothing was filled. The screen also reports how many are still outstanding.

**The .pdf comes from the browser's print function.** The `.docx` *is* the original template, so its formatting is exactly right. The PDF prints the preview, so **the layout can differ slightly.** Use the `.docx` for anything that gets stamped and submitted; the PDF is for sharing and review. If a byte-exact PDF is needed, a conversion service can be wired in.

---

## 11. What's next

**All three Week 1 tasks complete:**

- [x] Document tracker mini-project
- [x] One CRUD — upload (C) / list (R) / edit DD memos (U) / delete files (D)
- [x] One API integration — via OpenRouter, guessing documents from filenames

**Week 2 complete:**

- [x] Deal CRUD — add / archive / permanently delete companies from the screen
- [x] Creating batches and assigning companies to them
- [x] Home screen progress view plus sidebar
- [x] Per-item comments, shared across the team
- [x] Login — the whole site, SparkLabs accounts only
- [x] AI cross-check — reads **inside** the documents and judges each item
- [x] Unpacking documents that arrive as a ZIP
- [x] Contract drafting plus .docx / .pdf download
- [x] Service account key deleted (§7)

**After week 2:**

- [x] Stage filter in the sidebar — filter companies by collecting docs / due diligence / agreement ready, with live counts for each stage
- [x] AI autofill suggestions on the agreement screen — reads uploaded documents, proposes values as grey placeholder text, per-field Apply chip and Apply all button
- [x] Save vs Save as PDF button visual distinction (green filled vs. bordered)
- [x] OpenRouter → Google Gemini direct API (same model `gemini-2.5-flash-lite`, one fewer middleman)
- [x] All features browser-tested by a person (§8)
- [x] 회사 block confirmed by mentor (§10-3)
- [x] Pushed to GitHub

**Remaining:**

- [ ] Obtain the internal 예비실사 체크리스트 standard form and fold it in
- [ ] Wire in a conversion service if a byte-identical PDF is required (§10)
- [ ] Delete the old `OPENROUTER_API_KEY` from the Vercel dashboard (replaced by `GOOGLE_AI_API_KEY`)

---

## 12. For the next intern

1. **Paste error messages exactly as they appear.** Don't summarise them. The answer is buried in the ugly red text.
2. **Pass on mentor feedback verbatim too.** Summarising loses the part you didn't realise mattered.
3. **Look at the real data first.** Building from the documentation alone produces bugs like ① above.
4. **But not every pattern in the data means something.** I saw gaps in a file numbering scheme, invented an explanation, and wrote it into a work log as a finding. He'd just removed a few sample files. Ask instead of guessing.
5. **Say something when the screen looks wrong.** "Why is that already ticked?" caught a real bug.
6. **When you have to choose, measure.** Instead of picking an AI model on instinct, we built a test and compared. The most expensive and the cheapest gave identical answers — a 13× price difference. The measurement took ten minutes.
7. **The AI is confidently wrong sometimes.** Ask "did you actually test that?" Nothing is finished until it has genuinely been run. That applies to the AI feature we built, too — which is exactly why its guesses are shown to a person for confirmation rather than acted on.
8. **"It doesn't work" doesn't mean "it failed".** When the ZIP upload didn't work, the upload was working perfectly — there was simply nothing to unpack it. **Find out how far it got** and you won't fix the wrong thing.
9. **When something looks identical but doesn't work, suspect a character you can't see.** It happened three times on this project. You only catch it by stopping the eyeball comparison and looking at what the computer actually sends.
10. **Security isn't what you think you blocked.** I believed comments could only be deleted by their author; in fact I was trusting the browser's claim about who it was. **Anything arriving from a browser can be a lie.**
11. **Don't be afraid to throw work away.** The first version was replaced wholesale, but everything learned building it went into the second one — and the old code is still in git if it's ever wanted.
