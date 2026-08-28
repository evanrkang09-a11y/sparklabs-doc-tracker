/**
 * The agreement being drafted for one company.
 *
 * Shared, not personal. It lives in the same private Blob store as everything
 * else, at agreements/<dealId>.json, so whoever opens the company next sees the
 * work in progress. A contract drafted in one person's browser would be
 * invisible to the colleague who has to check it, and lost when they closed the
 * tab.
 *
 * Every company gets its own record, created on first edit from the template
 * defaults. Nothing is per-user except the name recorded against the last save.
 */

import { del, get, put } from "@vercel/blob";
import { type AgreementValues } from "./agreement-fields";
import { getContract, isContractType, type ContractType } from "./contracts";

export type StartupEdit = { editedBy: string; editedAt: string };

export type AgreementRecord = {
  dealId: string;
  /** Which contract template this deal is filling. */
  contractType: ContractType;
  values: AgreementValues;
  /** User edits to plain-text paragraphs, keyed by block index string. */
  overrides: Record<string, string>;
  /** Who saved last and when, so a colleague knows whose numbers these are. */
  updatedBy: string | null;
  updatedAt: string | null;
  /** Fields last touched by the startup, so employees can see company contributions. */
  startupEdits?: Record<string, StartupEdit>;
};

function pathFor(dealId: string): string {
  return `agreements/${dealId}.json`;
}

export function emptyAgreement(
  dealId: string,
  contractType: ContractType = "cps",
): AgreementRecord {
  return {
    dealId,
    contractType,
    // Seeded with the house standards for that contract, so a new agreement
    // starts from SparkLabs' position rather than blank.
    values: getContract(contractType).spec.defaultValues(),
    overrides: {},
    updatedBy: null,
    updatedAt: null,
  };
}

export async function readAgreement(dealId: string): Promise<AgreementRecord> {
  // useCache: false - two people may be editing the same contract, and reading
  // a cached copy would show one of them their colleague's work missing.
  const found = await get(pathFor(dealId), { access: "private", useCache: false });
  if (!found?.stream) return emptyAgreement(dealId);

  try {
    const raw: unknown = JSON.parse(await new Response(found.stream).text());
    if (typeof raw !== "object" || raw === null) return emptyAgreement(dealId);

    const { values, overrides, updatedBy, updatedAt, contractType } = raw as Partial<AgreementRecord>;
    const type = isContractType(contractType) ? contractType : "cps";

    const { startupEdits } = raw as Partial<AgreementRecord>;

    return {
      dealId,
      contractType: type,
      // Defaults underneath, so a field added to the template later appears
      // with its standard value rather than blank in an existing draft.
      values: { ...getContract(type).spec.defaultValues(), ...cleanValues(values) },
      overrides: cleanOverrides(overrides),
      updatedBy: typeof updatedBy === "string" ? updatedBy : null,
      updatedAt: typeof updatedAt === "string" ? updatedAt : null,
      startupEdits: cleanStartupEdits(startupEdits),
    };
  } catch {
    return emptyAgreement(dealId);
  }
}

/**
 * Saves the whole set of values.
 *
 * Whole-record rather than per-field: the form is edited as one thing and saved
 * on a button, so there's no interleaving to lose. Same last-write-wins caveat
 * as the other stores - two people saving the same contract in the same second
 * would have the later win.
 */
export async function saveAgreement(
  dealId: string,
  contractType: ContractType,
  values: AgreementValues,
  updatedBy: string,
  overrides: Record<string, string> = {},
  startupEdits?: Record<string, StartupEdit>,
): Promise<AgreementRecord> {
  const record: AgreementRecord = {
    dealId,
    contractType: isContractType(contractType) ? contractType : "cps",
    values: cleanValues(values),
    overrides: cleanOverrides(overrides),
    updatedBy,
    updatedAt: new Date().toISOString(),
    ...(startupEdits ? { startupEdits } : {}),
  };

  await put(pathFor(dealId), JSON.stringify(record, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });

  return record;
}

export async function deleteAgreement(dealId: string): Promise<void> {
  try {
    await del(pathFor(dealId));
  } catch {
    // No agreement drafted; not a failure worth aborting a deletion over.
  }
}

/** Keeps string values only - the record is written by a form, but read from disk. */
function cleanValues(values: unknown): AgreementValues {
  if (typeof values !== "object" || values === null) return {};

  const out: AgreementValues = {};
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/** Keeps paragraph overrides that are non-empty strings, max 10 000 chars each. */
function cleanOverrides(overrides: unknown): Record<string, string> {
  if (typeof overrides !== "object" || overrides === null) return {};

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === "string" && value.length > 0 && value.length <= 10_000) {
      out[key] = value;
    }
  }
  return out;
}

function cleanStartupEdits(edits: unknown): Record<string, StartupEdit> | undefined {
  if (typeof edits !== "object" || edits === null) return undefined;
  const out: Record<string, StartupEdit> = {};
  for (const [key, value] of Object.entries(edits)) {
    if (
      typeof value === "object" &&
      value !== null &&
      typeof (value as Record<string, unknown>).editedBy === "string" &&
      typeof (value as Record<string, unknown>).editedAt === "string"
    ) {
      out[key] = {
        editedBy: (value as Record<string, string>).editedBy,
        editedAt: (value as Record<string, string>).editedAt,
      };
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
