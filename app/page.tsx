import { auth } from "@/auth";
import { getRegistry } from "@/lib/deals-store";
import { collectDealStatus } from "@/lib/deal-status";
import { readDiligence } from "@/lib/diligence-store";
import { readExecution } from "@/lib/execution-store";
import { allDiligenceItems } from "@/lib/diligence";
import DealList, { type DealSummary } from "./deal-list";
import CompanySidebar from "./company-sidebar";
import SiteHeader from "./site-header";

export default async function Home() {
  const [session, registry] = await Promise.all([auth(), getRegistry()]);

  const totalChecks = allDiligenceItems().length;

  /**
   * Each company's status needs a Blob listing and a diligence read, so the
   * whole page is 2N round trips. Run them all at once - done one at a time
   * this would get visibly slower with every company added.
   *
   * A company whose status can't be read still gets listed, with its counts
   * unknown, rather than taking the whole page down with it.
   */
  const deals: DealSummary[] = await Promise.all(
    registry.deals.map(async (deal) => {
      const [status, diligence, execution] = await Promise.all([
        collectDealStatus(deal).catch(() => null),
        readDiligence(deal.id).catch(() => null),
        readExecution(deal.id).catch(() => null),
      ]);

      const checkedCount = diligence
        ? Object.values(diligence.checks).filter((check) => check.checked).length
        : 0;

      return {
        id: deal.id,
        companyKo: deal.companyKo,
        companyEn: deal.companyEn,
        market: deal.market,
        dealType: deal.dealType,
        batchId: deal.batchId,
        archived: deal.archived,
        missingCount: status?.missingCount ?? null,
        totalRequired: status?.totalRequired ?? null,
        uncheckedCount: totalChecks - checkedCount,
        totalChecks,
        paymentDate: execution?.paymentDate || null,
      };
    }),
  );

  return (
    <>
      <SiteHeader userEmail={session?.user?.email} />
      <div className="flex">
        <CompanySidebar deals={deals} />
        <main className="min-w-0 flex-1 px-5 py-10 sm:px-8">
          <div className="mx-auto max-w-3xl">
            <DealList deals={deals} batches={registry.batches} />
          </div>
        </main>
      </div>
    </>
  );
}
