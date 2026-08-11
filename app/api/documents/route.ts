import { promises as fs } from "fs";
import path from "path";
import { REQUIRED_DOCUMENTS, matchDocument } from "@/lib/documents";
import { isDriveConfigured, listDriveFilenames } from "@/lib/drive";

// Route Handlers are not cached by default, so every request gets a fresh look
// at the folder. Nothing extra needed here.

/** Fallback source: a plain folder on disk, used when Drive isn't set up. */
async function listLocalFilenames(): Promise<string[]> {
  const folder = path.join(process.cwd(), "sample-drive");

  try {
    const entries = await fs.readdir(folder);
    return entries.filter((name) => !name.startsWith("."));
  } catch {
    // Folder doesn't exist - treat that as "nothing submitted".
    return [];
  }
}

/**
 * Prefer Google Drive when it's configured, but never let a Drive problem take
 * the whole page down - fall back to the local folder and say so.
 */
async function collectFilenames(): Promise<{
  filenames: string[];
  source: "drive" | "local";
  warning: string | null;
}> {
  if (!isDriveConfigured()) {
    return { filenames: await listLocalFilenames(), source: "local", warning: null };
  }

  try {
    return { filenames: await listDriveFilenames(), source: "drive", warning: null };
  } catch (problem) {
    const reason = problem instanceof Error ? problem.message : "unknown error";
    return {
      filenames: await listLocalFilenames(),
      source: "local",
      warning: `Google Drive lookup failed, showing the local folder instead — ${reason}`,
    };
  }
}

export async function GET() {
  const { filenames, source, warning } = await collectFilenames();

  // Group the files we found by which document they satisfy.
  const filesByDocumentId = new Map<string, string[]>();
  const unrecognized: string[] = [];

  for (const filename of filenames) {
    const document = matchDocument(filename);

    if (!document) {
      unrecognized.push(filename);
      continue;
    }

    const existing = filesByDocumentId.get(document.id) ?? [];
    filesByDocumentId.set(document.id, [...existing, filename]);
  }

  const documents = REQUIRED_DOCUMENTS.map((document) => {
    const files = filesByDocumentId.get(document.id) ?? [];
    return { ...document, files, submitted: files.length > 0 };
  });

  const mandatory = documents.filter((document) => !document.optional);

  return Response.json({
    documents,
    unrecognized,
    totalRequired: mandatory.length,
    missingCount: mandatory.filter((document) => !document.submitted).length,
    source,
    warning,
    checkedAt: new Date().toISOString(),
  });
}
