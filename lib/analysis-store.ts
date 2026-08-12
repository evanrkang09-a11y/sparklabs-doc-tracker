/**
 * Where the AI's reading of a company's documents is kept.
 *
 * Cached deliberately. Analysis costs money and takes ten seconds or so per
 * check, so it runs when someone asks for it and the result stays until they
 * ask again. Opening the checklist should never quietly spend anything.
 *
 * Each entry records when it ran and which files it read, so a stale opinion
 * is visible as stale rather than passing for current.
 */

import { del, get, put } from "@vercel/blob";
import type { CheckAnalysis, ExtraCheck } from "./analysis";

export type AnalysisRecord = {
  dealId: string;
  /** Keyed by check id. Checks never analysed are simply absent. */
  checks: Record<string, CheckAnalysis>;
  extraChecks: ExtraCheck[];
  extraCheckedAt: string | null;
};

function pathFor(dealId: string): string {
  return `analysis/${dealId}.json`;
}

function empty(dealId: string): AnalysisRecord {
  return { dealId, checks: {}, extraChecks: [], extraCheckedAt: null };
}

export async function readAnalysis(dealId: string): Promise<AnalysisRecord> {
  const found = await get(pathFor(dealId), { access: "private", useCache: false });
  if (!found?.stream) return empty(dealId);

  try {
    const raw: unknown = JSON.parse(await new Response(found.stream).text());
    if (typeof raw !== "object" || raw === null) return empty(dealId);

    const { checks, extraChecks, extraCheckedAt } = raw as Partial<AnalysisRecord>;

    return {
      dealId,
      checks: typeof checks === "object" && checks !== null ? checks : {},
      extraChecks: Array.isArray(extraChecks) ? extraChecks : [],
      extraCheckedAt: typeof extraCheckedAt === "string" ? extraCheckedAt : null,
    };
  } catch {
    // A corrupt cache is not worth failing a page load over - it just means
    // the analysis hasn't run yet.
    return empty(dealId);
  }
}

async function write(record: AnalysisRecord): Promise<void> {
  await put(pathFor(record.dealId), JSON.stringify(record, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

/** Merges freshly analysed checks into whatever was already stored. */
export async function saveCheckAnalyses(
  dealId: string,
  analyses: CheckAnalysis[],
): Promise<AnalysisRecord> {
  const record = await readAnalysis(dealId);

  for (const analysis of analyses) {
    record.checks[analysis.checkId] = analysis;
  }

  await write(record);
  return record;
}

export async function saveExtraChecks(
  dealId: string,
  extraChecks: ExtraCheck[],
): Promise<AnalysisRecord> {
  const record = await readAnalysis(dealId);

  record.extraChecks = extraChecks;
  record.extraCheckedAt = new Date().toISOString();

  await write(record);
  return record;
}

export async function deleteAnalysis(dealId: string): Promise<void> {
  try {
    await del(pathFor(dealId));
  } catch {
    // Nothing analysed yet; not a failure worth aborting a deletion over.
  }
}
