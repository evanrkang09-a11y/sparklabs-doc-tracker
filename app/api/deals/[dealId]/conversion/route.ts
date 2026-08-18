/**
 * Reads and updates one deal's SAFE-conversion state.
 *
 * GET returns the saved record. PUT saves the whole record - the form is edited
 * as one thing, same as the execution tracker.
 */

import { auth } from "@/auth";
import { getDeal } from "@/lib/deals-store";
import { describe } from "@/lib/errors";
import {
  readConversion,
  saveConversion,
  type ConversionRecord,
} from "@/lib/conversion-store";

function dealNotFound(dealId: string): Response {
  return Response.json({ error: `Unknown deal: ${dealId}` }, { status: 404 });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await context.params;
  if (!(await getDeal(dealId))) return dealNotFound(dealId);

  try {
    return Response.json(await readConversion(dealId));
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}

export async function PUT(
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

  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "Body must be an object" }, { status: 400 });
  }

  const session = await auth();
  const updatedBy = session?.user?.email ?? null;

  try {
    const saved = await saveConversion(
      dealId,
      body as Partial<ConversionRecord>,
      updatedBy,
    );
    return Response.json(saved);
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}
