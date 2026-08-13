/**
 * Reading the actual documents and judging each due-diligence check against
 * them.
 *
 * Everything else in this app reads filenames. This reads what is inside: the
 * uploaded PDFs go to a model that reports what it found, whether the check
 * looks satisfied, what's missing, and what the analyst should do next. Scanned
 * Korean paperwork works - verified against a real 통장사본 scan, which the
 * model read correctly for about a hundredth of a cent.
 *
 * The model never ticks anything. It reports and recommends; a person decides.
 * A model being confident about a legal document is not the same as the
 * document being correct, and the checkbox is the record of a human judgement.
 *
 * Cost control comes from the checklist itself: each item already declares the
 * documents it depends on, so a check reads two or three documents rather than
 * everything the company sent.
 */

import type { Deal } from "./deals";
import type { DiligenceItem } from "./diligence";
import { readEnv, readEnvOr } from "./env";
import { readFileAsDataUrl } from "./storage";
import type { TrackedDocument } from "./deal-status";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Chosen by measurement, twice: cheapest of four models that all scored 6/6 on
 * filename classification, and the only cheap one that correctly read a scanned
 * Korean bank document. Override with OPENROUTER_MODEL.
 */
const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";

/** Below this there isn't enough on file for a company-specific opinion. */
export const MIN_DOCS_FOR_SUGGESTIONS = 4;

export type Verdict = "met" | "issues" | "unclear";

export type KeyFact = {
  labelKo: string;
  labelEn: string;
  value: string;
  /** Which document this came from, so a claim can be traced back. */
  source: string;
};

export type CheckAnalysis = {
  checkId: string;
  verdict: Verdict;
  confidence: number;
  summaryKo: string;
  summaryEn: string;
  keyFacts: KeyFact[];
  issuesKo: string[];
  issuesEn: string[];
  instructionsKo: string[];
  instructionsEn: string[];
  /** Filenames actually read, so the analyst knows what it saw. */
  documentsRead: string[];
  analyzedAt: string;
};

export type ExtraCheck = {
  titleKo: string;
  titleEn: string;
  whyKo: string;
  whyEn: string;
  documentsRead: string[];
};

function model(): string {
  return readEnvOr("OPENROUTER_MODEL", DEFAULT_MODEL);
}

export function isAiConfigured(): boolean {
  return readEnv("OPENROUTER_API_KEY").length > 0;
}

// ---------------------------------------------------------------------------

const CHECK_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["met", "issues", "unclear"] },
    confidence: { type: "number" },
    summaryKo: { type: "string" },
    summaryEn: { type: "string" },
    keyFacts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          labelKo: { type: "string" },
          labelEn: { type: "string" },
          value: { type: "string" },
          source: { type: "string" },
        },
        required: ["labelKo", "labelEn", "value", "source"],
        additionalProperties: false,
      },
    },
    issuesKo: { type: "array", items: { type: "string" } },
    issuesEn: { type: "array", items: { type: "string" } },
    instructionsKo: { type: "array", items: { type: "string" } },
    instructionsEn: { type: "array", items: { type: "string" } },
  },
  required: [
    "verdict",
    "confidence",
    "summaryKo",
    "summaryEn",
    "keyFacts",
    "issuesKo",
    "issuesEn",
    "instructionsKo",
    "instructionsEn",
  ],
  additionalProperties: false,
} as const;

const CHECK_SYSTEM = `You assist a Korean venture capital firm with pre-investment document due diligence.

You are given one item from their due-diligence checklist and the documents that item depends on. Read the documents and report.

Rules:
- Report what the documents actually say. Quote figures, dates, names and business categories exactly as printed. Never infer a value that isn't there.
- keyFacts is the point of this: pull out the specific information an analyst needs for THIS check. For a business-purpose check that means the business categories printed in each document; for a share-count check the actual numbers from each source; for an option pool the percentage and the cap. Always name which document each fact came from.
- verdict: "met" when the documents clearly satisfy the check. "issues" when you can see something wrong, contradictory, or missing. "unclear" when the documents don't let you decide - including when a document is unreadable or the wrong one was uploaded.
- Prefer "unclear" over guessing. A wrong "met" causes a real legal document to be signed off unchecked.
- issues: concrete problems, each one sentence. Empty when there are none.
- instructions: what the analyst should do next - what to request, whom to ask, what to compare. Empty when nothing is needed.
- Write Korean first and English second, saying the same thing. Korean is the working language.
- Be brief. Two sentences of summary, not a report.`;

