/**
 * Removing an uploaded document.
 *
 * Companies do upload the wrong file - an old version, the wrong company's
 * paperwork, a scan that came out blank - so they need a way to take it back.
 *
 * Note there is no login yet: anyone holding a deal's link can delete that
 * deal's files, exactly as anyone holding it can upload. Worth fixing before
 * this handles anything but sample data.
 */

import { getDeal } from "@/lib/deals";
import { describe } from "@/lib/deal-status";
import { deleteUploadedFile } from "@/lib/storage";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await context.params;

  if (!getDeal(dealId)) {
    return Response.json({ error: `Unknown deal: ${dealId}` }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { filename } = (body ?? {}) as Record<string, unknown>;

  if (typeof filename !== "string" || !filename.trim()) {
    return Response.json({ error: "'filename' is required" }, { status: 400 });
  }

  try {
    await deleteUploadedFile(dealId, filename);
    return Response.json({ deleted: filename });
  } catch (problem) {
    const message = describe(problem);
    // A rejected path is the caller's mistake, not ours.
    const status = message === "Invalid filename" ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
