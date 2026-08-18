import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getDeal } from "@/lib/deals-store";
import { readEnv } from "@/lib/env";
import SiteHeader from "@/app/site-header";
import DealTracker from "./deal-tracker";

export default async function DealPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const deal = await getDeal(dealId);

  if (!deal) {
    notFound();
  }

  const session = await auth();

  // Link straight to the shared Drive folder where the real files are gathered,
  // when one is configured. Read-only for the app; the link just opens it.
  const folderId = readEnv("GOOGLE_DRIVE_FOLDER_ID");
  const driveUrl = folderId ? `https://drive.google.com/drive/folders/${folderId}` : null;

  return (
    <>
      <SiteHeader
        dealId={deal.id}
        companyKo={deal.companyKo}
        companyEn={deal.companyEn}
        userEmail={session?.user?.email}
      />
      <DealTracker deal={deal} driveUrl={driveUrl} />
    </>
  );
}
