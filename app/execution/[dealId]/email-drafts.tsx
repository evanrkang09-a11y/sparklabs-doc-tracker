"use client";

import { useMemo, useState } from "react";
import type { Deal } from "@/lib/deals";
import type {
  ExecutionDoc,
  FundType,
  InvestmentStructure,
} from "@/lib/execution";
import { FUND_TYPES, INVESTMENT_STRUCTURES } from "@/lib/execution";
import type { NumberSet } from "@/lib/execution-store";
import { useLang } from "@/app/lang-provider";

/**
 * Ready-to-send email drafts, built from the execution config above.
 *
 * Two templates from the mentor's document:
 *  - #5-B: sharing the operating-instruction package with 경영지원본부
 *  - #6-B: the post-payment document guide sent to the company, with its
 *    deadline and the exact documents due back
 *
 * Everything is filled from data already on the page, so a draft is copy-paste
 * ready. Nothing is sent from here — the analyst copies it into their own mail.
 */
export default function EmailDrafts({
  deal,
  fundName,
  fundType,
  structure,
  instructionDate,
  paymentDate,
  agreementNumbers,
  oiDocs,
  postDocs,
  deadlines,
}: {
  deal: Deal;
  fundName: string;
  fundType: FundType | null;
  structure: InvestmentStructure | null;
  instructionDate: string;
  paymentDate: string;
  agreementNumbers: NumberSet;
  oiDocs: ExecutionDoc[];
  postDocs: ExecutionDoc[];
  deadlines: { target: Date; hard: Date } | null;
}) {
  const { lang, pick } = useLang();
  const ko = lang === "ko";

  const [which, setWhich] = useState<"instruction" | "post">("instruction");
  const [copied, setCopied] = useState(false);

  const company = pick(deal.companyKo, deal.companyEn);
  const dash = "—";
  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

  const fundTypeLabel = fundType
    ? pick(
        FUND_TYPES.find((f) => f.value === fundType)?.ko ?? "",
        FUND_TYPES.find((f) => f.value === fundType)?.en ?? "",
      )
    : dash;
  const structureLabel = structure
    ? pick(
        INVESTMENT_STRUCTURES.find((s) => s.value === structure)?.ko ?? "",
        INVESTMENT_STRUCTURES.find((s) => s.value === structure)?.en ?? "",
      )
    : dash;

  const listDocs = (docs: ExecutionDoc[]) =>
    docs.length
      ? docs
          .map((d) => {
            const note = pick(d.noteKo ?? "", d.noteEn ?? "");
            return `- ${pick(d.nameKo, d.nameEn)}${note ? ` (${note})` : ""}`;
          })
          .join("\n")
      : dash;

  const draft = useMemo(() => {
    if (which === "instruction") {
      return ko
        ? `제목: [운용지시] ${company} 투자금 납입 요청

경영지원본부님, 안녕하세요.

${company} 투자 건 운용지시 관련 서류를 공유드립니다.

- 펀드: ${fundName || dash} (${fundTypeLabel})
- 투자 구조: ${structureLabel}
- 운용지시일: ${instructionDate || dash}
- 납입일: ${paymentDate || dash}
- 신주 수: ${agreementNumbers.shares || dash}
- 발행가액: ${agreementNumbers.price || dash}
- 총 인수대금: ${agreementNumbers.amount || dash}

[첨부 서류]
${listDocs(oiDocs)}

※ 운용지시서 · 투자계약서 · 투자심의위원회 의사록의 숫자가 일치하는지 확인 부탁드립니다.
※ 운용지시일과 납입일은 최소 하루 이상 차이가 나야 합니다.

감사합니다.`
        : `Subject: [Operating Instruction] Payment request for ${company}

Dear Management Support team,

Please find the operating-instruction documents for the ${company} investment.

- Fund: ${fundName || dash} (${fundTypeLabel})
- Structure: ${structureLabel}
- Instruction date: ${instructionDate || dash}
- Payment date: ${paymentDate || dash}
- New shares: ${agreementNumbers.shares || dash}
- Issue price: ${agreementNumbers.price || dash}
- Total amount: ${agreementNumbers.amount || dash}

[Attached documents]
${listDocs(oiDocs)}

* Please confirm the figures on the operating instruction, the agreement, and the committee minutes all match.
* The instruction date and payment date must differ by at least one day.

Thank you.`;
    }

    const target = deadlines ? fmtDate(deadlines.target) : dash;
    const hard = deadlines ? fmtDate(deadlines.hard) : dash;

    return ko
      ? `제목: [${company}] 투자금 납입 후 제출 서류 안내

${company} 대표님, 안녕하세요.

투자금 납입이 완료되었습니다. 아래 서류를 준비하여 회신 부탁드립니다.

[제출 기한]
- 권장: ${target} 까지 (납입일 +20일)
- 최종: ${hard} 까지 (납입일 +30일)
※ 원본 서류가 수탁은행에 30일 이내 도착해야 하므로 가급적 20일 이내 회신 부탁드립니다.

[제출 서류] (${structureLabel})
${listDocs(postDocs)}

※ 투자금은 등기 완료 이전에 사용하지 않도록 유의 부탁드립니다.
※ 통장 잔액증명서는 투자금이 납입된 상태로 발급해 주시기 바랍니다.

감사합니다.`
      : `Subject: [${company}] Documents required after investment payment

Dear ${company} team,

The investment payment is complete. Please prepare and return the documents below.

[Deadline]
- Target: by ${target} (payment date + 20 days)
- Hard: by ${hard} (payment date + 30 days)
* Originals must reach the custodian bank within 30 days, so please return within 20 where possible.

[Required documents] (${structureLabel})
${listDocs(postDocs)}

* Please do not spend the investment before the share registration is complete.
* Please issue the bank balance certificate with the investment already deposited.

Thank you.`;
  }, [
    which,
    ko,
    company,
    fundName,
    fundTypeLabel,
    structureLabel,
    instructionDate,
    paymentDate,
    agreementNumbers,
    oiDocs,
    postDocs,
    deadlines,
  ]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (rare) - the text is selectable in the box regardless.
    }
  }

  const tab = (id: "instruction" | "post", label: string) => (
    <button
      type="button"
      onClick={() => setWhich(id)}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
        which === id
          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          : "border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
      }`}
    >
      {label}
    </button>
  );

  return (
    <section className="mb-5 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="mb-1 text-sm font-semibold">
        {ko ? "이메일 초안" : "Email drafts"}
      </h2>
      <p className="mb-3 text-[11px] text-neutral-400">
        {ko
          ? "위 설정에서 자동으로 작성됩니다. 복사하여 메일에 붙여넣으세요."
          : "Generated from the settings above. Copy and paste into your mail client."}
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        {tab("instruction", ko ? "경영지원본부 공유 (운용지시)" : "To Mgmt Support (instruction)")}
        {tab("post", ko ? "투자기업 안내 (납입 후)" : "To company (post-payment)")}
      </div>

      <textarea
        readOnly
        value={draft}
        rows={16}
        className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-700 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={copy}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          {copied ? (ko ? "복사됨 ✓" : "Copied ✓") : ko ? "복사" : "Copy"}
        </button>
        {which === "post" && (
          <span className="text-[11px] text-neutral-400">
            {ko
              ? "💡 납입일 아침에 도착하도록 '예약발송'을 권장합니다."
              : "💡 Use scheduled send so it arrives on the morning of the payment date."}
          </span>
        )}
      </div>
    </section>
  );
}
