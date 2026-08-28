/**
 * The SparkLabs funds a company can be invested from.
 *
 * Source: the mentor's fund list. Fixed reference data - funds are created by
 * the finance side, not from this app, so this is a static list rather than a
 * store. A company points at one of these by `fundId` (see lib/deals.ts).
 */

export type Fund = {
  /** Stable id used on a deal's `fundId` and in the sidebar. */
  id: string;
  name: string;
  /** SparkLabs Ventures / Partners / Sparklabs / Other. */
  category: string;
  currency: string;
  /** Google Drive folder ID, created when the fund is added. */
  driveFolderId?: string;
};

export const FUNDS: Fund[] = [
  { id: "skf1", name: "SKF1", category: "SparkLabs Ventures", currency: "KRW" },
  { id: "skf2", name: "SKF2", category: "Other", currency: "USD" },
  { id: "skf3", name: "SKF3", category: "SparkLabs Partners", currency: "KRW" },
  { id: "skf4", name: "SKF4", category: "SparkLabs", currency: "KRW", driveFolderId: "1mRuFGLKnI7yeeX9X3z299OGT_9eWqFDi" },
  { id: "sshin1", name: "Sshin1", category: "SparkLabs Partners", currency: "KRW" },
  { id: "cloud1", name: "Cloud1", category: "SparkLabs", currency: "KRW" },
  { id: "cjftr", name: "CJftr", category: "SparkLabs Partners", currency: "KRW", driveFolderId: "1AvIGZ5ZiwbG2LeUxtzs7AhnrU-NLdBI5" },
  { id: "firststep", name: "Firststep", category: "SparkLabs", currency: "KRW", driveFolderId: "1PfM5QCEMjSUInkq-djvGzrLdRWk5jF6M" },
  { id: "ignition1", name: "Ignition1", category: "Other", currency: "USD" },
  { id: "cosmetic", name: "Cosmetic", category: "SparkLabs", currency: "KRW" },
  { id: "skhn", name: "SKHN", category: "SparkLabs", currency: "KRW" },
  { id: "discovery1", name: "Discovery1", category: "Other", currency: "KRW" },
  { id: "discovery2", name: "Discovery2", category: "Other", currency: "KRW" },
  { id: "discovery3", name: "Discovery3", category: "Other", currency: "KRW" },
  { id: "discovery4", name: "Discovery4", category: "SparkLabs", currency: "KRW" },
];

const BY_ID = new Map(FUNDS.map((fund) => [fund.id, fund]));

export function getFund(id: string | null | undefined): Fund | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function isKnownFundId(id: unknown): id is string {
  return typeof id === "string" && BY_ID.has(id);
}
