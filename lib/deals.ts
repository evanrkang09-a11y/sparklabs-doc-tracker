/**
 * The shape of a company we're collecting documents from, and of the batch it
 * belongs to.
 *
 * Companies used to be a hardcoded list here. They now live in storage (see
 * lib/deals-store.ts) so they can be added, archived and deleted from the
 * screen; this file keeps only the types and the two seed companies that the
 * store falls back to when it is empty.
 */

import type { Market } from "./documents";

/**
 * Which review track the company is on.
 *
 * Taken from the mentor's "#3. 서류 실사" document, point 13, because it's the
 * distinction that actually changes what paperwork is required at the end:
 * batch-selected companies substitute a Scorecard, overseas companies need the
 * report for the Bank of Korea review, and domestic TIPS companies need it for
 * their written review.
 */
export type DealType = "batch" | "tips" | "general";

export const DEAL_TYPES: { value: DealType; ko: string; en: string }[] = [
  { value: "batch", ko: "배치 · KF 선발", en: "Batch / KF selected" },
  { value: "tips", ko: "팁스 기업", en: "TIPS company" },
  { value: "general", ko: "일반", en: "General" },
];

export type Deal = {
  /** Used in the URL - short, lowercase, no spaces. */
  id: string;
  companyKo: string;
  companyEn: string;
  market: Market;
  dealType: DealType;
  /** Which intake round this company came in on. Null when unassigned. */
  batchId: string | null;
  /** Which SparkLabs fund is investing (see lib/funds.ts). Null when unassigned. */
  fundId: string | null;
  /** Archived companies stay readable but drop out of the working list. */
  archived: boolean;
  createdAt: string;
  /**
   * Also read the mentor's sample Google Drive folder for this deal, on top of
   * anything uploaded. Off by default - the tracker should reflect what was
   * actually uploaded.
   */
  readsSampleDriveFolder?: boolean;
};

/**
 * The sidebar's selection for "companies in no batch at all".
 *
 * A sentinel rather than null, because null already means "every batch". Both
 * the sidebar and the list filter on this, so it lives here rather than being
 * spelled out in each - written twice, they drifted immediately.
 */
export const UNASSIGNED_BATCH = "__none__";

/** Whether a company belongs in the currently selected batch. */
export function matchesBatch(
  deal: { batchId: string | null },
  selected: string | null,
): boolean {
  if (selected === null) return true;
  if (selected === UNASSIGNED_BATCH) return !deal.batchId;
  return deal.batchId === selected;
}

export type Batch = {
  id: string;
  name: string;
  /** Free text - "2026 상반기", "Batch 14", whatever the team calls it. */
  note?: string;
  createdAt: string;
};

/**
 * What the store starts with the first time it runs, so an empty deployment
 * isn't a blank screen. Once anything is saved these are no longer consulted.
 */
export const SEED_DEALS: Deal[] = [
  {
    id: "zest",
    companyKo: "제스트",
    companyEn: "Zest",
    market: "domestic",
    dealType: "batch",
    batchId: null,
    fundId: null,
    archived: false,
    createdAt: "2026-08-11T00:00:00.000Z",
    readsSampleDriveFolder: false,
  },
  {
    id: "demo-overseas",
    companyKo: "해외 샘플 기업",
    companyEn: "Overseas Sample Co.",
    market: "overseas",
    dealType: "general",
    batchId: null,
    fundId: null,
    archived: false,
    createdAt: "2026-08-11T00:00:00.000Z",
  },
];

/**
 * Turns a company name into something usable in a URL.
 *
 * Korean characters are kept - they survive a URL fine and a Korean team
 * reading /deal/제스트 is better served than by /deal/company-3. Falls back to
 * a timestamp only when a name has nothing usable in it at all.
 */
export function toDealId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    // Strip anything that would need escaping in a path segment.
    .replace(/[^\p{Letter}\p{Number}-]/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

  return slug || `company-${Date.now()}`;
}
