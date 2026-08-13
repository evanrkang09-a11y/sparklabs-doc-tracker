/**
 * Uploaded documents live in Vercel Blob, under one folder per deal:
 *
 *   deals/<dealId>/<filename>
 *
 * The store is private, so files are not readable from a guessable URL.
 */

import { del, get, list, put } from "@vercel/blob";

export type UploadedFile = {
  filename: string;
  pathname: string;
  size: number;
  uploadedAt: string;
};

/** The Blob path prefix for one deal. Also used to validate upload requests. */
export function prefixForDeal(dealId: string): string {
  return `deals/${dealId}/`;
}

/**
 * Fetching one page in its own function keeps TypeScript from chasing its own
 * tail - otherwise `cursor` is read from the very call it feeds into.
 */
function listPage(prefix: string, cursor: string | undefined) {
  return list({ prefix, cursor, limit: 1000 });
}

/**
 * Removes one uploaded file. Permanent - Blob has no undo.
 *
 * The path is rebuilt here from the deal id rather than taken from the caller,
 * and a filename containing a slash is refused outright. Otherwise a filename
 * like "../../diligence/zest.json" would delete something it has no business
 * touching.
 */
export async function deleteUploadedFile(
  dealId: string,
  filename: string,
): Promise<void> {
  if (!filename || filename.includes("/") || filename.includes("\\")) {
    throw new Error("Invalid filename");
  }

  await del(`${prefixForDeal(dealId)}${filename}`);
}

/**
 * Biggest file we'll send to a model. IR decks run to 20MB, and base64 adds a
 * third on top - past this the request is more likely to be rejected than to
 * tell us anything, and the decks aren't what the checks read anyway.
 */
export const MAX_ANALYSIS_BYTES = 12 * 1024 * 1024;

/**
 * Pulls one uploaded file back out of storage as a base64 data URL, ready to
 * hand to a model. Returns null when the file is missing or too large to be
 * worth sending.
 */
export async function readFileAsDataUrl(
  dealId: string,
  filename: string,
): Promise<string | null> {
  if (!filename || filename.includes("/") || filename.includes("\\")) return null;

  const found = await get(`${prefixForDeal(dealId)}${filename}`, {
    access: "private",
    useCache: true,
  });

  if (!found?.stream) return null;
  if (found.blob.size && found.blob.size > MAX_ANALYSIS_BYTES) return null;

  const bytes = Buffer.from(await new Response(found.stream).arrayBuffer());
  const type = found.blob.contentType || "application/octet-stream";

  return `data:${type};base64,${bytes.toString("base64")}`;
}

/** Reads one uploaded file as raw bytes. Null when missing. */
export async function readFileBytes(
  dealId: string,
  filename: string,
): Promise<Uint8Array | null> {
  if (!filename || filename.includes("/") || filename.includes("\\")) return null;

  const found = await get(`${prefixForDeal(dealId)}${filename}`, {
    access: "private",
    useCache: false,
  });

  if (!found?.stream) return null;
  return new Uint8Array(await new Response(found.stream).arrayBuffer());
}

/** Stores a file directly, for content we produced rather than received. */
export async function writeUploadedFile(
  dealId: string,
  filename: string,
  data: Uint8Array,
  contentType?: string,
): Promise<void> {
  const safe = filename.split(/[\\/]/).pop() ?? filename;
  if (!safe) throw new Error("Invalid filename");

  await put(`${prefixForDeal(dealId)}${safe}`, Buffer.from(data), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: contentType || guessContentType(safe),
  });
}

function guessContentType(filename: string): string {
  const extension = filename.toLowerCase().split(".").pop() ?? "";

  return (
    {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xls: "application/vnd.ms-excel",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      doc: "application/msword",
      txt: "text/plain",
    }[extension] ?? "application/octet-stream"
  );
}

/**
 * Removes every uploaded file for a deal. Used when a company is deleted
 * outright - otherwise its documents would linger in the store, unreachable
 * but still there, which is the wrong answer for confidential paperwork.
 */
export async function deleteAllUploads(dealId: string): Promise<void> {
  const files = await listUploadedFiles(dealId);
  if (files.length === 0) return;

  await del(files.map((file) => file.pathname));
}

export async function listUploadedFiles(dealId: string): Promise<UploadedFile[]> {
  const prefix = prefixForDeal(dealId);
  const files: UploadedFile[] = [];
  let cursor: string | undefined = undefined;

  // Blob returns results in pages, so keep asking until there are no more.
  do {
    const page = await listPage(prefix, cursor);

    for (const blob of page.blobs) {
      // Skip the folder placeholder itself, if one exists.
      if (blob.pathname === prefix) continue;

      files.push({
        filename: blob.pathname.slice(prefix.length),
        pathname: blob.pathname,
        size: blob.size,
        uploadedAt:
          blob.uploadedAt instanceof Date
            ? blob.uploadedAt.toISOString()
            : String(blob.uploadedAt),
      });
    }

    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return files;
}
