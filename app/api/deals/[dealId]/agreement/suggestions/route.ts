import { auth } from "@/auth";
import { describe } from "@/lib/errors";
import { getDeal } from "@/lib/deals-store";
import { listSuggestions, createSuggestion } from "@/lib/agreement-suggestions-store";

export async function GET(
  _request: Request,
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
    return Response.json(await listSuggestions(dealId));
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Authentication required" }, { status: 401 });

  const { dealId } = await context.params;

  if (session.user.role !== "startup") {
    return Response.json({ error: "Only startup accounts can submit suggestions" }, { status: 403 });
  }

  if (session.user.dealId !== dealId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!(await getDeal(dealId))) {
    return Response.json({ error: `Unknown deal: ${dealId}` }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { fieldId, proposedValue, blockKey, selectedText, proposedText, note } =
    (body ?? {}) as Record<string, unknown>;

  const isFieldSug = typeof fieldId === "string" && fieldId.trim();
  const isParaSug = typeof blockKey === "string" && blockKey.trim() && typeof proposedText === "string" && (proposedText as string).trim();

  if (!isFieldSug && !isParaSug) {
    return Response.json(
      { error: "Either 'fieldId'+'proposedValue' or 'blockKey'+'proposedText' is required" },
      { status: 400 },
    );
  }
  if (isFieldSug && typeof proposedValue !== "string") {
    return Response.json({ error: "'proposedValue' is required for field suggestions" }, { status: 400 });
  }

  try {
    const noteVal = typeof note === "string" && note.trim() ? note.trim().slice(0, 1000) : undefined;
    const suggestion = await createSuggestion(dealId, {
      ...(isFieldSug
        ? { fieldId: (fieldId as string).trim(), proposedValue: (proposedValue as string).trim() }
        : {
            blockKey: (blockKey as string).trim(),
            selectedText: typeof selectedText === "string" ? selectedText.slice(0, 1000) : "",
            proposedText: (proposedText as string).trim().slice(0, 2000),
          }),
      note: noteVal,
      authorEmail: session.user.email ?? "",
      authorName: session.user.name ?? session.user.email ?? "",
    });
    return Response.json(suggestion);
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}