export async function analyzeCheck(
  deal: Deal,
  item: DiligenceItem,
  documents: TrackedDocument[],
): Promise<CheckAnalysis> {
  const now = new Date().toISOString();

  // Which of this check's documents actually arrived.
  const related = documents.filter(
    (doc) => item.relatedDocumentIds.includes(doc.id) && doc.submitted,
  );

  const filenames = related.flatMap((doc) =>
    doc.files.filter((file) => file.source === "upload").map((file) => file.name),
  );

  // Nothing to read - answer without spending a request. The checklist already
  // knows which documents are missing, so this needs no model to work out.
  if (filenames.length === 0) {
    const missing = item.relatedDocumentIds
      .map((id) => documents.find((doc) => doc.id === id))
      .filter((doc) => doc !== undefined);

    return {
      checkId: item.id,
      verdict: "unclear",
      confidence: 0,
      summaryKo: "이 항목에 필요한 서류가 아직 업로드되지 않았습니다.",
      summaryEn: "The documents this check needs haven't been uploaded yet.",
      keyFacts: [],
      issuesKo: missing.map((doc) => `${doc.nameKo} 미제출`),
      issuesEn: missing.map((doc) => `${doc.nameEn} not submitted`),
      instructionsKo: ["해당 서류를 업로드한 뒤 다시 분석하세요."],
      instructionsEn: ["Upload the documents, then run the analysis again."],
      documentsRead: [],
      analyzedAt: now,
    };
  }

  const loaded = await Promise.all(
    filenames.slice(0, 6).map(async (name) => ({
      name,
      dataUrl: await readFileAsDataUrl(deal.id, name),
    })),
  );

  const usable = loaded.filter((file) => file.dataUrl !== null);

  if (usable.length === 0) {
    return {
      checkId: item.id,
      verdict: "unclear",
      confidence: 0,
      summaryKo: "서류를 읽을 수 없었습니다. 파일이 너무 크거나 형식이 지원되지 않습니다.",
      summaryEn: "The documents couldn't be read - too large, or an unsupported format.",
      keyFacts: [],
      issuesKo: [],
      issuesEn: [],
      instructionsKo: ["PDF 형식으로 다시 업로드해 주세요."],
      instructionsEn: ["Re-upload as PDF."],
      documentsRead: [],
      analyzedAt: now,
    };
  }

  const brief = [
    `체크리스트 항목: ${item.titleKo} (${item.titleEn})`,
    `출처: ${item.sourceRef}`,
    "",
    "확인해야 할 내용:",
    ...item.detailsKo.map((detail) => `- ${detail}`),
    ...(item.tipsKo?.length ? ["", "참고:", ...item.tipsKo.map((tip) => `- ${tip}`)] : []),
    "",
    `기업: ${deal.companyKo} (${deal.companyEn}) · ${deal.market === "overseas" ? "해외" : "국내"}`,
  ].join("\n");

  const content: unknown[] = [{ type: "text", text: brief }];
  for (const file of usable) {
    content.push({
      type: "file",
      file: { filename: file.name, file_data: file.dataUrl },
    });
  }

  const parsed = await callModel(CHECK_SYSTEM, content, CHECK_SCHEMA, 2500);

  return {
    checkId: item.id,
    verdict: asVerdict(parsed.verdict),
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    summaryKo: asText(parsed.summaryKo),
    summaryEn: asText(parsed.summaryEn),
    keyFacts: asKeyFacts(parsed.keyFacts),
    issuesKo: asTextList(parsed.issuesKo),
    issuesEn: asTextList(parsed.issuesEn),
    instructionsKo: asTextList(parsed.instructionsKo),
    instructionsEn: asTextList(parsed.instructionsEn),
    documentsRead: usable.map((file) => file.name),
    analyzedAt: now,
  };
}

// ---------------------------------------------------------------------------

const EXTRA_SCHEMA = {
  type: "object",
  properties: {
    checks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titleKo: { type: "string" },
          titleEn: { type: "string" },
          whyKo: { type: "string" },
          whyEn: { type: "string" },
        },
        required: ["titleKo", "titleEn", "whyKo", "whyEn"],
        additionalProperties: false,
      },
    },
  },
  required: ["checks"],
  additionalProperties: false,
} as const;

