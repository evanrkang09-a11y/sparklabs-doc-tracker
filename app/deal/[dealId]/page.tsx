import { notFound } from "next/navigation";
import { getDeal } from "@/lib/deals";
import SiteHeader from "@/app/site-header";
import DealTracker from "./deal-tracker";

export default async function DealPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const deal = getDeal(dealId);

  if (!deal) {
    notFound();
  }

  return (
    <>
      {/*
        No due-diligence tab here on purpose. This page's URL is what gets sent
        to the company, and a visible tab into the analyst's private notes on
        their own deal is an invitation to click it.
      */}
      <SiteHeader
        dealId={deal.id}
        companyKo={deal.companyKo}
        companyEn={deal.companyEn}
      />
      <DealTracker deal={deal} />
    </>
  );
}
