import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getDeal } from "@/lib/deals-store";
import { readAgreement } from "@/lib/agreement-store";
import { templateLayout } from "@/lib/agreement-docx";
import SiteHeader from "@/app/site-header";
import AgreementEditor from "./agreement-editor";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AgreementPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const deal = await getDeal(dealId);

  if (!deal) notFound();

  const [session, record, layout] = await Promise.all([
    auth(),
    readAgreement(dealId),
    // The template's formatting and text, slots still empty. Parsed on the
    // server because the .docx lives on disk; the browser fills the slots live.
    templateLayout(),
  ]);

  return (
    <>
      <SiteHeader
        dealId={deal.id}
        companyKo={deal.companyKo}
        companyEn={deal.companyEn}
        userEmail={session?.user?.email}
      />
      <AgreementEditor deal={deal} layout={layout} initial={record} />
    </>
  );
}
