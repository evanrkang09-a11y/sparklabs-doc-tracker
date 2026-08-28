/**
 * Creates or deletes the Google Drive folder linked to this company.
 *
 * POST is idempotent: if the deal already has a folder ID saved, the existing
 * URL is returned without creating a second folder. Parent folder is chosen by
 * fund: funds with a known Drive folder use that as the parent; dynamically
 * created funds (not in the hardcoded list) use the shared "new funds" folder;
 * everything else falls back to the generic SparkLabs tracker folder.
 *
 * DELETE permanently removes the folder from Drive and clears the deal's
 * driveFolderId, allowing a new folder to be created in the right place.
 */

import { describe } from "@/lib/errors";
import { getDeal, updateDeal } from "@/lib/deals-store";
import { createDealFolder, deleteDealFolder, getOrCreateSubfolder, reshareFolder, syncExistingFilesToDrive } from "@/lib/drive";
import { getFund, isKnownFundId } from "@/lib/funds";

// Folder where companies on dynamically-created funds (not in the core 15) go.
const NEW_FUND_FOLDER_ID = "10V-CUDtYG7yVsybZylGlJ7mSzQ94LZy4";

export async function POST(
  _request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await context.params;
  const deal = await getDeal(dealId);
  if (!deal) {
    return Response.json({ error: `Unknown company: ${dealId}` }, { status: 404 });
  }

  try {
    // Folder already exists — re-share it so any new exception emails get access,
    // then return the existing URL. This also fixes folders created before
    // per-user permissions were added.
    if (deal.driveFolderId) {
      await reshareFolder(deal.driveFolderId);
      return Response.json({
        folderId: deal.driveFolderId,
        url: `https://drive.google.com/drive/folders/${deal.driveFolderId}`,
      });
    }

    const fund = getFund(deal.fundId);
    // fund?.driveFolderId → fund has a mapped Drive folder (SKF4, CJftr, Firststep)
    // !isKnownFundId      → dynamic fund created via the UI, goes to shared new-funds folder
    // otherwise           → core fund without a Drive mapping, falls back to generic folder
    const parentFolderId = fund?.driveFolderId ?? (!isKnownFundId(deal.fundId) ? NEW_FUND_FOLDER_ID : undefined);
    const folderId = await createDealFolder(deal.companyKo || deal.companyEn, parentFolderId);

    // Create "Initial Documents" and "Execution Documents" subfolders inside the company folder.
    const [initialDocsFolderId, execDocsFolderId] = await Promise.all([
      getOrCreateSubfolder(folderId, "Initial Documents"),
      getOrCreateSubfolder(folderId, "Execution Documents"),
    ]);

    await updateDeal(dealId, { driveFolderId: folderId, initialDocsFolderId, execDocsFolderId });

    // Push any files already uploaded to the website into the correct subfolders.
    // Fire-and-forget — the user gets the folder URL immediately.
    syncExistingFilesToDrive(dealId, folderId, { initial: initialDocsFolderId, exec: execDocsFolderId }).catch(() => {});

    return Response.json({
      folderId,
      url: `https://drive.google.com/drive/folders/${folderId}`,
    });
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await context.params;
  const deal = await getDeal(dealId);
  if (!deal) {
    return Response.json({ error: `Unknown company: ${dealId}` }, { status: 404 });
  }
  if (!deal.driveFolderId) {
    return Response.json({ error: "No Drive folder linked" }, { status: 400 });
  }

  try {
    await deleteDealFolder(deal.driveFolderId);
    await updateDeal(dealId, { driveFolderId: undefined });
    return Response.json({ ok: true });
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}
