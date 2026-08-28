import { auth } from "@/auth";
import { getRegistry } from "@/lib/deals-store";
import { collectDealStatus } from "@/lib/deal-status";
import { readDiligence } from "@/lib/diligence-store";
import { readExecution } from "@/lib/execution-store";
import { allDiligenceItems } from "@/lib/diligence";
import { getRecentActivity, type DayGroup } from "@/lib/session-log";
import { getAllUsers, getAllStartupAccounts, isSuperiorUser } from "@/lib/admin-store";
import DealList, { type DealSummary } from "./deal-list";
import SiteHeader from "./site-header";
import LogPageView from "./log-page-view";
import AdminHome from "./admin-home";

export default async function Home() {
  const [session, registry] = await Promise.all([auth(), getRegistry()]);

  const isAdmin = session?.user?.role === "admin";

  const recentActivity = session?.user?.email
    ? await getRecentActivity(session.user.email, 3).catch(() => [] as DayGroup[])
    : ([] as DayGroup[]);
  const recapDays = recentActivity.filter((d) => d.events.length > 1);

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
        fundId: deal.fundId,
        archived: deal.archived,
        createdAt: deal.createdAt,
        affiliationDate: deal.affiliationDate,
        missingCount: status?.missingCount ?? null,
        totalRequired: status?.totalRequired ?? null,
        uncheckedCount: totalChecks - checkedCount,
        totalChecks,
        paymentDate: execution?.paymentDate || null,
      };
    }),
  );

  if (isAdmin) {
    const adminEmail = session?.user?.email ?? "";
    const [users, startups, superior] = await Promise.all([
      getAllUsers().catch(() => []),
      getAllStartupAccounts().catch(() => []),
      isSuperiorUser(adminEmail).catch(() => false),
    ]);
    return (
      <>
        <LogPageView action="Viewed admin dashboard" />
        <AdminHome
          userName={session?.user?.name ?? adminEmail ?? "Admin"}
          deals={deals}
          batches={registry.batches}
          users={users}
          startups={startups}
          recapDays={recapDays}
          isSuperior={superior}
        />
      </>
    );
  }

  return (
    <>
      <SiteHeader userEmail={session?.user?.email} />
      <LogPageView action="Viewed dashboard" />
      <main className="px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {recapDays.length > 0 && (
            <section className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
              <div className="border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Recent activity
                </p>
              </div>
              <div className="divide-y divide-neutral-50 dark:divide-neutral-800/60">
                {recapDays.map((day) => (
                  <div key={day.date} className="px-4 py-3">
                    <p className="mb-1.5 text-[11px] font-semibold text-neutral-400">
                      {new Date(day.date + "T12:00:00").toLocaleDateString(undefined, {
                        weekday: "short", month: "short", day: "numeric",
                      })}
                    </p>
                    <ul className="space-y-0.5">
                      {day.events.slice(0, 6).map((ev, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                          <span className="mt-0.5 shrink-0 text-neutral-300 dark:text-neutral-600">·</span>
                          {ev.action}
                        </li>
                      ))}
                      {day.events.length > 6 && (
                        <li className="text-xs text-neutral-400">+{day.events.length - 6} more</li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}
          <DealList deals={deals} batches={registry.batches} />
        </div>
      </main>
    </>
  );
}
