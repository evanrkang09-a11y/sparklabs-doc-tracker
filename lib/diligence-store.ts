/**
 * Saves the state of one deal's 실사 checklist - which boxes are ticked and
 * what was written in each memo.
 *
 * There is no database yet, so the record is kept as a small JSON file in the
 * same private Blob store the documents live in:
 *
 *   diligence/<dealId>.json
 *
 * Deliberately NOT under deals/<dealId>/ - that prefix is what the document
 * tracker lists, so a state file there would show up as a mystery upload, and
 * the upload endpoint only ever hands out tokens for that prefix, which means
 * a company cannot reach this file.
 *
 * Caveat worth knowing: saving reads the whole record, changes one entry and
 * writes the whole record back. Two people editing the same deal at the same
 * second would have the later save win. Fine for one analyst per deal; if that
 * changes, Blob's `ifMatch` option gives an ETag check to build on.
 */

import { get, put } from "@vercel/blob";
import { isKnownCheckId } from "./diligence";

export type CheckState = {
  checked: boolean;
  note: string;
  /** When this individual check was last touched. */
  updatedAt: string;
};

export type DiligenceRecord = {
  dealId: string;
  /** Keyed by DiligenceItem id. Items never edited are simply absent. */
  checks: Record<string, CheckState>;
  updatedAt: string | null;
};

export type CheckEdit = {
  checkId: string;
  checked?: boolean;
  note?: string;
};

/** Memos are for a sentence or two of context, not for pasting a document in. */
const MAX_NOTE_LENGTH = 2000;

function pathFor(dealId: string): string {
  return `diligence/${dealId}.json`;
}

function emptyRecord(dealId: string): DiligenceRecord {
  return { dealId, checks: {}, updatedAt: null };
}

/**
 * Reads the saved record. A deal that has never been touched has no file at
 * all, which is not an error - it just means nothing is ticked yet.
 */
export async function readDiligence(dealId: string): Promise<DiligenceRecord> {
  // useCache: false because we may be reading straight after a write, and a
  // cached copy would show the analyst their own edit disappearing.
  const found = await get(pathFor(dealId), { access: "private", useCache: false });

  if (!found?.stream) return emptyRecord(dealId);

  const parsed: unknown = JSON.parse(await new Response(found.stream).text());
  return sanitize(dealId, parsed);
}

/** Applies one edit and saves. Returns the record as it now stands. */
export async function saveDiligenceEdit(
  dealId: string,
  edit: CheckEdit,
): Promise<DiligenceRecord> {
  if (!isKnownCheckId(edit.checkId)) {
    throw new Error(`Unknown checklist item: ${edit.checkId}`);
  }

  const record = await readDiligence(dealId);
  const now = new Date().toISOString();
  const existing = record.checks[edit.checkId];

  record.checks[edit.checkId] = {
    checked: edit.checked ?? existing?.checked ?? false,
    note: (edit.note ?? existing?.note ?? "").slice(0, MAX_NOTE_LENGTH),
    updatedAt: now,
  };
  record.updatedAt = now;

  await put(pathFor(dealId), JSON.stringify(record, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });

  return record;
}

/**
 * Whatever is in the file was written by an older version of this code, or by
 * hand. Trust the shape of nothing and rebuild it from what we recognise.
 */
function sanitize(dealId: string, raw: unknown): DiligenceRecord {
  const record = emptyRecord(dealId);
  if (typeof raw !== "object" || raw === null) return record;

  const { checks, updatedAt } = raw as Partial<DiligenceRecord>;
  if (typeof updatedAt === "string") record.updatedAt = updatedAt;
  if (typeof checks !== "object" || checks === null) return record;

  for (const [checkId, state] of Object.entries(checks)) {
    // Drop checks for items that have since been removed from the checklist.
    if (!isKnownCheckId(checkId) || typeof state !== "object" || state === null) {
      continue;
    }

    record.checks[checkId] = {
      checked: state.checked === true,
      note: typeof state.note === "string" ? state.note.slice(0, MAX_NOTE_LENGTH) : "",
      updatedAt: typeof state.updatedAt === "string" ? state.updatedAt : "",
    };
  }

  return record;
}
