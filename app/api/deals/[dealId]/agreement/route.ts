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
import type { StartupEdit } from "@/lib/agreement-store";
import { isContractType } from "@/lib/contracts";

const STARTUP_WRITABLE_FIELDS = new Set([
  "companyName", "companyAddress", "companyRep",
  "interestedName", "interestedAddress", "interestedBirth",
  "noticeCompanyTo", "noticeCompanyAddress", "noticeCompanyPhone", "noticeCompanyEmail",
  "noticeInterestedTo", "noticeInterestedAddress", "noticeInterestedPhone", "noticeInterestedEmail",
]);

export async function GET(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Authentication required" }, { status: 401 });

  const { dealId } = await context.params;

  if (session.user.role === "startup" && session.user.dealId !== dealId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

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

  if (session.user.role === "startup" && session.user.dealId !== dealId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { values, contractType, overrides } = (body ?? {}) as Record<string, unknown>;
  if (typeof values !== "object" || values === null) {
    return Response.json({ error: "'values' must be an object" }, { status: 400 });
  }

  const type = isContractType(contractType) ? contractType : "cps";
  const cleanedOverrides =
    typeof overrides === "object" && overrides !== null
      ? (overrides as Record<string, string>)
      : {};

  // When a startup saves, restrict to the fields they are permitted to fill and
  // record which ones they changed. Use a separate variable so we don't try to
  // reassign the const-destructured `values`, which throws at runtime.
  let valuesToSave = values as Record<string, string>;
  let mergedStartupEdits: Record<string, StartupEdit> | undefined;
  if (session.user.role === "startup") {
    const existing = await readAgreement(dealId);
    const now = new Date().toISOString();
    const newEdits: Record<string, StartupEdit> = { ...(existing.startupEdits ?? {}) };
    const rawValues = values as Record<string, string>;
    const filteredValues: Record<string, string> = Object.fromEntries(
      Object.entries(rawValues).filter(([k]) => STARTUP_WRITABLE_FIELDS.has(k)),
    );
    for (const [key, val] of Object.entries(filteredValues)) {
      if (val !== existing.values[key]) {
        newEdits[key] = { editedBy: who, editedAt: now };
      }
    }
    mergedStartupEdits = Object.keys(newEdits).length > 0 ? newEdits : undefined;
    // Merge startup-writable fields on top of VC-set values — never wipe them.
    valuesToSave = { ...existing.values, ...filteredValues };
  }

  try {
    return Response.json(
      await saveAgreement(dealId, type, valuesToSave, who, cleanedOverrides, mergedStartupEdits),
    );
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}
