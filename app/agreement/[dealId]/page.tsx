import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getDeal } from "@/lib/deals-store";
import { readAgreement } from "@/lib/agreement-store";
import { templateLayout } from "@/lib/agreement-docx";
import { CONTRACT_ORDER, CONTRACTS, type ContractType } from "@/lib/contracts";
import type { DocxLayout } from "@/lib/docx-layout";
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

  const [session, record] = await Promise.all([auth(), readAgreement(dealId)]);

  // Layouts for every ready contract type, so switching type re-renders the
  // preview without another round trip. Parsed on the server (the .docx lives
  // on disk); the browser fills the slots live.
  const readyTypes = CONTRACT_ORDER.filter((type) => CONTRACTS[type].ready);
  const layoutEntries = await Promise.all(
    readyTypes.map(async (type) => [type, await templateLayout(type)] as const),
  );
  const layouts = Object.fromEntries(layoutEntries) as Record<ContractType, DocxLayout>;

  return (
    <>
      <SiteHeader
        dealId={deal.id}
        companyKo={deal.companyKo}
        companyEn={deal.companyEn}
        userEmail={session?.user?.email}
      />
      <AgreementEditor deal={deal} layouts={layouts} initial={record} />
    </>
  );
}
