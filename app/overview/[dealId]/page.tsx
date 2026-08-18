import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getDeal } from "@/lib/deals-store";
import { collectDealStatus } from "@/lib/deal-status";
import { readDiligence } from "@/lib/diligence-store";
import { readAgreement } from "@/lib/agreement-store";
import { readExecution } from "@/lib/execution-store";
import { readConversion } from "@/lib/conversion-store";
import { allDiligenceItems } from "@/lib/diligence";
import { getContract } from "@/lib/contracts";
import SiteHeader from "@/app/site-header";
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

  const [session, status, diligence, agreement, execution, conversion] =
    await Promise.all([
      auth(),
      collectDealStatus(deal).catch(() => null),
      readDiligence(dealId).catch(() => null),
      readAgreement(dealId).catch(() => null),
      readExecution(dealId).catch(() => null),
      readConversion(dealId).catch(() => null),
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
      <OverviewContent
        data={data}
        companyKo={deal.companyKo}
        companyEn={deal.companyEn}
      />
    </>
  );
}
