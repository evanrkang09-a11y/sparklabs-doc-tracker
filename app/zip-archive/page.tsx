import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { listDeals } from "@/lib/deals-store";
import { readAgreement } from "@/lib/agreement-store";
import { CONTRACTS } from "@/lib/contracts";
import LogPageView from "@/app/log-page-view";

export const metadata: Metadata = {
  title: "Contract ZIPs · SparkLabs Korea",
  robots: { index: false, follow: false },
};

export default async function ZipArchivePage() {
  const [session, deals] = await Promise.all([auth(), listDeals()]);

  if (!session?.user || session.user.role === "startup") {
    return (
      <main className="w-full px-6 py-8">
        <p className="text-sm text-neutral-500">Access denied.</p>
      </main>
    );
  }

  const active = deals.filter((d) => !d.archived);

  const entries = await Promise.all(
    active.map(async (deal) => {
      const agreement = await readAgreement(deal.id).catch(() => null);
      const hasSaved = Boolean(agreement?.updatedAt);
      const contractMeta = hasSaved ? CONTRACTS[agreement!.contractType] : null;
      const savedDate = agreement?.updatedAt
        ? new Date(agreement.updatedAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : null;
      return { deal, hasSaved, contractMeta, savedDate };
    }),
  );

  const ready = entries.filter((e) => e.hasSaved);
  const pending = entries.filter((e) => !e.hasSaved);

  return (
    <>
      <LogPageView action="Viewed ZIP archive" />
      <main className="w-full px-6 py-8">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">SparkLabs Korea</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            📦 계약서 ZIP 모음 · Contract ZIPs
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Download contract ZIP files for all portfolio companies
          </p>
        </header>

        {ready.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Ready to download ({ready.length})
            </h2>
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
              <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {ready.map(({ deal, contractMeta, savedDate }) => (
                  <li key={deal.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="font-medium text-neutral-900 dark:text-white">
                        {deal.companyKo || deal.companyEn}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {deal.companyEn && deal.companyKo ? `${deal.companyEn} · ` : ""}
                        {contractMeta ? `${contractMeta.labelKo} / ${contractMeta.labelEn}` : ""}
                        {savedDate ? ` · ${savedDate}` : ""}
                        {deal.affiliationDate ? ` · Affiliated ${deal.affiliationDate}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={`/overview/${deal.id}`}
                        className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                      >
                        Overview →
                      </Link>
                      <a
                        href={`/api/deals/${deal.id}/agreement/zip`}
                        className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                      >
                        ↓ ZIP
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {pending.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Agreement not saved yet ({pending.length})
            </h2>
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
              <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {pending.map(({ deal }) => (
                  <li key={deal.id} className="flex items-center justify-between gap-4 px-5 py-3">
                    <p className="text-sm text-neutral-500">
                      {deal.companyKo || deal.companyEn}
                      {deal.companyEn && deal.companyKo ? ` · ${deal.companyEn}` : ""}
                    </p>
                    <Link
                      href={`/agreement/${deal.id}`}
                      className="shrink-0 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      Go to agreement →
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {entries.length === 0 && (
          <div className="rounded-xl border border-dashed border-neutral-300 px-6 py-12 text-center dark:border-neutral-700">
            <p className="text-sm text-neutral-500">No companies yet.</p>
          </div>
        )}
      </main>
    </>
  );
}
