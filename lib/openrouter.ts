/**
 * The one place this app talks to a model.
 *
 * Previously routed through OpenRouter to Gemini Flash Lite. Now calls the
 * Google Gemini API directly — same model, no intermediary markup, same
 * Korean-document reading capability that proved itself on scanned 통장사본.
 *
 * One client, one model choice, one error path. Everything else in the codebase
 * imports from here and is unaffected by the provider switch.
 */

import { readEnv, readEnvOr } from "./env";

const MODEL = "gemini-2.5-flash-lite";
const ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export const MISSING_KEY_MESSAGE = "GOOGLE_AI_API_KEY가 설정되지 않았습니다.";

export function isAiConfigured(): boolean {
  return readEnv("GOOGLE_AI_API_KEY").length > 0;
}

export function activeModel(): string {
  return readEnvOr("GEMINI_MODEL", MODEL);
}

export type CallOptions = {
  system: string;
  /** A string for plain text, or content parts when sending documents. */
  content: string | unknown[];
  schema: unknown;
  /** Unused — kept so call sites don't need to change. */
  schemaName: string;
  maxTokens: number;
  /**
   * Unused — Gemini reads PDFs natively in all calls. Kept so call sites
   * don't need to change.
   */
  readsFiles?: boolean;
};

/** Sends one request and returns the parsed JSON object it asked for. */
export async function callOpenRouter(
  options: CallOptions,
): Promise<Record<string, unknown>> {
  const key = readEnv("GOOGLE_AI_API_KEY");
  if (!key) throw new Error(MISSING_KEY_MESSAGE);

  const model = activeModel();
  const url = `${ENDPOINT_BASE}/${model}:generateContent?key=${key}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: options.system }] },
      contents: [{ role: "user", parts: contentToParts(options.content) }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: options.schema,
        maxOutputTokens: options.maxTokens,
      },
    }),
  });

  const body = await response.json();

  if (!response.ok || body?.error) {
    const msg =
      typeof body?.error?.message === "string"
        ? body.error.message
        : `HTTP ${response.status}`;
    throw new Error(msg);
  }

  const text: string = body?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  // Some model configurations still wrap JSON in fences.
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  if (!cleaned) throw new Error("모델이 빈 응답을 반환했습니다.");

  const parsed: unknown = JSON.parse(cleaned);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("모델 응답 형식이 올바르지 않습니다.");
  }

  return parsed as Record<string, unknown>;
}

/**
 * Converts the content parts used by the old OpenRouter calls into the
 * Gemini API's parts format.
 *
 * Old format  — text:  { type: "text", text: "..." }
 *             — file:  { type: "file", file: { filename, file_data: "data:mime;base64,..." } }
 * Gemini      — text:  { text: "..." }
 *             — file:  { inlineData: { mimeType: "...", data: "<base64 only>" } }
 *
 * The data URL prefix ("data:application/pdf;base64,") is stripped — Gemini
 * wants the raw base64 and the mimeType separately.
 */
function contentToParts(content: string | unknown[]): unknown[] {
  if (typeof content === "string") return [{ text: content }];

  return content.map((part) => {
    if (typeof part !== "object" || part === null) return { text: String(part) };

    const p = part as Record<string, unknown>;

    if (p.type === "file" && typeof p.file === "object" && p.file !== null) {
      const file = p.file as Record<string, string>;
      const dataUrl = file.file_data ?? "";
      const comma = dataUrl.indexOf(",");
      const header = comma > 0 ? dataUrl.slice(0, comma) : "";
      const data = comma > 0 ? dataUrl.slice(comma + 1) : dataUrl;
      const mimeType = header.replace("data:", "").replace(";base64", "");
      return { inlineData: { mimeType, data } };
    }

    if (p.type === "text") return { text: p.text ?? "" };

    return { text: JSON.stringify(p) };
  });
}
