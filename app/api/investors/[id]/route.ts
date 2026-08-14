/**
 * Updating and deleting one investor profile.
 *
 * Reaching this route requires a signed-in SparkLabs account - proxy.ts turns
 * anonymous API requests away with a 401 first.
 */

import { describe } from "@/lib/errors";
import {
  deleteInvestorProfile,
  getInvestorProfile,
  updateInvestorProfile,
} from "@/lib/investors-store";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!(await getInvestorProfile(id))) {
    return Response.json({ error: `Unknown investor profile: ${id}` }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const input = (body ?? {}) as Record<string, unknown>;
  const changes: { label?: string; values?: Record<string, string> } = {};

  if (input.label !== undefined) {
    if (typeof input.label !== "string") {
      return Response.json({ error: "'label' must be a string" }, { status: 400 });
    }
    changes.label = input.label;
  }

  if (input.values !== undefined) {
    if (typeof input.values !== "object" || input.values === null) {
      return Response.json({ error: "'values' must be an object" }, { status: 400 });
    }
    changes.values = input.values as Record<string, string>;
  }

  try {
    return Response.json(await updateInvestorProfile(id, changes));
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    await deleteInvestorProfile(id);
    return Response.json({ ok: true });
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}
