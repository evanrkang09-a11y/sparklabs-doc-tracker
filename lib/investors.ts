/**
 * A reusable "investor profile" — SparkLabs' own side of an investment
 * agreement, saved once and applied to any deal.
 *
 * Every agreement repeats the same block: the fund's name, its address, the
 *업무집행조합원 (general partner) and their representative, and the notice
 * recipient. Those don't change from deal to deal — only the fund does. So
 * rather than retype them each time, a profile holds them and the agreement
 * editor fills them in one click.
 *
 * A profile stores values keyed by the SAME field ids the agreement uses
 * (see agreement-fields.ts), so applying a profile is a plain merge — no
 * mapping table to keep in sync.
 */

import { ALL_FIELDS, defaultValues, type AgreementField } from "./agreement-fields";

/**
 * The agreement fields that make up SparkLabs' side of the contract.
 *
 * Company-side fields (companyName, share counts, dates) are deliberately
 * excluded — those belong to the deal, not the investor.
 */
export const INVESTOR_PROFILE_FIELD_IDS = [
  "investorName",
  "investorAddress",
  "investorRep",
  "fundName",
  "fundAddress",
  "gpName",
  "gpAddress",
  "gpRepLine",
  "gpRepName",
  "noticeInvestorTo",
  "noticeInvestorAddress",
] as const;

/** The field definitions for the profile fields, in display order. */
export const INVESTOR_PROFILE_FIELDS: AgreementField[] = INVESTOR_PROFILE_FIELD_IDS.map(
  (id) => ALL_FIELDS.find((field) => field.id === id),
).filter((field): field is AgreementField => Boolean(field));

export type InvestorProfile = {
  /** Used in the URL and as a stable key - short, lowercase, no spaces. */
  id: string;
  /** Human name for the fund, e.g. "스파크랩 디스커버리펀드8호". */
  label: string;
  /** Values keyed by agreement field id. Missing fields are simply absent. */
  values: Record<string, string>;
  createdAt: string;
};

/**
 * What the store starts with the first time it runs: one profile built from
 * the house defaults already baked into the agreement template, so the fund
 * SparkLabs uses today is present without anyone typing it in.
 */
export function seedInvestorProfiles(): InvestorProfile[] {
  const defaults = defaultValues();
  const values: Record<string, string> = {};

  for (const id of INVESTOR_PROFILE_FIELD_IDS) {
    if (defaults[id]) values[id] = defaults[id];
  }

  return [
    {
      id: "discovery-fund-8",
      label: "스파크랩 디스커버리펀드8호",
      values,
      createdAt: "2026-08-14T00:00:00.000Z",
    },
  ];
}

/** Keeps only recognised profile fields, as strings - the record is read from disk. */
export function cleanProfileValues(values: unknown): Record<string, string> {
  if (typeof values !== "object" || values === null) return {};

  const known = new Set<string>(INVESTOR_PROFILE_FIELD_IDS);
  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(values)) {
    if (known.has(key) && typeof value === "string") out[key] = value;
  }

  return out;
}