const EXTRA_SYSTEM = `You assist a Korean venture capital firm with pre-investment due diligence.

You are given their standard checklist and a company's actual documents. Suggest checks that are NOT on the standard list but that these particular documents make worth doing.

Rules:
- Specific to this company. "Verify the financials" is useless; "the shareholder registry lists a 12% holder who doesn't appear in the cap table - confirm who they are" is the kind of thing wanted.
- Ground every suggestion in something you actually saw in the documents, and say what you saw.
- Do not restate items already on the standard checklist.
- At most five. Fewer is better than padding.
- If the documents raise nothing beyond the standard list, return an empty array. That is a valid and useful answer.
- Korean first, English second.`;

export async function suggestExtraChecks(
  deal: Deal,
  documents: TrackedDocument[],
  standardTitles: string[],
): Promise<ExtraCheck[]> {
  const filenames = documents
    .filter((doc) => doc.submitted)
    .flatMap((doc) =>
      doc.files.filter((file) => file.source === "upload").map((file) => file.name),
    );

  if (filenames.length < MIN_DOCS_FOR_SUGGESTIONS) return [];

  // Cap the number sent: this is the one call that reads broadly rather than
  // per-check, so it's the one that could get expensive.
  const loaded = await Promise.all(
    filenames.slice(0, 12).map(async (name) => ({
      name,
      dataUrl: await readFileAsDataUrl(deal.id, name),
    })),
  );

  const usable = loaded.filter((file) => file.dataUrl !== null);
  if (usable.length === 0) return [];

  const brief = [
    `기업: ${deal.companyKo} (${deal.companyEn}) · ${deal.market === "overseas" ? "해외" : "국내"}`,
    "",
    "표준 체크리스트에 이미 있는 항목 (중복 금지):",
    ...standardTitles.map((title) => `- ${title}`),
  ].join("\n");

  const content: unknown[] = [{ type: "text", text: brief }];
  for (const file of usable) {
    content.push({
      type: "file",
      file: { filename: file.name, file_data: file.dataUrl },
    });
  }

  const parsed = await callModel(EXTRA_SYSTEM, content, EXTRA_SCHEMA, 2500);
  const raw = Array.isArray(parsed.checks) ? parsed.checks : [];

  return raw.slice(0, 5).map((check: Record<string, unknown>) => ({
    titleKo: asText(check.titleKo),
    titleEn: asText(check.titleEn),
    whyKo: asText(check.whyKo),
    whyEn: asText(check.whyEn),
    documentsRead: usable.map((file) => file.name),
  }));
}

// ---------------------------------------------------------------------------

async function callModel(
  system: string,
  content: unknown[],
  schema: unknown,
  maxTokens: number,
): Promise<Record<string, unknown>> {
  const key = readEnv("OPENROUTER_API_KEY");
  if (!key) throw new Error("OPENROUTER_API_KEY가 설정되지 않았습니다.");

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model(),
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
      // native = the model reads the PDF itself, billed as input tokens. The
      // mistral-ocr engine costs $2 per 1,000 pages, and native handled a real
      // Korean scan fine, so there's nothing to buy.
      plugins: [{ id: "file-parser", pdf: { engine: "native" } }],
      response_format: {
        type: "json_schema",
        json_schema: { name: "analysis", strict: true, schema },
      },
    }),
  });

  const body = await response.json();
  if (!response.ok || body?.error) {
    throw new Error(describeProviderError(body, response.status));
  }

  const text: string = body?.choices?.[0]?.message?.content ?? "";
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
    // raw isn't always JSON; the snippet is still better than nothing.
    return `${outer}: ${raw.slice(0, 200)}`;
  }

  return outer;
}

// The schema constrains shape, not meaning - rebuild what we recognise.
function asVerdict(value: unknown): Verdict {
  return value === "met" || value === "issues" ? value : "unclear";
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asTextList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asKeyFacts(value: unknown): KeyFact[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((fact): fact is Record<string, unknown> => typeof fact === "object" && fact !== null)
    .map((fact) => ({
      labelKo: asText(fact.labelKo),
      labelEn: asText(fact.labelEn),
      value: asText(fact.value),
      source: asText(fact.source),
    }))
    .filter((fact) => fact.value);
}
