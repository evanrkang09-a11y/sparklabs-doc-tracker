/**
 * Changing or removing one company.
 *
 * PATCH covers archiving, un-archiving and moving a company between batches.
 * DELETE is permanent and takes the documents and notes with it.
 *
 * Reaching either requires a signed-in SparkLabs account - proxy.ts turns
 * anonymous API requests away with a 401 first.
 */

import { describe } from "@/lib/errors";
import { deleteDeal, getDeal, updateDeal } from "@/lib/deals-store";
import { deleteAllUploads } from "@/lib/storage";
import { deleteDiligence } from "@/lib/diligence-store";
import { deleteAllComments } from "@/lib/comments-store";
import { deleteAnalysis } from "@/lib/analysis-store";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await context.params;
  if (!(await getDeal(dealId))) {
    return Response.json({ error: `Unknown company: ${dealId}` }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { archived, batchId, dealType, market } = (body ?? {}) as Record<string, unknown>;
  const changes: Parameters<typeof updateDeal>[1] = {};

  if (archived !== undefined) {
    if (typeof archived !== "boolean") {
      return Response.json({ error: "'archived' must be true or false" }, { status: 400 });
    }
    changes.archived = archived;
  }

  // null is meaningful here - it moves a company out of every batch - so this
  // checks for undefined rather than falsiness.
  if (batchId !== undefined) {
    changes.batchId = typeof batchId === "string" && batchId ? batchId : null;
  }

  if (dealType !== undefined) {
    if (dealType !== "batch" && dealType !== "tips" && dealType !== "general") {
      return Response.json({ error: "Unknown deal type" }, { status: 400 });
    }
    changes.dealType = dealType;
  }

  if (market !== undefined) {
    changes.market = market === "overseas" ? "overseas" : "domestic";
  }

  try {
    return Response.json(await updateDeal(dealId, changes));
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await context.params;
  if (!(await getDeal(dealId))) {
    return Response.json({ error: `Unknown company: ${dealId}` }, { status: 404 });
  }

  try {
    // Documents and notes first, then the company itself. In that order a
    // failure part-way leaves the company still listed with some files gone,
    // which is visible and recoverable - the reverse would leave orphaned
    // confidential documents with nothing pointing at them.
    await Promise.all([
      deleteAllUploads(dealId),
      deleteDiligence(dealId),
      deleteAllComments(dealId),
      deleteAnalysis(dealId),
    ]);

    await deleteDeal(dealId);

    return Response.json({ deleted: dealId });
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}
