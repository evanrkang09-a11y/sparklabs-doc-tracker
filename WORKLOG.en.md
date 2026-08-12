# Work Log — Document Collection Tracker & Due Diligence Checklist

*English version of `WORKLOG.md`. Same content, for readability.*

Author: Evan Kang
Date: 2026-08-12
Live app: https://sparklabs-doc-tracker.vercel.app

> Written for whoever does this internship next. The prompts and the dead ends
> are recorded as they actually happened, not cleaned up afterwards.

---

## 1. What this is

Two screens.

**① Document collection tracker (company-facing)** — `/deal/<company>`
Shows the documents a company owes us before investment, and lets **the company upload its own files**. When a file arrives, its filename is matched against the checklist and the item ticks itself. Each company gets its own link — you send them the link and nothing else.

**② Due diligence checklist (internal)** — `/diligence/<company>`
The 13 checks that read the submitted documents against each other. Each has a checkbox and a memo field, and saves automatically.

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
| Hosting | Vercel |

### Where the code lives

| File | Job |
|---|---|
| `lib/documents.ts` | Required documents + filename matching. **Change the checklist here and nowhere else.** |
| `lib/diligence.ts` | The 13 due-diligence items |
| `lib/deals.ts` | The list of companies. Week 2 replaces this with real CRUD |
| `lib/deal-status.ts` | Works out which documents have arrived (shared by both screens) |
| `lib/storage.ts` | Lists uploaded files |
| `lib/diligence-store.ts` | Saves checkbox and memo state |
| `app/deal/[dealId]/` | The company-facing upload screen |
| `app/diligence/[dealId]/` | The internal DD screen |
| `app/api/upload/` | Issues upload tokens |

---

## 2. The rewrite

**The first version was pointed the wrong way.** It read the mentor's sample Google Drive folder and displayed the state of that one folder. It demoed fine and was useless in practice.

Three pieces of mentor feedback:

1. **Companies must be able to upload their own files.** Not us peering into a folder — a per-company link, and the company uploads.
2. **The document list was wrong.** Not 9 documents; 18 domestic and 10 overseas.
3. **The gaps at #6 and #9 in the file numbering meant nothing.** He'd removed a few files when assembling a sample batch, that's all.

Point 3 stung, because I had written **"need to confirm with the mentor what documents #6 and #9 are"** into the first work log as a finding. Not every pattern in the data means something. I should have asked before recording a guess as a fact.

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

When lost:

```
im kinda lost, what did you just do. explain it to me like im 5
```

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

### ⑥ PowerShell wouldn't run npx

```
npx : File ...\npx.ps1 cannot be loaded because running scripts is disabled
```

**Fix:** use `npx.cmd` instead of `npx`, or set this once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### ⑦ A TypeScript error caught before deploying

Running `npm run build` locally surfaced a type error before Vercel could fail on it.

**Lesson: always run `npm run build` locally before deploying.**

### ⑧ A test showed Korean as `???` — and the app was fine

Saving a Korean memo and reading it back returned `???`. It looked like an app bug. It was PowerShell mangling the request on the way out; sending explicit UTF-8 bytes proved the app stored and returned Korean correctly all along.

**Lesson: when a test fails, suspect the test first.** Check before changing the thing being tested.

---

## 5. Design decisions worth keeping

**The company-facing and internal screens are separated.** The DD checklist lives at `/diligence/<company>`, not one segment below the link you hand the company. A page adjacent to a link you gave out is a page you half gave out. It's also marked noindex.

**That said, this is tidiness, not access control.** Anyone with the URL can still open it. There's no login yet.

**Companies can only write to their own folder.** The upload token is only issued if the path belongs to a registered company. DD memos are stored under a completely different path (`diligence/`) that the upload endpoint will never issue a token for.

**"Has this document arrived?" is answered in exactly one place.** `lib/deal-status.ts` is shared by both screens, so they cannot disagree.

**Each DD check shows the documents it depends on.** Under "share count match" you see 등기부등본 and 주주명부 as tags, green when uploaded. You can see at a glance which checks you're not yet in a position to do.

**Every 💡 Tip from the mentor's document is preserved.** The professor-consulting-fee issue, no overdraft accounts, borrowings can't be repaid from investment funds — the things that are easy to forget and expensive to forget.

**The blob store is private.** Real company documents go here; knowing the URL isn't enough to open them.

---

## 6. Security notes

- `service-account.json` and `.env.local` are in `.gitignore`. **Never commit them.**
- The Vercel Blob store was created with `--access private`.
- Drive access requests only the `drive.readonly` scope, so the app cannot delete or modify files by mistake.
- Real company documents are sensitive; only anonymized samples are used.
- The Drive folder ID is deliberately not written in this document.
- The service account key was printed to the screen once during setup, so **it should be reissued.**

---

## 7. What has actually been tested

- Dragging a file into the browser → upload → the checklist ticking, end to end
- Saving a DD check and memo, reloading, and finding it still there
- Editing only the memo and confirming the checkbox doesn't come undone
- Requests for a non-existent check item or company being refused
- Korean text saving and reading back correctly

---

## 8. What's next

- [ ] Week 1: one CRUD exercise (scope to confirm with mentor)
- [ ] Week 1: one Claude API integration (needs an API key)
- [ ] Week 2: deal CRUD — add companies from the screen, not from code
- [ ] Week 2: obtain the internal 예비실사 체크리스트 standard form and fold it in
- [ ] Week 3: AI cross-check — read inside documents and flag mismatched numbers
- [ ] Week 3: automatic contract draft generation
- [ ] Login, to protect the internal screen
- [ ] Reissue the service account key

---

## 9. For the next intern

1. **Paste error messages exactly as they appear.** Don't summarise them. The answer is buried in the ugly red text.
2. **Pass on mentor feedback verbatim too.** Summarising loses the part you didn't realise mattered.
3. **Look at the real data first.** Building from the documentation alone produces bugs like ① above.
4. **But not every pattern in the data means something.** I saw gaps in a file numbering scheme, invented an explanation, and wrote it into a work log as a finding. He'd just removed a few sample files. Ask instead of guessing.
5. **Say something when the screen looks wrong.** "Why is that already ticked?" caught a real bug.
6. **The AI is confidently wrong sometimes.** Ask "did you actually test that?" Nothing is finished until it has genuinely been run.
7. **Don't be afraid to throw work away.** The first version was replaced wholesale, but everything learned building it went into the second one — and the old code is still in git if it's ever wanted.
