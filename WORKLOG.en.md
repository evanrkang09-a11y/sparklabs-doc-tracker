# Work Log — Document Collection Tracker (mini-project)

*English version of `WORKLOG.md`. Same content, for readability.*

Author: Evan Kang
Date: 2026-08-11
Live app: https://sparklabs-doc-tracker.vercel.app

> Written for whoever does this internship next. The prompts and the dead ends
> are recorded as they actually happened, not cleaned up afterwards.

---

## 1. What this is

A web page that shows the documents a company owes us, watches a Google Drive folder, and reports which ones have arrived and which are still missing.

Current state: **1 of 9 required documents missing** (financial statements), measured against the mentor's real sample Drive folder.

### Stack

| | |
|---|---|
| Framework | Next.js 16.3 (App Router) + React 19.2 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Drive integration | `googleapis`, service account, read-only scope |
| Hosting | Vercel |

### Where the code lives

| File | Job |
|---|---|
| `lib/documents.ts` | The list of required documents + filename matching. **Change the checklist here and nowhere else.** |
| `lib/drive.ts` | Fetches the list of filenames from a Google Drive folder |
| `app/api/documents/route.ts` | Matches filenames to documents, counts what's missing |
| `app/page.tsx` | The screen. Re-checks every 5 seconds |
| `scripts/list-drive.mjs` | Dev tool — prints a Drive folder's contents with their IDs |
| `sample-drive/` | Dummy files used as a fallback when Drive isn't reachable |

---

## 2. How it was built

Built entirely by talking to Claude Code, an AI coding tool that runs in a terminal. I started this with no programming experience.

**The biggest lesson: there was no single magic prompt.** Short back-and-forth beat long, detailed requests every time. I'd ask for one thing, look at the result, then ask for the next.

### The prompts I actually used

Setup:

```
install python and git
install node right now
```

Understanding the assignment:

```
can you find the original korean file for me and just translate it
```

→ This read the Korean task spreadsheet and summarised it in English. There were
   English versions of the file too, but they were incomplete — reading the Korean
   original directly was more accurate.

Building:

```
lets deploy now
```

→ The app itself came out of a conversation amounting to "build me a screen that
   watches a Google Drive folder and shows which documents are missing." Reading
   the three requirements out of the brief was enough.

Debugging:

```
(paste the error message exactly as it appeared)
im kinda lost, what did you just do. explain it to me like im 5
so what exactly did we make just now
```

→ **Saying "I don't understand" was the fastest thing I did all day.** Asking for a
   re-explanation cost far less time than carrying on without understanding.

---

## 3. What went wrong, and how it got fixed

The brief says evaluation weighs process over polish, so every dead end is recorded here.

### ① The same document had two different names — the most important bug

The file in the Drive folder is called `등기사항전부증명서`. The glossary calls the same document `법인 등기부등본`. Two names, one document.

The first version of the matching logic only looked for `등기부등본`, so it **would have reported the document as missing while it was sitting right there in the folder.**

**Fix:** let each document carry several aliases.

```ts
keywords: ["등기사항전부증명서", "등기사항증명서", "등기부등본", "등기부", ...]
```

**Lesson:** if I'd built purely from the glossary without looking at the actual files first, the demo would have been wrong. Look at the real data before writing the code.

### ② The folder contained documents the glossary never mentions

`사업소개서` (business overview) and `통장사본` (bank account copy) were in the folder but absent from the glossary. Both were added to the checklist.

Also, the files are numbered 1, 2, 3, 4, 5, 7, 8, 10 — **6 and 9 are absent.** That looks like a deliberately incomplete submission, but I still need to confirm with my mentor what those two documents are. (My guess: #6 financial statements, #9 one of the venture/SME certificates.)

### ③ A TypeScript error caught before deploying

Running `npm run build` locally surfaced a type error. Deploying without that step would have meant a failed build on Vercel instead.

**Lesson: always run `npm run build` locally before deploying.**

### ④ Environment variables that silently didn't save

I entered the environment variables in the Vercel dashboard, but they never saved. Nothing on screen indicated a problem — the deployed app just kept showing sample data.

How to check:

```
npx vercel env ls
```

**Lesson:** environment variables only apply to deployments created **after** they're saved. Save them, then deploy again.

### ⑤ PowerShell wouldn't run npx

```
npx : File ...\npx.ps1 cannot be loaded because running scripts is disabled
```

**Fix:** use `npx.cmd` instead of `npx`, or set this once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### ⑥ Service account permissions

For the app to read Drive, you create a **service account** — a robot Google account belonging to the app — and share the Drive folder with *its* email address. Your own access to the folder is a separate thing and doesn't carry over to the app.

---

## 4. Design decisions worth keeping

**If Drive fails, the app doesn't.** When the Drive lookup fails, it automatically falls back to the local `sample-drive/` folder and shows a red banner explaining why. A credential problem mid-demo produces an explanation, not a white screen.

**The document list lives in exactly one file.** Only `lib/documents.ts` needs editing. When week 2 requires separate domestic and overseas checklists, that's where it extends.

**Drive access is read-only.** The app requests only the `drive.readonly` scope, so it cannot delete or modify the mentor's files even by mistake.

**Optional documents don't count as missing.** The venture certificate and cap table are marked 해당 시 제출 in the glossary, so they're excluded from the required count.

---

## 5. Security notes

- `service-account.json` and `.env.local` are in `.gitignore`. **Never commit them.**
- If the service account key leaks, delete it in the Google Cloud console and issue a new one.
- Real company documents are sensitive, so only anonymized samples were used.
- The Drive folder ID is deliberately not written in this document.

---

## 6. What's next

- [ ] Ask the mentor what documents #6 and #9 are, and complete the checklist
- [ ] Week 2: due diligence checklist UI (checkboxes + notes)
- [ ] Week 2: data model (deal / document item / submission state)
- [ ] Week 3: AI cross-check — read inside documents and flag mismatched numbers
- [ ] Week 3: automatic contract draft generation

---

## 7. For the next intern

1. **Paste error messages exactly as they appear.** Don't summarise them. The answer is buried in the ugly red text.
2. **Say when you don't understand.** "Explain that simply" works. Carrying on without understanding catches up with you at the presentation.
3. **Look at the real data first.** Building from the documentation alone produces bugs like ① above.
4. **Build small and run it immediately.** Confirming one screen works before moving on is faster than it sounds.
5. **The AI is confidently wrong sometimes.** Ask "did you actually test that?" Nothing is finished until it has genuinely been run.
