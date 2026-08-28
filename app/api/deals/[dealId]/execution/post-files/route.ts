/**
 * Serve and delete uploaded post-payment files.
 *
 * Files are stored in Vercel Blob at:
 *   execution-post/<dealId>/<docId>/<filename>
 *
 * GET  — streams the file back to the browser for download (private blob).
 * DELETE — removes the file from Blob (client updates the record via autosave).
 */

import { del, get } from "@vercel/blob";
import { auth } from "@/auth";
import { getDeal } from "@/lib/deals-store";

const KNOWN_DOC_IDS = new Set([
  "post-unissued-cert", "post-shareholder-registry", "post-corporate-seal",
  "post-corporate-registry", "post-balance-cert", "post-stock-certificate",
  "post-coi", "post-business-profile", "post-receipt", "post-cap-table",
  "post-investment-list", "post-shareholder-list", "post-business-reg",
]);

export async function GET(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role === "startup") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { dealId } = await context.params;
  if (!(await getDeal(dealId))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const docId = searchParams.get("docId") ?? "";
  const filename = searchParams.get("filename") ?? "";
  if (!docId || !filename || !KNOWN_DOC_IDS.has(docId) || filename.includes("/") || filename.includes("\\")) {
    return Response.json({ error: "Invalid params" }, { status: 400 });
  }

  const found = await get(`execution-post/${dealId}/${docId}/${filename}`, {
    access: "private",
    useCache: false,
  });
  if (!found?.stream) return Response.json({ error: "Not found" }, { status: 404 });

  return new Response(found.stream, {
    headers: {
      "Content-Type": found.blob.contentType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role === "startup") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { dealId } = await context.params;
  if (!(await getDeal(dealId))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const { docId, filename } = (body ?? {}) as Record<string, unknown>;
  if (
    typeof docId !== "string" ||
    typeof filename !== "string" ||
    !docId ||
    !filename ||
    !KNOWN_DOC_IDS.has(docId) ||
    filename.includes("/")
  ) {
    return Response.json({ error: "Invalid params" }, { status: 400 });
  }

  await del(`execution-post/${dealId}/${docId}/${filename}`);
  return Response.json({ deleted: true });
}
