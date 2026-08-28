import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getDeal } from "@/lib/deals-store";
import { readAgreement } from "@/lib/agreement-store";
import { CONTRACTS } from "@/lib/contracts";
import SiteHeader from "@/app/site-header";
import StartupNavBar from "@/app/startup-nav-bar";
import LogPageView from "@/app/log-page-view";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AgreementZipPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const deal = await getDeal(dealId);
  if (!deal) notFound();

  const [session, record] = await Promise.all([auth(), readAgreement(dealId)]);
  const isStartup = session?.user?.role === "startup";
  const contractMeta = CONTRACTS[record.contractType];
  const hasSaved = !!record.updatedAt;

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
      <LogPageView
        action={`Viewed contracts zip — ${deal.companyKo || deal.companyEn}`}
        dealId={deal.id}
      />

      <main className="px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight">
            {deal.companyKo || deal.companyEn}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            계약서 ZIP 다운로드 · Contract documents ZIP downloads
          </p>

          <div className="mt-8 space-y-4">
            {hasSaved ? (
              <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-white">
                      {contractMeta.labelKo} / {contractMeta.labelEn}
                    </p>
                    <p className="mt-0.5 text-sm text-neutral-500">
                      {new Date(record.updatedAt!).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                      {record.updatedBy && ` · ${record.updatedBy}`}
                    </p>
                    <p className="mt-1 text-xs text-neutral-400">
                      Filled agreement · .docx inside ZIP
                    </p>
                  </div>
                  <a
                    href={`/api/deals/${deal.id}/agreement/zip`}
                    className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                  >
                    Download ZIP
                  </a>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-neutral-300 px-6 py-12 text-center dark:border-neutral-700">
                <p className="text-sm text-neutral-500">
                  No agreement saved yet.
                </p>
                <p className="mt-1 text-xs text-neutral-400">
                  Fill and save the agreement first, then come back to download the ZIP.
                </p>
                <a
                  href={`/agreement/${deal.id}`}
                  className="mt-4 inline-block rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  Go to Agreement →
                </a>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
