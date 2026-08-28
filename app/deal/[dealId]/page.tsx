import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getDeal } from "@/lib/deals-store";
import SiteHeader from "@/app/site-header";
import LogPageView from "@/app/log-page-view";
import StartupNavBar from "@/app/startup-nav-bar";
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

  const initialDriveUrl = deal.driveFolderId
    ? `https://drive.google.com/drive/folders/${deal.driveFolderId}`
    : null;

  const isStartup = session?.user?.role === "startup";

  return (
    <>
      {isStartup ? (
        <StartupNavBar dealId={deal.id} />
      ) : (
        <SiteHeader
          dealId={deal.id}
          companyKo={deal.companyKo}
          companyEn={deal.companyEn}
          userEmail={session?.user?.email}
        />
      )}
      <LogPageView action={`Viewed documents — ${deal.companyKo || deal.companyEn}`} dealId={deal.id} />
      <DealTracker deal={deal} initialDriveUrl={initialDriveUrl} />
    </>
  );
}
