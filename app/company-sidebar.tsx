"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DealSummary } from "./deal-list";
import { FUNDS } from "@/lib/funds";
import { useLang } from "./lang-provider";

/**
 * Far-left navigation, grouped by fund.
 *
 * Each fund is a row; hovering it reveals a scrollable list of that fund's
 * companies. Funds with no companies are hidden, and companies with no fund
 * fall under an "Unassigned" group at the end, so the sidebar only shows what's
 * actually in use.
 */
export default function CompanySidebar({ deals }: { deals: DealSummary[] }) {
  const { lang, both } = useLang();
  const ko = lang === "ko";
  const pathname = usePathname();

  const active = deals.filter((d) => !d.archived);

  // Group active companies by fund id, preserving the fund list's order and
  // appending an "unassigned" bucket for anything without a fund.
  const groups: { key: string; label: string; sub?: string; deals: DealSummary[] }[] = [];

  for (const fund of FUNDS) {
    const inFund = active.filter((d) => d.fundId === fund.id);
    if (inFund.length > 0) {
      groups.push({ key: fund.id, label: fund.name, sub: fund.category, deals: inFund });
    }
  }

  const unassigned = active.filter((d) => !d.fundId);
  if (unassigned.length > 0) {
    groups.push({
      key: "__unassigned__",
      label: ko ? "미배정" : "Unassigned",
      deals: unassigned,
    });
  }

  return (
    <nav className="sticky top-[3.75rem] hidden h-[calc(100vh-3.75rem)] w-52 shrink-0 overflow-y-auto border-r border-neutral-200 bg-white/40 px-3 py-5 lg:block dark:border-neutral-800 dark:bg-neutral-950/40">
      <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
        {ko ? "펀드" : "Funds"}
      </p>

      {groups.length === 0 && (
        <p className="px-2 text-xs text-neutral-400">
          {ko ? "회사가 없습니다" : "No companies yet"}
        </p>
      )}

      <ul className="space-y-0.5">
        {groups.map((group) => (
          <li key={group.key} className="group/fund">
            {/* Fund header row */}
            <div className="flex cursor-default items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors group-hover/fund:bg-neutral-100 dark:group-hover/fund:bg-neutral-800/60">
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-neutral-700 dark:text-neutral-200">
                  {group.label}
                </span>
                {group.sub && (
                  <span className="block truncate text-[10px] text-neutral-400">
                    {group.sub}
                  </span>
                )}
              </span>
              <span className="shrink-0 rounded-full bg-neutral-200 px-1.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-700 dark:text-neutral-300">
                {group.deals.length}
              </span>
            </div>

            {/* Companies — revealed on hover, scrollable when long */}
            <ul className="mb-1 hidden max-h-56 overflow-y-auto pl-2 group-hover/fund:block">
              {group.deals.map((deal) => {
                const [name] = both(deal.companyKo, deal.companyEn);
                const settled =
                  deal.missingCount === 0 && deal.uncheckedCount === 0;
                const href = `/overview/${deal.id}`;
                const isActive = pathname === href;
                return (
                  <li key={deal.id}>
                    <Link
                      href={href}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors ${
                        isActive
                          ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                          : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          settled ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                      />
                      <span className="truncate">{name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
