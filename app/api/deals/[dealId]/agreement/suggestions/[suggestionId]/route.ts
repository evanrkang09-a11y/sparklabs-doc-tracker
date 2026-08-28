import { auth } from "@/auth";
import { describe } from "@/lib/errors";
import { getDeal } from "@/lib/deals-store";
import { listSuggestions, updateSuggestion, deleteSuggestion } from "@/lib/agreement-suggestions-store";
import { readAgreement, saveAgreement } from "@/lib/agreement-store";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ dealId: string; suggestionId: string }> },
) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const who = session.user.email ?? "";

  if (session.user.role === "startup") {
    return Response.json({ error: "Only SparkLabs employees can review suggestions" }, { status: 403 });
  }

  const { dealId, suggestionId } = await context.params;

  if (!(await getDeal(dealId))) {
    return Response.json({ error: `Unknown deal: ${dealId}` }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { action, overrideText } = (body ?? {}) as Record<string, unknown>;
  if (action !== "approve" && action !== "reject") {
    return Response.json({ error: "'action' must be 'approve' or 'reject'" }, { status: 400 });
  }

  try {
    const suggestions = await listSuggestions(dealId);
    const suggestion = suggestions.find((s) => s.id === suggestionId);
    if (!suggestion) return Response.json({ error: "Suggestion not found" }, { status: 404 });
    if (suggestion.status !== "pending") {
      return Response.json({ error: "Suggestion is not pending" }, { status: 409 });
    }

    if (action === "approve") {
      const record = await readAgreement(dealId);
      if (suggestion.blockKey && !suggestion.fieldId) {
        // Paragraph suggestion: apply the computed override text the client sends.
        const newOverrideText = typeof overrideText === "string" && overrideText.trim()
          ? overrideText.trim()
          : suggestion.proposedText ?? "";
        await saveAgreement(
          dealId,
          record.contractType,
          record.values,
          who,
          { ...(record.overrides ?? {}), [suggestion.blockKey]: newOverrideText },
          record.startupEdits,
        );
      } else if (suggestion.fieldId) {
        // Field suggestion: apply the field value.
        await saveAgreement(
          dealId,
          record.contractType,
          { ...record.values, [suggestion.fieldId]: suggestion.proposedValue ?? "" },
          who,
          record.overrides ?? {},
          record.startupEdits,
        );
      }
    }

    const updated = await updateSuggestion(dealId, suggestionId, {
      status: action === "approve" ? "approved" : "rejected",
      reviewedBy: who,
      reviewedAt: new Date().toISOString(),
    });

    return Response.json(updated);
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ dealId: string; suggestionId: string }> },
) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Authentication required" }, { status: 401 });

  const { dealId, suggestionId } = await context.params;

  if (session.user.role === "startup" && session.user.dealId !== dealId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!(await getDeal(dealId))) {
    return Response.json({ error: `Unknown deal: ${dealId}` }, { status: 404 });
  }

  try {
    const suggestions = await listSuggestions(dealId);
    const suggestion = suggestions.find((s) => s.id === suggestionId);
    if (!suggestion) return Response.json({ error: "Suggestion not found" }, { status: 404 });

    if (session.user.role === "startup" && suggestion.authorEmail !== session.user.email) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteSuggestion(dealId, suggestionId);
    return Response.json({ ok: true });
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}
