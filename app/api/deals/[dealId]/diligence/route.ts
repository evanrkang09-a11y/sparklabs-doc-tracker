/**
 * Reads and updates one deal's 실사 checklist state.
 *
 * GET returns the saved ticks and memos. PATCH applies a single edit - one
 * checkbox or one memo - keyed by which item it touches, so a save doesn't
 * have to carry the whole checklist just to change one field.
 *
 * That said, the store underneath still reads and rewrites the whole record
 * per edit (see lib/diligence-store.ts), so two edits landing in the same
 * instant can still race. Fine for one analyst per deal; not a guarantee
 * against concurrent editors.
 */

import { getDeal } from "@/lib/deals-store";
import { describe } from "@/lib/deal-status";
import { isKnownCheckId } from "@/lib/diligence";
import { readDiligence, saveDiligenceEdit } from "@/lib/diligence-store";

function dealNotFound(dealId: string): Response {
  return Response.json({ error: `Unknown deal: ${dealId}` }, { status: 404 });
}

async function respond(work: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await work());
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await context.params;
  if (!(await getDeal(dealId))) return dealNotFound(dealId);

  return respond(() => readDiligence(dealId));
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await context.params;
  if (!(await getDeal(dealId))) return dealNotFound(dealId);

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

  return respond(() => saveDiligenceEdit(dealId, { checkId, checked, note }));
}
