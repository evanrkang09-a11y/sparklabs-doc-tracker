/**
 * The process assistant: answers questions grounded only in the SparkLabs
 * investment-operations process document.
 *
 * Reaching this route requires a signed-in SparkLabs account - proxy.ts turns
 * anonymous API requests away with a 401 first. AI costs money, so this is
 * on-demand only (a question per request).
 */

import { auth } from "@/auth";
import { describe } from "@/lib/errors";
import { isAiConfigured } from "@/lib/analysis";
import { MISSING_KEY_MESSAGE } from "@/lib/openrouter";
import { askGeminiText, type ChatTurn } from "@/lib/openrouter";
import { PROCESS_KNOWLEDGE } from "@/lib/process-knowledge";
import { getDeal } from "@/lib/deals-store";
import { collectDealStatus } from "@/lib/deal-status";
import { readDiligence } from "@/lib/diligence-store";
import { readExecution } from "@/lib/execution-store";
import { readConversion } from "@/lib/conversion-store";
import { allDiligenceItems } from "@/lib/diligence";
import { postPaymentDeadlines } from "@/lib/execution";

/**
 * A compact description of one deal's current state, so the assistant can
 * answer "what's left for this deal?" specifically. Best-effort - a part that
 * can't be read is simply omitted.
 */
async function dealContext(dealId: string): Promise<string | null> {
  const deal = await getDeal(dealId);
  if (!deal) return null;

  const [status, diligence, execution, conversion] = await Promise.all([
    collectDealStatus(deal).catch(() => null),
    readDiligence(dealId).catch(() => null),
    readExecution(dealId).catch(() => null),
    readConversion(dealId).catch(() => null),
  ]);

  const lines: string[] = [
    `Company: ${deal.companyKo} / ${deal.companyEn} (${deal.market})`,
  ];

  if (status) {
    lines.push(`Documents: ${status.missingCount} of ${status.totalRequired} required still missing.`);
  }
  if (diligence) {
    const total = allDiligenceItems().length;
    const done = Object.values(diligence.checks).filter((c) => c.checked).length;
    lines.push(`Due diligence: ${done}/${total} items checked.`);
  }
  if (execution) {
    lines.push(
      `Execution: fund type ${execution.fundType ?? "unset"}, structure ${execution.structure ?? "unset"}, payment date ${execution.paymentDate || "unset"}.`,
    );
    const dl = postPaymentDeadlines(execution.paymentDate);
    if (dl) lines.push(`Post-payment hard deadline: ${dl.hard.toISOString().slice(0, 10)}.`);
  }
  if (conversion && (conversion.leadPaymentDate || conversion.signingDate)) {
    lines.push(
      `SAFE conversion in progress: signing ${conversion.signingDate || "unset"}, follow-on payment ${conversion.leadPaymentDate || "unset"}.`,
    );
  }

  return lines.join("\n");
}

const SYSTEM = `You are the internal assistant for SparkLabs Korea's investment-operations team. You help with two kinds of questions:

1. PROCESS QUESTIONS — anything about SparkLabs' investment workflow (documents to collect, due diligence steps, agreement types, post-payment deadlines, SAFE conversion, etc.). For these, rely on the process documentation below and cite the relevant section (e.g. "#3 서류 실사"). Do not invent steps or deadlines that are not in it.

2. GENERAL QUESTIONS — anything else: research on a specific company or founder, startup market info, investment terminology, Korean business law concepts, financial modeling, competitor analysis, or any open question the team might ask while evaluating a deal. For these, answer from your general knowledge. Be helpful and informative rather than refusing.

Rules that apply to both:
- Answer in the same language as the user's question (Korean or English). Korean terms may stay in Korean even in English answers.
- Be concise and practical. Use bullet points for lists.
- If a question mixes process and general knowledge, answer both parts.
- This is internal guidance, not legal or financial advice.
- If you genuinely don't know something (e.g. a private company's specific financials), say so and suggest where they might find it.

=== SPARKLABS PROCESS DOCUMENTATION ===
${PROCESS_KNOWLEDGE}
=== END DOCUMENTATION ===`;

/** Keep a few recent turns for context without sending an unbounded history. */
const MAX_TURNS = 10;
const MAX_TEXT = 4000;

function cleanTurns(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  const turns: ChatTurn[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const { role, text } = item as Record<string, unknown>;
    if ((role === "user" || role === "model") && typeof text === "string" && text.trim()) {
      turns.push({ role, text: text.slice(0, MAX_TEXT) });
    }
  }
  return turns.slice(-MAX_TURNS);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Authentication required" }, { status: 401 });

  if (!isAiConfigured()) {
    return Response.json({ error: MISSING_KEY_MESSAGE }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const raw = (body ?? {}) as Record<string, unknown>;
  const messages = cleanTurns(raw.messages);

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return Response.json(
      { error: "Send at least one message ending with a user turn." },
      { status: 400 },
    );
  }

  // If the viewer is on a deal page, fold that deal's live state into the
  // system prompt so "what's left for this deal?" gets a specific answer.
  let system = SYSTEM;
  if (typeof raw.dealId === "string" && raw.dealId) {
    // Startup users can only ask about their own deal.
    if (session.user.role === "startup" && session.user.dealId !== raw.dealId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const context = await dealContext(raw.dealId).catch(() => null);
    if (context) {
      system += `\n\n=== CURRENT DEAL CONTEXT (the deal the user is viewing) ===\n${context}\n=== END DEAL CONTEXT ===`;
    }
  }

  try {
    const answer = await askGeminiText({ system, messages, maxTokens: 1024 });
    return Response.json({ answer });
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}
