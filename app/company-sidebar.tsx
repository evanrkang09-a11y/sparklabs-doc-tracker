"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DealSummary } from "./deal-list";
import { useLang } from "./lang-provider";

/**
 * Far-left navigation listing every active company with direct links to
 * its feature areas: document tracking, due diligence, agreement, execution.
 */
export default function CompanySidebar({ deals }: { deals: DealSummary[] }) {
  const { both } = useLang();
  const pathname = usePathname();
  const active = deals.filter((d) => !d.archived);

  return (
    <nav className="sticky top-[3.75rem] hidden h-[calc(100vh-3.75rem)] w-48 shrink-0 overflow-y-auto border-r border-neutral-200 bg-white/40 px-3 py-5 lg:block dark:border-neutral-800 dark:bg-neutral-950/40">
      <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
        Companies
      </p>

      {active.length === 0 && (
        <p className="px-2 text-xs text-neutral-400">No companies yet</p>
      )}

      <ul className="space-y-5">
        {active.map((deal) => {
          const [name] = both(deal.companyKo, deal.companyEn);
          const settled = deal.missingCount === 0 && deal.uncheckedCount === 0;
          return (
            <li key={deal.id}>
              <Link
                href={`/overview/${deal.id}`}
                className="flex items-center gap-1.5 px-2 text-xs font-semibold text-neutral-700 transition-colors hover:text-indigo-600 dark:text-neutral-300 dark:hover:text-indigo-400"
              >
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    settled ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
                <span className="truncate">{name}</span>
              </Link>
              <ul className="mt-1 space-y-0.5">
                <SidebarLink href={`/deal/${deal.id}`} label="Tracking" pathname={pathname} />
                <SidebarLink href={`/diligence/${deal.id}`} label="DD" pathname={pathname} />
                <SidebarLink href={`/agreement/${deal.id}`} label="Agreement" pathname={pathname} />
                <SidebarLink href={`/execution/${deal.id}`} label="Execution" pathname={pathname} />
                <SidebarLink href={`/conversion/${deal.id}`} label="Conversion" pathname={pathname} />
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SidebarLink({
  href,
  label,
  pathname,
}: {
  href: string;
  label: string;
  pathname: string;
}) {
  const active = pathname === href;
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`block rounded-md px-2 py-1 text-xs transition-colors ${
          active
            ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
            : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        }`}
      >
        {label}
      </Link>
    </li>
  );
}
