"use client";

import { useEffect, useMemo, useState } from "react";
import type { Deal } from "@/lib/deals";
import type { ExecutionDoc, InvestmentStructure } from "@/lib/execution";
import { INVESTMENT_STRUCTURES } from "@/lib/execution";
import { useLang } from "@/app/lang-provider";

/**
 * The post-payment document-guide email to the company (#6-B), built from the
 * execution config above.
 *
 * Instead of copy-paste, the "Send email" button opens the analyst's mail
 * client with the recipient, subject and body pre-filled (a mailto: link), so
 * one click drafts the real message. Nothing is sent from a server — see the
 * note in the UI about fully automated sending.
 */
export default function EmailDrafts({
  deal,
  structure,
  postDocs,
  deadlines,
}: {
  deal: Deal;
  structure: InvestmentStructure | null;
  postDocs: ExecutionDoc[];
  deadlines: { target: Date; hard: Date } | null;
}) {
  const { lang, pick } = useLang();
  const ko = lang === "ko";

  const [to, setTo] = useState("");
  const [copied, setCopied] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestHint, setSuggestHint] = useState<string | null>(null);

  const company = pick(deal.companyKo, deal.companyEn);
  const dash = "—";
  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

  const structureLabel = structure
    ? pick(
        INVESTMENT_STRUCTURES.find((s) => s.value === structure)?.ko ?? "",
        INVESTMENT_STRUCTURES.find((s) => s.value === structure)?.en ?? "",
      )
    : dash;

  const generated = useMemo(() => {
    const list = postDocs.length
      ? postDocs
          .map((d) => {
            const note = pick(d.noteKo ?? "", d.noteEn ?? "");
            return `- ${pick(d.nameKo, d.nameEn)}${note ? ` (${note})` : ""}`;
          })
          .join("\n")
      : dash;

    const target = deadlines ? fmtDate(deadlines.target) : dash;
    const hard = deadlines ? fmtDate(deadlines.hard) : dash;

    const subject = ko
      ? `[${company}] 투자금 납입 후 제출 서류 안내`
      : `[${company}] Documents required after investment payment`;

    const body = ko
      ? `${company} 대표님, 안녕하세요.

투자금 납입이 완료되었습니다. 아래 서류를 준비하여 회신 부탁드립니다.

[제출 기한]
- 권장: ${target} 까지 (납입일 +20일)
- 최종: ${hard} 까지 (납입일 +30일)
※ 원본 서류가 수탁은행에 30일 이내 도착해야 하므로 가급적 20일 이내 회신 부탁드립니다.

[제출 서류] (${structureLabel})
${list}

※ 투자금은 등기 완료 이전에 사용하지 않도록 유의 부탁드립니다.
※ 통장 잔액증명서는 투자금이 납입된 상태로 발급해 주시기 바랍니다.

감사합니다.`
      : `Dear ${company} team,

The investment payment is complete. Please prepare and return the documents below.

[Deadline]
- Target: by ${target} (payment date + 20 days)
- Hard: by ${hard} (payment date + 30 days)
* Originals must reach the custodian bank within 30 days, so please return within 20 where possible.

[Required documents] (${structureLabel})
${list}

* Please do not spend the investment before the share registration is complete.
* Please issue the bank balance certificate with the investment already deposited.

Thank you.`;

    return { subject, body };
  }, [ko, company, structureLabel, postDocs, deadlines, pick]);

  // Editable body, re-synced whenever the generated draft changes.
  const [body, setBody] = useState(generated.body);
  useEffect(() => setBody(generated.body), [generated.body]);

  function sendEmail() {
    // Open Gmail compose in a new tab with recipient + subject pre-filled.
    // Body goes to clipboard — paste it once Gmail opens.
    navigator.clipboard.writeText(body).catch(() => {});
    const params = new URLSearchParams({
      view: "cm",
      fs: "1",
      to: to,
      su: generated.subject,
    });
    window.open(`https://mail.google.com/mail/?${params.toString()}`, "_blank");
    setCopied(true);
    setTimeout(() => setCopied(false), 4000);
  }

  async function suggestEmail() {
    setSuggesting(true);
    setSuggestHint(null);
    try {
      const res = await fetch(`/api/deals/${deal.id}/suggest-email`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (data?.email) {
        setTo(data.email);
        setSuggestHint(ko ? "✓ 이메일 자동입력 완료" : "✓ Email filled in");
      } else {
        setSuggestHint(ko ? "업로드된 서류에서 이메일을 찾지 못했습니다." : "No email found in uploaded documents.");
      }
    } catch {
      setSuggestHint(ko ? "오류가 발생했습니다." : "Something went wrong.");
    } finally {
      setSuggesting(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${generated.subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked - the text is selectable in the box regardless.
    }
  }

  return (
    <section className="mb-5 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-1 text-sm font-semibold">
        {ko ? "투자기업 안내 이메일 (납입 후)" : "Post-payment email to company"}
      </h2>
      <p className="mb-3 text-[11px] text-neutral-400">
        {ko
          ? "위 설정에서 자동으로 작성됩니다. 받는 사람을 입력하고 바로 보낼 수 있습니다."
          : "Generated from the settings above. Enter a recipient and send it directly."}
      </p>

      <div className="mb-2">
        <label className="block text-[11px] font-medium text-neutral-500">
          {ko ? "받는 사람 (이메일)" : "Recipient (email)"}
        </label>
        <div className="mt-1 flex gap-2">
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="founder@company.com"
            className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950"
          />
          <button
            type="button"
            onClick={suggestEmail}
            disabled={suggesting}
            className="shrink-0 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {suggesting ? (ko ? "검색 중…" : "Searching…") : (ko ? "AI 자동완성" : "AI Suggest")}
          </button>
        </div>
        {suggestHint && (
          <p className={`mt-1 text-[11px] ${suggestHint.startsWith("✓") ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-400"}`}>
            {suggestHint}
          </p>
        )}
      </div>

      <div className="mb-2">
        <label className="block text-[11px] font-medium text-neutral-500">
          {ko ? "제목" : "Subject"}
        </label>
        <input
          readOnly
          value={generated.subject}
          className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-sm text-neutral-600 focus:outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"
        />
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={15}
        className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-700 focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={sendEmail}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          {copied
            ? (ko ? "메일 열림 — 본문 붙여넣기 ✓" : "Mail opened — paste body ✓")
            : (ko ? "이메일 보내기" : "Send email")}
        </button>
        <button
          type="button"
          onClick={copy}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          {copied ? (ko ? "복사됨 ✓" : "Copied ✓") : ko ? "복사" : "Copy"}
        </button>
        <span className="text-[11px] text-neutral-400">
          {ko
            ? "💡 납입일 아침에 도착하도록 '예약발송'을 권장합니다."
            : "💡 Use scheduled send so it arrives on the payment-date morning."}
        </span>
      </div>
    </section>
  );
}
