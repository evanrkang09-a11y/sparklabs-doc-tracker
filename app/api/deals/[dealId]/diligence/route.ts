/**
 * Reads and updates one deal's 실사 checklist state.
 *
 * GET returns the saved ticks and memos. PATCH applies a single edit - one
 * checkbox or one memo - so that a slow save on one item can never clobber
 * what was typed into another.
 */

import { getDeal } from "@/lib/deals";
import { isKnownCheckId } from "@/lib/diligence";
import { readDiligence, saveDiligenceEdit } from "@/lib/diligence-store";

export async function GET(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await context.params;

  if (!getDeal(dealId)) {
    return Response.json({ error: `Unknown deal: ${dealId}` }, { status: 404 });
  }

  try {
    return Response.json(await readDiligence(dealId));
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await context.params;

  if (!getDeal(dealId)) {
    return Response.json({ error: `Unknown deal: ${dealId}` }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { checkId, checked, note } = (body ?? {}) as Record<string, unknown>;

  if (typeof checkId !== "string" || !isKnownCheckId(checkId)) {
    return Response.json({ error: "Unknown checklist item" }, { status: 400 });
  }

  if (checked !== undefined && typeof checked !== "boolean") {
    return Response.json({ error: "'checked' must be true or false" }, { status: 400 });
  }

  if (note !== undefined && typeof note !== "string") {
    return Response.json({ error: "'note' must be a string" }, { status: 400 });
  }

  try {
    const record = await saveDiligenceEdit(dealId, { checkId, checked, note });
    return Response.json(record);
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}

function describe(problem: unknown): string {
  return problem instanceof Error ? problem.message : "Unknown error";
}
