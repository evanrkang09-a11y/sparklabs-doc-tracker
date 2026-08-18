/**
 * AI helpers for the Execution and Conversion stages.
 *
 *  - reviewStage: an advisory briefing (progress, what's missing, risks, next
 *    actions) grounded in the process knowledge and the deal's current state.
 *  - extractExecutionNumbers: reads a deal's uploaded documents and pulls the
 *    share count / price / amount as written on the 운용지시서 and 의사록.
 *  - extractConversionCalc: reads uploaded agreements and pulls the SAFE
 *    conversion inputs (valuation cap / discount / round price, etc.).
 *
 * All three go through the one model door in lib/openrouter.ts and are on-demand
 * (a button), never on page load, because each call costs money.
 */

import { callOpenRouter } from "./openrouter";
import { PROCESS_KNOWLEDGE } from "./process-knowledge";
import { listUploadedFiles, readFileAsDataUrl } from "./storage";

// --- reading a deal's uploaded documents -----------------------------------

const READABLE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "text/plain",
]);
const MAX_REQUEST_BYTES = 12 * 1024 * 1024;

type FilePart = { type: "file"; file: { filename: string; file_data: string } };

/** Loads up to a budget of a deal's uploaded files as content parts for the model. */
async function loadDealFiles(dealId: string): Promise<{ parts: FilePart[]; names: string[] }> {
  const listing = await listUploadedFiles(dealId);
  const parts: FilePart[] = [];
  const names: string[] = [];
  let budget = MAX_REQUEST_BYTES;

  for (const file of listing.slice(0, 10)) {
    const loaded = await readFileAsDataUrl(dealId, file.filename);
    if (!loaded || !READABLE_TYPES.has(loaded.contentType)) continue;
    if (loaded.dataUrl.length > budget) break;
    budget -= loaded.dataUrl.length;
    parts.push({ type: "file", file: { filename: file.filename, file_data: loaded.dataUrl } });
    names.push(file.filename);
  }

  return { parts, names };
}

// --- stage review ----------------------------------------------------------

export type StageReview = {
  summary: string;
  missing: string[];
  risks: string[];
  nextActions: string[];
};

const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    missing: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    nextActions: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "missing", "risks", "nextActions"],
} as const;

export async function reviewStage(opts: {
  stageTitle: string;
  stateText: string;
  lang: "ko" | "en";
}): Promise<StageReview> {
  const langName = opts.lang === "ko" ? "Korean" : "English";

  const system = `You review the current state of one deal at the "${opts.stageTitle}" stage for SparkLabs Korea's investment-operations team.

Use the process documentation and the deal's current state below. Respond in ${langName}.
- summary: one or two sentences on where this stage stands.
- missing: concrete items/documents/fields still outstanding (empty if none).
- risks: deadline or consistency risks worth flagging now (empty if none).
- nextActions: the next 2-4 concrete actions, most important first.
Be specific and practical. Do not invent steps not supported by the documentation. This is internal guidance, not legal advice.

=== PROCESS DOCUMENTATION ===
${PROCESS_KNOWLEDGE}
=== END DOCUMENTATION ===`;

  const parsed = await callOpenRouter({
    system,
    content: opts.stateText,
    schema: REVIEW_SCHEMA,
    schemaName: "stage-review",
    maxTokens: 900,
  });

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    missing: toStringArray(parsed.missing),
    risks: toStringArray(parsed.risks),
    nextActions: toStringArray(parsed.nextActions),
  };
}

// --- number extraction (execution consistency) -----------------------------

export type NumberTriple = { shares: string; price: string; amount: string };
export type ExtractedNumbers = { instruction: NumberTriple; minutes: NumberTriple };

const NUMBERS_SCHEMA = {
  type: "object",
  properties: {
    instruction: {
      type: "object",
      properties: {
        shares: { type: "string" },
        price: { type: "string" },
        amount: { type: "string" },
      },
      required: ["shares", "price", "amount"],
    },
    minutes: {
      type: "object",
      properties: {
        shares: { type: "string" },
        price: { type: "string" },
        amount: { type: "string" },
      },
      required: ["shares", "price", "amount"],
    },
  },
  required: ["instruction", "minutes"],
} as const;

