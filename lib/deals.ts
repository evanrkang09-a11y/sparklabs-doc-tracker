/**
 * The companies we're collecting documents from.
 *
 * Each deal gets its own page at /deal/<id>, which is the link you send to the
 * company so they can upload their own documents.
 *
 * For now this list lives in code. Week 2 replaces it with real CRUD so deals
 * can be created from the screen.
 */

import type { Market } from "./documents";

export type Deal = {
  /** Used in the URL - keep it short, lowercase, no spaces. */
  id: string;
  companyKo: string;
  companyEn: string;
  market: Market;
  /**
   * Also read the mentor's sample Google Drive folder for this deal, on top of
   * anything uploaded. The folder id comes from GOOGLE_DRIVE_FOLDER_ID so it
   * stays out of the repository.
   */
  readsSampleDriveFolder?: boolean;
};

export const DEALS: Deal[] = [
  {
    id: "zest",
    companyKo: "제스트",
    companyEn: "Zest",
    market: "domestic",
    readsSampleDriveFolder: true,
  },
  {
    id: "demo-overseas",
    companyKo: "해외 샘플 기업",
    companyEn: "Overseas Sample Co.",
    market: "overseas",
  },
];

export function getDeal(id: string): Deal | undefined {
  return DEALS.find((deal) => deal.id === id);
}
