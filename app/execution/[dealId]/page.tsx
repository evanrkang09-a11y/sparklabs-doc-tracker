import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getDeal } from "@/lib/deals-store";
import { readExecution } from "@/lib/execution-store";
import { readAgreement } from "@/lib/agreement-store";
import SiteHeader from "@/app/site-header";
import ExecutionTracker from "./execution-tracker";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ExecutionPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const deal = await getDeal(dealId);

  if (!deal) notFound();

  const [session, record, agreement] = await Promise.all([
    auth(),
    readExecution(dealId),
    readAgreement(dealId),
  ]);

  // The three figures the signed contract fixes, carried over so the execution
  // page can cross-check them against the 운용지시서 and 의사록.
  const agreementNumbers = {
    shares: agreement.values.newShares ?? "",
    price: agreement.values.issuePrice ?? "",
    amount: agreement.values.totalAmount ?? "",
  };

  // The investing fund's name, for the email drafts.
  const fundName =
    agreement.values.fundName || agreement.values.investorName || "";

  return (
    <>
      <SiteHeader
        dealId={deal.id}
        companyKo={deal.companyKo}
        companyEn={deal.companyEn}
        userEmail={session?.user?.email}
      />
      <ExecutionTracker
        deal={deal}
        initial={record}
        agreementNumbers={agreementNumbers}
        fundName={fundName}
      />
    </>
  );
}
