/**
 * Saves one deal's SAFE-conversion state — the process steps done, dates,
 * which documents are gathered, and the share-estimate inputs.
 *
 * One JSON file in the private Blob store at conversion/<dealId>.json, mirroring
 * the execution store. Same whole-record read-modify-write caveat.
 */

import { del, get, put } from "@vercel/blob";
import type { CalcMethod } from "./conversion";

export type ConversionRecord = {
  dealId: string;
  /** 후속 라운드 납입일. */
  leadPaymentDate: string;
  /** SAFE 전환계약 서명일. */
  signingDate: string;
  /** 단수주 납입일. */
  fractionalPaymentDate: string;
  /** Whether the refund amount has been received. */
  refundReceived: boolean;
  /** Process steps done, keyed by ProcessStep id. */
  stepChecks: Record<string, boolean>;
  /** Pre-conversion documents gathered, keyed by ConversionDoc id. */
  preChecks: Record<string, boolean>;
  /** Post-conversion documents gathered, keyed by ConversionDoc id. */
  postChecks: Record<string, boolean>;
  /** Free-text comments per process step, keyed by step id. */
  stepComments: Record<string, string>;
  /** Free-text comments per pre-conversion doc, keyed by doc id. */
  preComments: Record<string, string>;
  /** Free-text comments per post-conversion doc, keyed by doc id. */
  postComments: Record<string, string>;
  /** Share-conversion estimate inputs. */
  calc: {
    method: CalcMethod;
    amount: string;
    roundPrice: string;
    discountPct: string;
    cap: string;
    preShares: string;
  };
  updatedBy: string | null;
  updatedAt: string | null;
};

function pathFor(dealId: string): string {
  return `conversion/${dealId}.json`;
}

export function emptyConversion(dealId: string): ConversionRecord {
  return {
    dealId,
    leadPaymentDate: "",
    signingDate: "",
    fractionalPaymentDate: "",
    refundReceived: false,
    stepChecks: {},
    preChecks: {},
    postChecks: {},
    stepComments: {},
    preComments: {},
    postComments: {},
    calc: {
      method: "discount",
      amount: "",
      roundPrice: "",
      discountPct: "",
      cap: "",
      preShares: "",
    },
    updatedBy: null,
    updatedAt: null,
  };
}

export async function readConversion(dealId: string): Promise<ConversionRecord> {
  const found = await get(pathFor(dealId), { access: "private", useCache: false });
  if (!found?.stream) return emptyConversion(dealId);

  try {
    const raw: unknown = JSON.parse(await new Response(found.stream).text());
    return sanitize(dealId, raw);
  } catch {
    return emptyConversion(dealId);
  }
}

export async function saveConversion(
  dealId: string,
  input: Partial<ConversionRecord>,
  updatedBy: string | null,
): Promise<ConversionRecord> {
  const existing = await readConversion(dealId);
  const merged: ConversionRecord = { ...existing, ...input, dealId };

  const clean = sanitize(dealId, merged);
  clean.updatedBy = updatedBy;
  clean.updatedAt = new Date().toISOString();

  await put(pathFor(dealId), JSON.stringify(clean, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });

  return clean;
}

export async function deleteConversion(dealId: string): Promise<void> {
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

function cleanComments(raw: unknown): Record<string, string> {
  if (typeof raw !== "object" || raw === null) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && value.length <= 2000) out[key] = value;
  }
  return out;
}

function str(raw: unknown, max = 40): string {
  return typeof raw === "string" ? raw.slice(0, max) : "";
}

function sanitize(dealId: string, raw: unknown): ConversionRecord {
  const record = emptyConversion(dealId);
  if (typeof raw !== "object" || raw === null) return record;

  const r = raw as Partial<ConversionRecord>;

  record.leadPaymentDate = str(r.leadPaymentDate, 20);
  record.signingDate = str(r.signingDate, 20);
  record.fractionalPaymentDate = str(r.fractionalPaymentDate, 20);
  record.refundReceived = r.refundReceived === true;
  record.stepChecks = cleanChecks(r.stepChecks);
  record.preChecks = cleanChecks(r.preChecks);
  record.postChecks = cleanChecks(r.postChecks);
  record.stepComments = cleanComments(r.stepComments);
  record.preComments = cleanComments(r.preComments);
  record.postComments = cleanComments(r.postComments);

  const calc = (r.calc ?? {}) as Partial<ConversionRecord["calc"]>;
  record.calc = {
    method: calc.method === "cap" ? "cap" : "discount",
    amount: str(calc.amount),
    roundPrice: str(calc.roundPrice),
    discountPct: str(calc.discountPct),
    cap: str(calc.cap),
    preShares: str(calc.preShares),
  };

  return record;
}
