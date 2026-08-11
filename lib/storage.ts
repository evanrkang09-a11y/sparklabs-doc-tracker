/**
 * Uploaded documents live in Vercel Blob, under one folder per deal:
 *
 *   deals/<dealId>/<filename>
 *
 * The store is private, so files are not readable from a guessable URL.
 */

import { list } from "@vercel/blob";

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
