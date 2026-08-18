/**
 * The process assistant: answers questions grounded only in the SparkLabs
 * investment-operations process document.
 *
 * Reaching this route requires a signed-in SparkLabs account - proxy.ts turns
 * anonymous API requests away with a 401 first. AI costs money, so this is
 * on-demand only (a question per request).
 */

import { describe } from "@/lib/errors";
import { isAiConfigured } from "@/lib/analysis";
import { MISSING_KEY_MESSAGE } from "@/lib/openrouter";
import { askGeminiText, type ChatTurn } from "@/lib/openrouter";
import { PROCESS_KNOWLEDGE } from "@/lib/process-knowledge";

const SYSTEM = `You are the internal process assistant for SparkLabs Korea's investment-operations team.

Answer ONLY using the process documentation provided below. Do not invent steps, documents, dates, or contacts that are not in it.

Rules:
- Answer in the same language as the user's question (Korean or English). Korean terms may stay in Korean.
- Be concise and practical. Use short bullet points for lists of documents or steps.
- When useful, name the section your answer comes from (e.g. "#3 서류 실사", "#6 투자납입 후").
- If the answer is not covered by the documentation, say so plainly (do not guess) and suggest checking with the mentor.
- This is internal guidance, not legal advice.

=== PROCESS DOCUMENTATION ===
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
  if (!isAiConfigured()) {
    return Response.json({ error: MISSING_KEY_MESSAGE }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const messages = cleanTurns((body as Record<string, unknown>)?.messages);

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return Response.json(
      { error: "Send at least one message ending with a user turn." },
      { status: 400 },
    );
  }

  try {
    const answer = await askGeminiText({ system: SYSTEM, messages, maxTokens: 1024 });
    return Response.json({ answer });
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}
