/**
 * Saving the agreement being drafted for a company.
 *
 * Shared storage, so a colleague opening the same company sees the same draft -
 * see lib/agreement-store.ts.
 */

import { auth } from "@/auth";
import { describe } from "@/lib/errors";
import { getDeal } from "@/lib/deals-store";
import { readAgreement, saveAgreement } from "@/lib/agreement-store";

export async function GET(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await context.params;
  if (!(await getDeal(dealId))) {
    return Response.json({ error: `Unknown deal: ${dealId}` }, { status: 404 });
  }

  try {
    return Response.json(await readAgreement(dealId));
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await context.params;
  if (!(await getDeal(dealId))) {
    return Response.json({ error: `Unknown deal: ${dealId}` }, { status: 404 });
  }

  const session = await auth();
  const who = session?.user?.email;
  if (!who) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { values } = (body ?? {}) as Record<string, unknown>;
  if (typeof values !== "object" || values === null) {
    return Response.json({ error: "'values' must be an object" }, { status: 400 });
  }

  try {
    return Response.json(
      await saveAgreement(dealId, values as Record<string, string>, who),
    );
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}
