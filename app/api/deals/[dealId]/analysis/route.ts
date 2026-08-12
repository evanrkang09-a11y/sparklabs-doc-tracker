/**
 * Runs the AI over a company's documents and stores what it found.
 *
 * On demand only. Analysis costs money and takes time, so nothing here runs
 * because someone opened a page - it runs because someone pressed a button.
 *
 * The result never changes a checkbox. It is a recommendation with the evidence
 * attached; the tick stays a human decision.
 */

import { describe } from "@/lib/errors";
import { getDeal } from "@/lib/deals-store";
import { collectDealStatus } from "@/lib/deal-status";
import { allDiligenceItems } from "@/lib/diligence";
import {
  analyzeCheck,
  isAiConfigured,
  suggestExtraChecks,
  type CheckAnalysis,
} from "@/lib/analysis";
import { readAnalysis, saveCheckAnalyses, saveExtraChecks } from "@/lib/analysis-store";

/** Checks analysed at once. Each is its own model call, so this bounds a run. */
const BATCH_SIZE = 4;

export async function GET(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await context.params;
  if (!(await getDeal(dealId))) {
    return Response.json({ error: `Unknown deal: ${dealId}` }, { status: 404 });
  }

  try {
    return Response.json(await readAnalysis(dealId));
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await context.params;
  const deal = await getDeal(dealId);

  if (!deal) {
    return Response.json({ error: `Unknown deal: ${dealId}` }, { status: 404 });
  }

  if (!isAiConfigured()) {
    return Response.json(
      { error: "OPENROUTER_API_KEY가 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { checkIds, mode } = (body ?? {}) as Record<string, unknown>;

  try {
    const status = await collectDealStatus(deal);

    if (mode === "extra") {
      const items = allDiligenceItems();
      const extra = await suggestExtraChecks(
        deal,
        status.documents,
        items.map((item) => item.titleKo),
      );

      return Response.json(await saveExtraChecks(dealId, extra));
    }

    const items = allDiligenceItems();
    const wanted = Array.isArray(checkIds)
      ? items.filter((item) => checkIds.includes(item.id))
      : items;

    // Bounded per request so one call can't run for minutes; the client walks
    // through the checklist a few at a time and shows progress as it goes.
    const slice = wanted.slice(0, BATCH_SIZE);

    const analyses = await Promise.all(
      slice.map(async (item): Promise<CheckAnalysis> => {
        try {
          return await analyzeCheck(deal, item, status.documents);
        } catch (problem) {
          // One check failing shouldn't lose the other three in this batch.
          return {
            checkId: item.id,
            verdict: "unclear",
            confidence: 0,
            summaryKo: `분석 실패: ${describe(problem)}`,
            summaryEn: `Analysis failed: ${describe(problem)}`,
            keyFacts: [],
            issuesKo: [],
            issuesEn: [],
            instructionsKo: [],
            instructionsEn: [],
            documentsRead: [],
            analyzedAt: new Date().toISOString(),
          };
        }
      }),
    );

    const record = await saveCheckAnalyses(dealId, analyses);

    return Response.json({
      ...record,
      // What's left, so the client knows whether to ask again.
      remaining: wanted.slice(BATCH_SIZE).map((item) => item.id),
    });
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}
