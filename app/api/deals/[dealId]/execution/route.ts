/**
 * Reads and updates one deal's 투자 집행 (execution) state.
 *
 * GET returns the saved record. PUT saves the whole record - the form is
 * edited as one thing, so there is no interleaving to lose. Same last-write
 * caveat as the other stores.
 */

import { auth } from "@/auth";
import { getDeal } from "@/lib/deals-store";
import { describe } from "@/lib/errors";
import { readExecution, saveExecution, type ExecutionRecord } from "@/lib/execution-store";

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
    return Response.json(await readExecution(dealId));
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
  if (!session?.user || session.user.role === "startup") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const updatedBy = session.user.email ?? null;

  try {
    // The store sanitises, so an unexpected field is dropped rather than trusted.
    const saved = await saveExecution(
      dealId,
      body as Partial<ExecutionRecord>,
      updatedBy,
    );
    return Response.json(saved);
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}
