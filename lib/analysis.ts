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
import { callOpenRouter, isAiConfigured } from "./openrouter";
import { readFileAsDataUrl, type ReadFile } from "./storage";
import type { TrackedDocument } from "./deal-status";

export { isAiConfigured };

/** Below this there isn't enough on file for a company-specific opinion. */
export const MIN_DOCS_FOR_SUGGESTIONS = 4;

/**
 * Total bytes of documents we'll put in one request.
 *
 * The per-file cap in lib/storage.ts doesn't bound a request: twelve files
 * under it still add up to something no provider will accept, and base64 adds
 * a third on top. Better to send the first few documents and say so than to
 * spend the download time and then fail.
 */
const MAX_REQUEST_BYTES = 16 * 1024 * 1024;

/**
 * What the model will actually read. Anything else is skipped rather than sent
 * with a hopeful type - sending an unsupported one is what made every analysis
 * fail with "Unsupported MIME type".
 */
const READABLE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "text/plain",
]);

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

/**
 * Builds a CheckAnalysis without writing all twelve fields out.
 *
 * Most of them are empty in the cases that matter - nothing uploaded,
 * unreadable, request failed - and spelling them out each time meant three
 * copies that had to be kept in step with the type.
 */
export function unclearAnalysis(
  checkId: string,
  over: Partial<CheckAnalysis> = {},
): CheckAnalysis {
  return {
    checkId,
    verdict: "unclear",
    confidence: 0,
    summaryKo: "",
    summaryEn: "",
    keyFacts: [],
    issuesKo: [],
    issuesEn: [],
    instructionsKo: [],
    instructionsEn: [],
    documentsRead: [],
    analyzedAt: new Date().toISOString(),
    ...over,
  };
}

type LoadedFile = { name: string; dataUrl: string };

/**
 * Short-lived cache of documents already fetched and encoded.
 *
 * The checklist deliberately overlaps - the articles of incorporation feed five
 * different checks, the corporate registry four - so a full run would otherwise
 * download and base64 the same PDF once per check: 36 fetches for 22 distinct
 * files, several of them fired simultaneously within one batch.
 *
 * A minute is comfortably longer than a run and short enough that a document
 * re-uploaded mid-session isn't read from a stale copy. Promises are cached
 * rather than results so concurrent checks share one fetch instead of racing.
 */
const CACHE_MS = 60_000;
const fileCache = new Map<string, { at: number; file: Promise<ReadFile | null> }>();

function cachedRead(dealId: string, filename: string): Promise<ReadFile | null> {
  const key = `${dealId}/${filename}`;
  const hit = fileCache.get(key);

  if (hit && Date.now() - hit.at < CACHE_MS) return hit.file;

  const file = readFileAsDataUrl(dealId, filename);
  fileCache.set(key, { at: Date.now(), file });

  // A rejected promise must not be cached, or one blip poisons the whole run.
  file.catch(() => fileCache.delete(key));

  // Cheap sweep so a long-lived instance doesn't hold every document it ever
  // read; there's no eviction otherwise.
  if (fileCache.size > 64) {
    for (const [k, v] of fileCache) {
      if (Date.now() - v.at >= CACHE_MS) fileCache.delete(k);
    }
  }

  return file;
}

/**
 * Reads documents for a request, stopping at the byte budget.
 *
 * Returns what fits rather than everything asked for - a request that's too
 * large fails after paying for every download, which is the worst of both.
 */
async function loadFiles(
  dealId: string,
  filenames: string[],
  limit: number,
): Promise<LoadedFile[]> {
  const loaded = await Promise.all(
    filenames.slice(0, limit).map(async (name) => ({
      name,
      file: await cachedRead(dealId, name),
    })),
  );

  const usable: LoadedFile[] = [];
  let budget = MAX_REQUEST_BYTES;

  for (const { name, file } of loaded) {
    if (!file || !READABLE_TYPES.has(file.contentType)) continue;
    if (file.dataUrl.length > budget) break;

    budget -= file.dataUrl.length;
    usable.push({ name, dataUrl: file.dataUrl });
  }

  return usable;
}

/** Turns loaded documents into the content parts the model expects. */
function contentWith(brief: string, files: LoadedFile[]): unknown[] {
  return [
    { type: "text", text: brief },
    ...files.map((file) => ({
      type: "file",
      file: { filename: file.name, file_data: file.dataUrl },
    })),
  ];
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

    return unclearAnalysis(item.id, {
      summaryKo: "이 항목에 필요한 서류가 아직 업로드되지 않았습니다.",
      summaryEn: "The documents this check needs haven't been uploaded yet.",
      issuesKo: missing.map((doc) => `${doc.nameKo} 미제출`),
      issuesEn: missing.map((doc) => `${doc.nameEn} not submitted`),
      instructionsKo: ["해당 서류를 업로드한 뒤 다시 분석하세요."],
      instructionsEn: ["Upload the documents, then run the analysis again."],
      analyzedAt: now,
    });
  }

  const usable = await loadFiles(deal.id, filenames, 6);

  if (usable.length === 0) {
    return unclearAnalysis(item.id, {
      summaryKo: "서류를 읽을 수 없었습니다. 파일이 너무 크거나 형식이 지원되지 않습니다.",
      summaryEn: "The documents couldn't be read - too large, or an unsupported format.",
      instructionsKo: ["PDF 형식으로 다시 업로드해 주세요."],
      instructionsEn: ["Re-upload as PDF."],
      analyzedAt: now,
    });
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

  const parsed = await callOpenRouter({
    system: CHECK_SYSTEM,
    content: contentWith(brief, usable),
    schema: CHECK_SCHEMA,
    schemaName: "analysis",
    maxTokens: 2500,
    readsFiles: true,
  });

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
      },
    },
  },
  required: ["checks"],
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

  // This is the one call that reads broadly rather than per-check, so it's the
  // one most likely to hit the request budget.
  const usable = await loadFiles(deal.id, filenames, 12);
  if (usable.length === 0) return [];

  const brief = [
    `기업: ${deal.companyKo} (${deal.companyEn}) · ${deal.market === "overseas" ? "해외" : "국내"}`,
    "",
    "표준 체크리스트에 이미 있는 항목 (중복 금지):",
    ...standardTitles.map((title) => `- ${title}`),
  ].join("\n");

  const parsed = await callOpenRouter({
    system: EXTRA_SYSTEM,
    content: contentWith(brief, usable),
    schema: EXTRA_SCHEMA,
    schemaName: "extra-checks",
    maxTokens: 2500,
    readsFiles: true,
  });

  const raw = Array.isArray(parsed.checks) ? parsed.checks : [];

  return raw.slice(0, 5).map((check: Record<string, unknown>) => ({
    titleKo: asText(check.titleKo),
    titleEn: asText(check.titleEn),
    whyKo: asText(check.whyKo),
    whyEn: asText(check.whyEn),
    documentsRead: usable.map((file) => file.name),
  }));
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
