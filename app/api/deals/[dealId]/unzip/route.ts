/**
 * Unpacks a zip that was uploaded to a company's folder.
 *
 * The upload itself goes browser-to-storage so a 20MB deck can get through, so
 * a zip lands whole and this runs afterwards: download it, expand it, store
 * each document under its own name, then remove the archive.
 *
 * The zip goes last. If a write fails part-way the archive is still there and
 * the operation can be repeated; deleting it first would lose the documents.
 */

import { auth } from "@/auth";
import { describe } from "@/lib/errors";
import { getDeal } from "@/lib/deals-store";
import { unzip } from "@/lib/unzip";
import { deleteUploadedFile, readFileBytes, writeUploadedFile } from "@/lib/storage";

export async function POST(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role === "startup") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { dealId } = await context.params;
  if (!(await getDeal(dealId))) {
    return Response.json({ error: `Unknown deal: ${dealId}` }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { filename } = (body ?? {}) as Record<string, unknown>;

  if (typeof filename !== "string" || !filename.toLowerCase().endsWith(".zip")) {
    return Response.json({ error: "Not a zip file" }, { status: 400 });
  }

  try {
    const bytes = await readFileBytes(dealId, filename);
    if (!bytes) {
      return Response.json({ error: "Archive not found" }, { status: 404 });
    }

    const entries = unzip(bytes);
    if (entries.length === 0) {
      return Response.json(
        { error: "The archive contained no readable files" },
        { status: 400 },
      );
    }

    await Promise.all(
      entries.map((entry) => writeUploadedFile(dealId, entry.name, entry.data)),
    );

    await deleteUploadedFile(dealId, filename);

    return Response.json({
      extracted: entries.map((entry) => entry.name),
      count: entries.length,
    });
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}
