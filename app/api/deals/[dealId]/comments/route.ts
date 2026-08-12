/**
 * Comments on a deal's due-diligence checks.
 *
 * The author is taken from the signed-in session, never from the request body -
 * otherwise anyone could post a warning under a colleague's name.
 */

import { auth } from "@/auth";
import { describe } from "@/lib/errors";
import { getDeal } from "@/lib/deals-store";
import { isKnownCheckId } from "@/lib/diligence";
import { addComment, deleteComment, readComments } from "@/lib/comments-store";

export async function GET(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await context.params;
  if (!(await getDeal(dealId))) {
    return Response.json({ error: `Unknown deal: ${dealId}` }, { status: 404 });
  }

  try {
    return Response.json({ comments: await readComments(dealId) });
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await context.params;
  if (!(await getDeal(dealId))) {
    return Response.json({ error: `Unknown deal: ${dealId}` }, { status: 404 });
  }

  const session = await auth();
  const author = session?.user?.email;
  if (!author) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { checkId, body: text } = (body ?? {}) as Record<string, unknown>;

  if (typeof checkId !== "string" || !isKnownCheckId(checkId)) {
    return Response.json({ error: "Unknown checklist item" }, { status: 400 });
  }

  if (typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "Comment is empty" }, { status: 400 });
  }

  try {
    return Response.json(await addComment(dealId, checkId, author, text));
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
    return Response.json({ error: `Unknown deal: ${dealId}` }, { status: 404 });
  }

  const session = await auth();
  const viewer = session?.user?.email;
  if (!viewer) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { checkId, commentId } = (body ?? {}) as Record<string, unknown>;

  if (typeof checkId !== "string" || typeof commentId !== "string") {
    return Response.json({ error: "Missing comment reference" }, { status: 400 });
  }

  try {
    // The store compares the signed-in address against the author recorded on
    // the stored comment. Your own comments only: someone else's warning about
    // a deal isn't yours to remove, and quietly deleting it is the exact
    // failure this feature exists to prevent.
    await deleteComment(dealId, checkId, commentId, viewer);
    return Response.json({ deleted: commentId });
  } catch (problem) {
    const message = describe(problem);
    const status = message.startsWith("You can only") ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}
