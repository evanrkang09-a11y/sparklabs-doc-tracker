/**
 * Asking a model what an unrecognised filename actually is.
 *
 * The keyword matcher in lib/documents.ts only fires on names it has seen
 * before, so "제스트_등기_최신본_v3.pdf" lands in the unclassified pile even
 * though the document is obvious to a person. This is the fallback for that
 * pile - it never overrides a keyword match.
 *
 * Goes through OpenRouter, which fronts many providers behind one
 * OpenAI-shaped endpoint, so switching models is a string change rather than
 * a rewrite. No SDK: it is one HTTP call and fetch is built in.
 *
 * Model choice is measured, not assumed - scripts/bench-models.mjs runs the
 * candidates against filenames the keyword matcher genuinely misses. As of
 * 2026-08-11 four models all scored 6/6, so the tie broke on cost: this one
 * is ~13x cheaper than Claude Haiku 4.5 for the same answers, at roughly
 * $0.0002 per run. Re-run the benchmark before changing it.
 */

import { documentsFor, type Market } from "./documents";

export type Guess = {
  filename: string;
  /** A document id from the deal's checklist, or null for "no idea". */
  documentId: string | null;
  /** 0-1. The screen hides anything the model isn't reasonably sure about. */
  confidence: number;
  reason: string;
};

/** Below this we'd be guessing on the analyst's behalf, which is worse than nothing. */
export const MIN_CONFIDENCE = 0.6;

/** Long filenames are cheap, but a thousand of them is not. */
const MAX_FILES = 40;

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";

function readKey(): string {
  // .trim() because pasted keys arrive with stray whitespace or a BOM more
  // often than you'd think - that exact problem cost an afternoon already.
  return process.env.OPENROUTER_API_KEY?.trim() ?? "";
}

function readModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
}

export function isAiConfigured(): boolean {
  return readKey().length > 0;
}

const SYSTEM = `You identify Korean and English startup investment documents from their filenames alone.

You are given a checklist of documents a company owes an investor, and a list of uploaded filenames that a keyword matcher failed to classify. For each filename, decide which checklist document it most likely is.

Rules:
- Answer only with an id from the checklist, or null.
- null is the right answer when the filename is genuinely ambiguous. A wrong id is worse than null, because it marks a document as received when it is not.
- Filenames are often abbreviated, misspelled, in mixed Korean and English, or carry version suffixes like _final_v2 or (1). Read through that.
- A confidence below 0.6 will be discarded, so use the full range honestly rather than hedging everything into the middle.
- Keep each reason to one short sentence, in Korean.`;

const SCHEMA = {
  type: "object",
  properties: {
    guesses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          filename: { type: "string" },
          documentId: { type: ["string", "null"] },
          confidence: { type: "number" },
          reason: { type: "string" },
        },
        required: ["filename", "documentId", "confidence", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["guesses"],
  additionalProperties: false,
} as const;

export async function classifyFilenames(
  filenames: string[],
  market: Market,
): Promise<Guess[]> {
  const wanted = filenames.slice(0, MAX_FILES);
  if (wanted.length === 0) return [];

  const key = readKey();
  if (!key) throw new Error("OPENROUTER_API_KEY가 설정되지 않았습니다.");

  const documents = documentsFor(market);
  const checklist = documents
    .map((doc) => `- ${doc.id}: ${doc.nameKo} (${doc.nameEn})`)
    .join("\n");

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: readModel(),
      max_tokens: 2000,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `체크리스트:\n${checklist}\n\n분류할 파일명:\n${wanted
            .map((name) => `- ${name}`)
            .join("\n")}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "guesses", strict: true, schema: SCHEMA },
      },
    }),
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body?.error?.message ?? `OpenRouter 응답 ${response.status}`);
  }

  const text: string = body?.choices?.[0]?.message?.content ?? "";
  // Some models wrap JSON in ```json fences regardless of the response format.
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  if (!cleaned) return [];

  const parsed: unknown = JSON.parse(cleaned);
  return sanitize(
    parsed,
    wanted,
    documents.map((doc) => doc.id),
  );
}

/**
 * The schema constrains the shape, not the meaning - the model can still name
 * a document id that doesn't exist or a filename nobody asked about. Drop both
 * rather than let an invented id tick something off the checklist.
 */
function sanitize(raw: unknown, asked: string[], validIds: string[]): Guess[] {
  if (typeof raw !== "object" || raw === null) return [];

  const { guesses } = raw as { guesses?: unknown };
  if (!Array.isArray(guesses)) return [];

  const askedFor = new Set(asked);
  const known = new Set(validIds);
  const results: Guess[] = [];

  for (const guess of guesses) {
    if (typeof guess !== "object" || guess === null) continue;

    const { filename, documentId, confidence, reason } = guess as Record<string, unknown>;
    if (typeof filename !== "string" || !askedFor.has(filename)) continue;

    results.push({
      filename,
      documentId:
        typeof documentId === "string" && known.has(documentId) ? documentId : null,
      confidence: typeof confidence === "number" ? confidence : 0,
      reason: typeof reason === "string" ? reason : "",
    });
  }

  return results;
}
