import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getDeal } from "@/lib/deals-store";
import { collectDealStatus } from "@/lib/deal-status";
import { readDiligence } from "@/lib/diligence-store";
import { readAgreement } from "@/lib/agreement-store";
import { readExecution } from "@/lib/execution-store";
import { readConversion } from "@/lib/conversion-store";
import { getTimeline } from "@/lib/deal-timeline";
import { allDiligenceItems } from "@/lib/diligence";
import { getContract } from "@/lib/contracts";
import SiteHeader from "@/app/site-header";
import LogPageView from "@/app/log-page-view";
import OverviewContent, { type OverviewData } from "./overview-content";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const deal = await getDeal(dealId);
  if (!deal) notFound();

  const [session, status, diligence, agreement, execution, conversion, timeline] =
    await Promise.all([
      auth(),
      collectDealStatus(deal).catch(() => null),
      readDiligence(dealId).catch(() => null),
      readAgreement(dealId).catch(() => null),
      readExecution(dealId).catch(() => null),
      readConversion(dealId).catch(() => null),
      getTimeline(dealId).catch(() => ({})),
    ]);

  const ddTotal = allDiligenceItems().length;
  const ddDone = diligence
    ? Object.values(diligence.checks).filter((c) => c.checked).length
    : 0;

  const agreementSpec = getContract(agreement?.contractType ?? "cps").spec;
  const agreementTotal = agreementSpec.allFields.length;
  const agreementMissing = agreement
    ? agreementSpec.missingFields(agreement.values).length
    : agreementTotal;

  const executionConfigured = Boolean(execution?.fundType && execution?.structure);
  const conversionStarted = Boolean(
    conversion &&
      (conversion.leadPaymentDate ||
        conversion.signingDate ||
        Object.keys(conversion.stepChecks).length > 0 ||
        Object.keys(conversion.postChecks).length > 0),
  );

  const data: OverviewData = {
    dealId,
    market: deal.market,
    docsMissing: status?.missingCount ?? null,
    docsTotal: status?.totalRequired ?? null,
    ddDone,
    ddTotal,
    agreementMissing,
    agreementTotal,
    agreementSaved: Boolean(agreement?.updatedAt),
    executionConfigured,
    executionPaymentDate: execution?.paymentDate || "",
    conversionStarted,
  };

  return (
    <>
      <SiteHeader
        dealId={deal.id}
        companyKo={deal.companyKo}
        companyEn={deal.companyEn}
        userEmail={session?.user?.email}
      />
      <LogPageView action={`Viewed overview — ${deal.companyKo || deal.companyEn}`} dealId={deal.id} />
      <OverviewContent
        data={data}
        deal={deal}
        companyKo={deal.companyKo}
        companyEn={deal.companyEn}
        agreementSaved={Boolean(agreement?.updatedAt)}
        initialTimeline={timeline}
      />
    </>
  );
}
