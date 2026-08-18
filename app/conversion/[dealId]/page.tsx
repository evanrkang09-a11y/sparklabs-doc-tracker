import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getDeal } from "@/lib/deals-store";
import { readConversion } from "@/lib/conversion-store";
import SiteHeader from "@/app/site-header";
import ConversionTracker from "./conversion-tracker";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ConversionPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const deal = await getDeal(dealId);

  if (!deal) notFound();

  const [session, record] = await Promise.all([auth(), readConversion(dealId)]);

  return (
    <>
      <SiteHeader
        dealId={deal.id}
        companyKo={deal.companyKo}
        companyEn={deal.companyEn}
        userEmail={session?.user?.email}
      />
      <ConversionTracker deal={deal} initial={record} />
    </>
  );
}
