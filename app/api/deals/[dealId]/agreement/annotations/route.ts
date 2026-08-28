import { auth } from "@/auth";
import { describe } from "@/lib/errors";
import {
  readAnnotations,
  addAnnotation,
  deleteAnnotation,
} from "@/lib/agreement-annotations-store";

export async function GET(
  _req: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await context.params;
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Authentication required" }, { status: 401 });
  if (session.user.role === "startup" && session.user.dealId !== dealId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    return Response.json(await readAnnotations(dealId));
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await context.params;
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Authentication required" }, { status: 401 });
  if (session.user.role === "startup" && session.user.dealId !== dealId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { selectedText, blockKey, comment } = (body ?? {}) as Record<string, unknown>;
  if (typeof selectedText !== "string" || !selectedText.trim()) {
    return Response.json({ error: "selectedText required" }, { status: 400 });
  }
  if (typeof comment !== "string" || !comment.trim()) {
    return Response.json({ error: "comment required" }, { status: 400 });
  }
  if (comment.length > 2000) {
    return Response.json({ error: "Comment too long (max 2000 chars)" }, { status: 400 });
  }

  try {
    const annotation = await addAnnotation(dealId, {
      selectedText: selectedText.trim().slice(0, 500),
      blockKey: typeof blockKey === "string" && blockKey ? blockKey : undefined,
      comment: comment.trim(),
      authorEmail: session.user.email ?? "",
      authorName: session.user.name ?? session.user.email ?? "Unknown",
      authorRole: session.user.role ?? "employee",
    });
    return Response.json(annotation);
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await context.params;
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Authentication required" }, { status: 401 });
  if (session.user.role === "startup" && session.user.dealId !== dealId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const annotationId = url.searchParams.get("id");
  if (!annotationId) return Response.json({ error: "id required" }, { status: 400 });

  try {
    const all = await readAnnotations(dealId);
    const target = all.find((a) => a.id === annotationId);
    if (!target) return Response.json({ error: "Not found" }, { status: 404 });
    if (session.user.role !== "admin" && target.authorEmail !== session.user.email) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    await deleteAnnotation(dealId, annotationId);
    return Response.json({ ok: true });
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}
