/**
 * The internal 실사 checklist for one deal.
 *
 * Deliberately NOT at /deal/<id>/diligence: /deal/<id> is the link handed to
 * the company, and a page one path segment away from a link you gave out is a
 * page you have half given out. This is analyst-only working notes.
 *
 * That said - a separate path is tidiness, not access control. Anyone who
 * knows the URL can still open it. Real login is a Week 2+ job.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getDeal } from "@/lib/deals-store";
import { collectDealStatus } from "@/lib/deal-status";
import { diligenceSectionsFor } from "@/lib/diligence";
import { readDiligence, type DiligenceRecord } from "@/lib/diligence-store";
import { readComments } from "@/lib/comments-store";
import { readAnalysis } from "@/lib/analysis-store";
import SiteHeader from "@/app/site-header";
import DiligenceChecklist from "./diligence-checklist";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DiligencePage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const deal = await getDeal(dealId);

  if (!deal) notFound();

  const session = await auth();

  const [status, saved, comments, analysis] = await Promise.all([
    collectDealStatus(deal),
    // A checklist that has never been saved is the normal first case, but a
    // storage outage shouldn't hide the checklist itself - start it empty.
    readDiligence(dealId).catch((): DiligenceRecord => ({ dealId, checks: {} })),
    readComments(dealId).catch(() => ({})),
    readAnalysis(dealId).catch(() => ({
      dealId,
      checks: {},
      extraChecks: [],
      extraCheckedAt: null,
    })),
  ]);

  // Only counts what was actually uploaded - a Drive-sourced file can't be
  // sent to the model, so it shouldn't raise expectations of an analysis.
  const uploadedCount = status.documents
    .flatMap((doc) => doc.files)
    .filter((file) => file.source === "upload").length;

  // Which documents each check depends on, and whether they have arrived.
  const documentsById = new Map(status.documents.map((doc) => [doc.id, doc]));

  const sections = diligenceSectionsFor(deal.market).map((section) => ({
    ...section,
    items: section.items.map((item) => ({
      ...item,
      relatedDocuments: item.relatedDocumentIds
        .map((id) => documentsById.get(id))
        .filter((doc) => doc !== undefined)
        .map((doc) => ({
          id: doc.id,
          nameKo: doc.nameKo,
          nameEn: doc.nameEn,
          submitted: doc.submitted,
          optional: doc.optional === true,
        })),
    })),
  }));

  return (
    <>
      <SiteHeader
        dealId={deal.id}
        companyKo={deal.companyKo}
        companyEn={deal.companyEn}
        userEmail={session?.user?.email}
      />
      <DiligenceChecklist
        deal={deal}
        sections={sections}
        initialChecks={saved.checks}
        initialComments={comments}
        initialAnalysis={analysis}
        uploadedCount={uploadedCount}
        viewerEmail={session?.user?.email ?? null}
        missingCount={status.missingCount}
        totalRequired={status.totalRequired}
      />
    </>
  );
}
