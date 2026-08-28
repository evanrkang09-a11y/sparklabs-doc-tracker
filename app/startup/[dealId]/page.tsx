import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDeal } from "@/lib/deals-store";
import { getThread } from "@/lib/message-store";
import { listUploadedFiles } from "@/lib/storage";
import { readAgreement } from "@/lib/agreement-store";
import { collectDealStatus, type TrackedDocument } from "@/lib/deal-status";
import { readExecution } from "@/lib/execution-store";
import { postPaymentDocs, type ExecutionDoc } from "@/lib/execution";
import StartupPortal from "./startup-portal";

export const metadata: Metadata = {
  title: "SparkLabs Portfolio Portal",
  robots: { index: false, follow: false },
};

export default async function StartupPortalPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const session = await auth();

  // Only startup users may enter. Admin/employee visiting /startup/* redirects.
  if (!session?.user || session.user.role !== "startup") redirect("/");

  const { dealId } = await params;

  // Startup can only see their own deal.
  if (session.user.dealId !== dealId) redirect(`/startup/${session.user.dealId ?? ""}`);

  const deal = await getDeal(dealId);
  if (!deal) notFound();

  const [messages, allFiles, agreement, docStatus, exec] = await Promise.all([
    getThread(dealId),
    listUploadedFiles(dealId),
    readAgreement(dealId),
    collectDealStatus(deal).catch(() => null),
    readExecution(dealId),
  ]);

  const trackedDocs: TrackedDocument[] = docStatus?.documents ?? [];

  // Split blob files: regular uploads vs execution/startup uploads
  const EXEC_STARTUP_PREFIX = "execution/startup/";
  const files = allFiles
    .filter((f) => !f.filename.startsWith("execution/"))
    .map((f) => ({ filename: f.filename, pathname: f.pathname, size: f.size, uploadedAt: f.uploadedAt }));

  const initialExecFiles = allFiles
    .filter((f) => f.filename.startsWith(EXEC_STARTUP_PREFIX))
    .map((f) => ({
      filename: f.filename.slice(EXEC_STARTUP_PREFIX.length),
      pathname: f.pathname,
      size: f.size,
      uploadedAt: f.uploadedAt,
    }));

  const execDocs: ExecutionDoc[] =
    exec.structure ? postPaymentDocs(deal.market, exec.structure) : [];

  return (
    <StartupPortal
      deal={{ id: deal.id, companyKo: deal.companyKo, companyEn: deal.companyEn }}
      messages={messages}
      files={files}
      agreementType={agreement.contractType}
      hasAgreement={Object.keys(agreement.values).length > 0}
      userEmail={session.user.email ?? ""}
      userName={session.user.name ?? ""}
      startupPermissions={session.user.startupPermissions ?? []}
      trackedDocs={trackedDocs}
      missingCount={docStatus?.missingCount ?? 0}
      totalRequired={docStatus?.totalRequired ?? 0}
      execDocs={execDocs}
      initialExecFiles={initialExecFiles}
    />
  );
}
