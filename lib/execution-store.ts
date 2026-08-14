/**
 * Saves one deal's 투자 집행 (execution) state — fund type, structure, the
 * 운용지시 and 납입 dates, which documents in each phase are gathered, and the
 * numbers cross-checked against the signed agreement.
 *
 * One JSON file in the same private Blob store as everything else:
 *
 *   execution/<dealId>.json
 *
 * Whole-record read-modify-write, same caveat as the other stores: two people
 * editing the same deal in the same second have the later save win. Fine for
 * one analyst per deal.
 */

import { del, get, put } from "@vercel/blob";
import type { FundType, InvestmentStructure } from "./execution";

/** Three key figures, as written on one source document. */
export type NumberSet = {
  shares: string;
  price: string;
  amount: string;
};

export type ExecutionRecord = {
  dealId: string;
  fundType: FundType | null;
  structure: InvestmentStructure | null;
  /** 운용지시일 - free text YYYY-MM-DD. */
  instructionDate: string;
  /** 납입일 - free text YYYY-MM-DD. */
  paymentDate: string;
  /** 운용지시 서류 gathered, keyed by ExecutionDoc id. */
  oiChecks: Record<string, boolean>;
  /** 투자납입 후 서류 gathered, keyed by ExecutionDoc id. */
  postChecks: Record<string, boolean>;
  /** Numbers as they appear on the 운용지시서 and the 의사록, to cross-check. */
  consistency: {
    instruction: NumberSet;
    minutes: NumberSet;
  };
  updatedBy: string | null;
  updatedAt: string | null;
};

function pathFor(dealId: string): string {
  return `execution/${dealId}.json`;
}

function emptyNumbers(): NumberSet {
  return { shares: "", price: "", amount: "" };
}

export function emptyExecution(dealId: string): ExecutionRecord {
  return {
    dealId,
    fundType: null,
    structure: null,
    instructionDate: "",
    paymentDate: "",
    oiChecks: {},
    postChecks: {},
    consistency: { instruction: emptyNumbers(), minutes: emptyNumbers() },
    updatedBy: null,
    updatedAt: null,
  };
}

export async function readExecution(dealId: string): Promise<ExecutionRecord> {
  // useCache: false so a save is immediately visible on reload.
  const found = await get(pathFor(dealId), { access: "private", useCache: false });
  if (!found?.stream) return emptyExecution(dealId);

  try {
    const raw: unknown = JSON.parse(await new Response(found.stream).text());
    return sanitize(dealId, raw);
  } catch {
    return emptyExecution(dealId);
  }
}

/** Whole-record save. Returns the record as it now stands. */
export async function saveExecution(
  dealId: string,
  input: Partial<ExecutionRecord>,
  updatedBy: string | null,
): Promise<ExecutionRecord> {
  const existing = await readExecution(dealId);

  const record: ExecutionRecord = {
    ...existing,
    ...input,
    dealId,
    updatedBy,
    updatedAt: new Date().toISOString(),
  };

  // Re-sanitise so a hand-crafted PATCH can't write a bad shape.
  const clean = sanitize(dealId, record);
  clean.updatedBy = updatedBy;
  clean.updatedAt = record.updatedAt;

  await put(pathFor(dealId), JSON.stringify(clean, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });

  return clean;
}

export async function deleteExecution(dealId: string): Promise<void> {
  try {
    await del(pathFor(dealId));
  } catch {
    // Nothing to remove; not a failure worth aborting a deletion over.
  }
}

// --- helpers ---------------------------------------------------------------

function cleanChecks(raw: unknown): Record<string, boolean> {
  if (typeof raw !== "object" || raw === null) return {};
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === true) out[key] = true;
  }
  return out;
}

function cleanNumbers(raw: unknown): NumberSet {
  const set = emptyNumbers();
  if (typeof raw !== "object" || raw === null) return set;
  const r = raw as Record<string, unknown>;
  for (const key of ["shares", "price", "amount"] as const) {
    if (typeof r[key] === "string") set[key] = (r[key] as string).slice(0, 40);
  }
  return set;
}

function sanitize(dealId: string, raw: unknown): ExecutionRecord {
  const record = emptyExecution(dealId);
  if (typeof raw !== "object" || raw === null) return record;

  const r = raw as Partial<ExecutionRecord>;

  record.fundType =
    r.fundType === "mother" || r.fundType === "private" ? r.fundType : null;
  record.structure =
    r.structure === "new-shares" || r.structure === "safe" ? r.structure : null;
  record.instructionDate =
    typeof r.instructionDate === "string" ? r.instructionDate.slice(0, 20) : "";
  record.paymentDate =
    typeof r.paymentDate === "string" ? r.paymentDate.slice(0, 20) : "";
  record.oiChecks = cleanChecks(r.oiChecks);
  record.postChecks = cleanChecks(r.postChecks);
  record.consistency = {
    instruction: cleanNumbers(r.consistency?.instruction),
    minutes: cleanNumbers(r.consistency?.minutes),
  };
  record.updatedBy = typeof r.updatedBy === "string" ? r.updatedBy : null;
  record.updatedAt = typeof r.updatedAt === "string" ? r.updatedAt : null;

  return record;
}