export async function extractExecutionNumbers(dealId: string): Promise<ExtractedNumbers> {
  const { parts, names } = await loadDealFiles(dealId);
  if (parts.length === 0) return emptyNumbers();

  const brief = `From the attached documents, find these figures as they appear on the 운용지시서 (operating instruction) and on the 투자심의위원회 의사록 (investment committee minutes):
- shares: 본건 발행 신주(종류주식) 수 / number of new shares
- price: 1주당 발행가액 / issue price per share
- amount: 총 인수대금 / total subscription amount

Rules: digits only, no commas or currency symbols. Return an empty string for anything you cannot find in that specific document. Do not guess.

Attached files: ${names.join(", ")}`;

  const parsed = await callOpenRouter({
    system:
      "You extract figures from a Korean venture-investment deal's operating instruction and committee minutes. Only report what is actually written; never invent numbers.",
    content: [{ type: "text", text: brief }, ...parts],
    schema: NUMBERS_SCHEMA,
    schemaName: "execution-numbers",
    maxTokens: 400,
    readsFiles: true,
  });

  const i = (parsed.instruction ?? {}) as Record<string, unknown>;
  const m = (parsed.minutes ?? {}) as Record<string, unknown>;
  return {
    instruction: triple(i),
    minutes: triple(m),
  };
}

// --- SAFE conversion calculation inputs ------------------------------------

export type ExtractedCalc = {
  method: "discount" | "cap" | "";
  amount: string;
  roundPrice: string;
  discountPct: string;
  cap: string;
  preShares: string;
};

const CALC_SCHEMA = {
  type: "object",
  properties: {
    method: { type: "string" },
    amount: { type: "string" },
    roundPrice: { type: "string" },
    discountPct: { type: "string" },
    cap: { type: "string" },
    preShares: { type: "string" },
  },
  required: ["method", "amount", "roundPrice", "discountPct", "cap", "preShares"],
} as const;

export async function extractConversionCalc(dealId: string): Promise<ExtractedCalc> {
  const { parts, names } = await loadDealFiles(dealId);
  if (parts.length === 0) return emptyCalc();

  const brief = `From the attached documents (SparkLabs' SAFE / 조건부지분인수계약, the follow-on lead investor's agreement, cap table), extract the inputs to estimate how many shares the SAFE converts into:
- method: "cap" if the SAFE uses a valuation cap, "discount" if it uses a discount rate, otherwise ""
- amount: SparkLabs' SAFE investment amount (KRW, digits only)
- roundPrice: the follow-on round's price per share (digits only)
- discountPct: the discount rate as a number of percent (e.g. "20"), if any
- cap: the valuation cap (digits only), if any
- preShares: fully-diluted shares before the follow-on round (digits only), if stated

Rules: digits only, no commas or currency symbols. Empty string for anything not found. Do not guess.

Attached files: ${names.join(", ")}`;

  const parsed = await callOpenRouter({
    system:
      "You extract SAFE-conversion inputs from a Korean venture deal's SAFE agreement and the follow-on investor's agreement. Only report what is written; never invent numbers.",
    content: [{ type: "text", text: brief }, ...parts],
    schema: CALC_SCHEMA,
    schemaName: "conversion-calc",
    maxTokens: 400,
    readsFiles: true,
  });

  const method = parsed.method === "cap" || parsed.method === "discount" ? parsed.method : "";
  return {
    method,
    amount: str(parsed.amount),
    roundPrice: str(parsed.roundPrice),
    discountPct: str(parsed.discountPct),
    cap: str(parsed.cap),
    preShares: str(parsed.preShares),
  };
}

// --- helpers ---------------------------------------------------------------

function str(v: unknown): string {
  return typeof v === "string" ? v.slice(0, 40) : "";
}
function triple(o: Record<string, unknown>): NumberTriple {
  return { shares: str(o.shares), price: str(o.price), amount: str(o.amount) };
}
function emptyNumbers(): ExtractedNumbers {
  return { instruction: { shares: "", price: "", amount: "" }, minutes: { shares: "", price: "", amount: "" } };
}
function emptyCalc(): ExtractedCalc {
  return { method: "", amount: "", roundPrice: "", discountPct: "", cap: "", preShares: "" };
}
function toStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
