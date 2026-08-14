"use client";

import Link from "next/link";
import type { DealSummary } from "./deal-list";
import { useLang } from "./lang-provider";

/**
 * Far-left navigation listing every active company with direct links to
 * its three feature areas: document tracking, due diligence, and agreement.
 */
export default function CompanySidebar({ deals }: { deals: DealSummary[] }) {
  const { both } = useLang();
  const active = deals.filter((d) => !d.archived);

  return (
    <nav className="sticky top-16 h-[calc(100vh-4rem)] w-44 shrink-0 overflow-y-auto border-r border-neutral-200 px-3 py-5 dark:border-neutral-800">
      <p className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
        Companies
      </p>

      {active.length === 0 && (
        <p className="px-1 text-xs text-neutral-400">No companies yet</p>
      )}

      <ul className="space-y-4">
        {active.map((deal) => {
          const [name] = both(deal.companyKo, deal.companyEn);
          return (
            <li key={deal.id}>
              <p className="truncate px-1 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                {name}
              </p>
              <ul className="mt-0.5 space-y-0.5">
                <SidebarLink href={`/deal/${deal.id}`} label="Tracking" />
                <SidebarLink href={`/diligence/${deal.id}`} label="DD" />
                <SidebarLink href={`/agreement/${deal.id}`} label="Agreement" />
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SidebarLink({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="block rounded px-2 py-0.5 text-xs text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
      >
        {label}
      </Link>
    </li>
  );
}
