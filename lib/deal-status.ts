/**
 * Works out which required documents a deal has actually received.
 *
 * Shared by the company-facing tracker and the internal 실사 checklist, so the
 * two screens can never disagree about whether a document has arrived.
 */

import type { Deal } from "./deals";
import { documentsFor, matchDocument, type RequiredDocument } from "./documents";
import { listUploadedFiles } from "./storage";
import { isDriveConfigured, listDriveFilenames } from "./drive";
import { describe } from "./errors";

export type FoundFile = {
  name: string;
  source: "upload" | "drive";
  /**
   * When the file arrived. Carried through so the diligence screen can tell
   * that an analysis predates the document it claims to have read - a stale
   * "looks satisfied" on a re-uploaded document is the dangerous case.
   */
  uploadedAt?: string;
};

export type TrackedDocument = RequiredDocument & {
  files: FoundFile[];
  submitted: boolean;
};

export type DealStatus = {
  documents: TrackedDocument[];
  unrecognized: FoundFile[];
  totalRequired: number;
  missingCount: number;
  /** Problems worth showing the user rather than failing the whole page over. */
  warnings: string[];
  checkedAt: string;
};

export async function collectDealStatus(deal: Deal): Promise<DealStatus> {
  const found: FoundFile[] = [];
  const warnings: string[] = [];

  const readsDrive = deal.readsSampleDriveFolder && isDriveConfigured();

  // Both sources are independent network calls - run them together instead
  // of paying each round trip in sequence.
  const [uploaded, drive] = await Promise.allSettled([
    listUploadedFiles(deal.id),
    readsDrive ? listDriveFilenames() : Promise.resolve([]),
  ]);

  // What the company has uploaded through the site.
  if (uploaded.status === "fulfilled") {
    for (const file of uploaded.value) {
      found.push({
        name: file.filename,
        source: "upload",
        uploadedAt: file.uploadedAt,
      });
    }
  } else {
    warnings.push(`업로드 파일을 불러오지 못했습니다 — ${describe(uploaded.reason)}`);
  }

  // Optionally also count the mentor's sample Drive folder.
  if (readsDrive) {
    if (drive.status === "fulfilled") {
      for (const name of drive.value) {
        found.push({ name, source: "drive" });
      }
    } else {
      warnings.push(`구글 드라이브를 불러오지 못했습니다 — ${describe(drive.reason)}`);
    }
  }

  // Group what we found by which document it satisfies.
  const filesByDocumentId = new Map<string, FoundFile[]>();
  const unrecognized: FoundFile[] = [];

  for (const file of found) {
    const document = matchDocument(file.name, deal.market);

    if (!document) {
      unrecognized.push(file);
      continue;
    }

    filesByDocumentId.set(document.id, [
      ...(filesByDocumentId.get(document.id) ?? []),
      file,
    ]);
  }

  const documents = documentsFor(deal.market).map((document) => {
    const files = filesByDocumentId.get(document.id) ?? [];
    return { ...document, files, submitted: files.length > 0 };
  });

  const mandatory = documents.filter((document) => !document.optional);

  return {
    documents,
    unrecognized,
    totalRequired: mandatory.length,
    missingCount: mandatory.filter((document) => !document.submitted).length,
    warnings,
    checkedAt: new Date().toISOString(),
  };
}

// Re-exported so existing importers keep working. The implementation lives in
// lib/errors.ts so client components can use it without pulling googleapis
// into the browser bundle through this module.
export { describe };
