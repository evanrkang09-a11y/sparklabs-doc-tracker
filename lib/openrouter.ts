/**
 * The one place this app talks to a model.
 *
 * There were briefly two copies of this - filename classification and document
 * analysis each grew their own - and they drifted in exactly the way that
 * predicts. OpenRouter reports "Provider returned error" for every failure with
 * the real reason buried in metadata.raw; the fix for that landed in one copy
 * and not the other, so half the app kept showing a message that says nothing.
 *
 * One client, one model choice, one error path.
 */

import { readEnv, readEnvOr } from "./env";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Chosen by measurement, twice: cheapest of four models that all scored 6/6 on
 * filename classification, and the only cheap one that correctly read a scanned
 * Korean bank document. Override with OPENROUTER_MODEL, but re-run
 * scripts/bench-models.mjs first.
 */
const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";

export const MISSING_KEY_MESSAGE = "OPENROUTER_API_KEY가 설정되지 않았습니다.";

export function isAiConfigured(): boolean {
  return readEnv("OPENROUTER_API_KEY").length > 0;
}

export function activeModel(): string {
  return readEnvOr("OPENROUTER_MODEL", DEFAULT_MODEL);
}

export type CallOptions = {
  system: string;
  /** A string for plain text, or content parts when sending documents. */
  content: string | unknown[];
  schema: unknown;
  schemaName: string;
  maxTokens: number;
  /**
   * `native` lets the model read PDFs itself, billed as input tokens. The
   * mistral-ocr engine costs $2 per 1,000 pages and native handled a real
   * Korean scan fine, so there's nothing to buy.
   */
  readsFiles?: boolean;
};

/** Sends one request and returns the parsed JSON object it asked for. */
export async function callOpenRouter(
  options: CallOptions,
): Promise<Record<string, unknown>> {
  const key = readEnv("OPENROUTER_API_KEY");
  if (!key) throw new Error(MISSING_KEY_MESSAGE);

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: activeModel(),
      max_tokens: options.maxTokens,
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.content },
      ],
      ...(options.readsFiles
        ? { plugins: [{ id: "file-parser", pdf: { engine: "native" } }] }
        : {}),
      response_format: {
        type: "json_schema",
        json_schema: { name: options.schemaName, strict: true, schema: options.schema },
      },
    }),
  });

  const body = await response.json();

  // OpenRouter can answer 200 with an error body, so the status alone isn't
  // enough to know the call succeeded.
  if (!response.ok || body?.error) {
    throw new Error(describeProviderError(body, response.status));
  }

  const text: string = body?.choices?.[0]?.message?.content ?? "";
  // Some models wrap JSON in fences regardless of the response format.
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  if (!cleaned) throw new Error("모델이 빈 응답을 반환했습니다.");

  const parsed: unknown = JSON.parse(cleaned);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("모델 응답 형식이 올바르지 않습니다.");
  }

  return parsed as Record<string, unknown>;
}

/**
 * Digs the real reason out of an OpenRouter failure.
 *
 * Its top-level message is "Provider returned error" no matter what went wrong,
 * with the useful part buried in metadata.raw. That cost an afternoon once -
 * the actual message was "Unsupported MIME type: application/octet-stream",
 * which says exactly what to fix, while the wrapper says nothing at all.
 */
function describeProviderError(body: unknown, status: number): string {
  const error = (body as { error?: Record<string, unknown> })?.error;
  const outer = typeof error?.message === "string" ? error.message : `HTTP ${status}`;

  const raw = (error?.metadata as { raw?: unknown })?.raw;
  if (typeof raw !== "string") return outer;

  try {
    const inner = JSON.parse(raw) as { error?: { message?: string } };
    if (inner?.error?.message) return `${outer}: ${inner.error.message}`;
  } catch {
    // raw isn't always JSON; the snippet still beats the wrapper.
    return `${outer}: ${raw.slice(0, 200)}`;
  }

  return outer;
}
