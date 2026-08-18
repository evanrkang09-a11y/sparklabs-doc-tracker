"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FUNDS } from "@/lib/funds";
import { useLang } from "./lang-provider";

/**
 * The app-wide left navigation, present on every page (not just home) so you
 * can jump between a company's pages while working without losing your place.
 *
 * Grouped by fund. Each company expands to its feature pages — 서류수집,
 * 서류실사, 계약서 작성 — and the company whose page you're on is expanded
 * automatically. Fetches the company list once on the client.
 */

type SidebarDeal = {
  id: string;
  companyKo: string;
  companyEn: string;
  fundId: string | null;
  archived: boolean;
};

const DEAL_SECTIONS = ["overview", "deal", "diligence", "agreement", "execution", "conversion"];

export default function AppSidebar() {
  const { lang, both } = useLang();
  const ko = lang === "ko";
  const pathname = usePathname();

  const [deals, setDeals] = useState<SidebarDeal[]>([]);
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    fetch("/api/companies")
      .then((r) => r.json())
      .then((d) => {
        if (alive) setDeals(Array.isArray(d?.deals) ? d.deals : []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const segments = pathname.split("/").filter(Boolean);
  const activeDealId =
    segments.length >= 2 && DEAL_SECTIONS.includes(segments[0])
      ? decodeURIComponent(segments[1])
      : null;

  const active = deals.filter((d) => !d.archived);

  const groups: { key: string; label: string; deals: SidebarDeal[] }[] = [];
  for (const fund of FUNDS) {
    const inFund = active.filter((d) => d.fundId === fund.id);
    if (inFund.length > 0) groups.push({ key: fund.id, label: fund.name, deals: inFund });
  }
  const unassigned = active.filter((d) => !d.fundId);
  if (unassigned.length > 0) {
    groups.push({ key: "__unassigned__", label: ko ? "미배정" : "Unassigned", deals: unassigned });
  }

  const banners = (id: string) => [
    { href: `/deal/${id}`, label: ko ? "서류 수집" : "Documents" },
    { href: `/diligence/${id}`, label: ko ? "서류 실사" : "Diligence" },
    { href: `/agreement/${id}`, label: ko ? "계약서 작성" : "Agreement" },
  ];

  return (
    <nav className="fixed top-0 left-0 z-30 hidden h-screen w-56 overflow-y-auto border-r border-neutral-200 bg-white lg:block dark:border-neutral-800 dark:bg-neutral-950 print:hidden">
      <Link
        href="/"
        className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3.5 dark:border-neutral-800"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
          S
        </span>
        <span className="text-sm font-semibold">SparkLabs</span>
      </Link>

      <div className="px-3 py-4">
        <p className="mb-2 px-2 text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
          {ko ? "펀드 · 기업" : "Funds · Companies"}
        </p>

        {active.length === 0 && (
          <p className="px-2 text-xs text-neutral-400">
            {ko ? "회사가 없습니다" : "No companies yet"}
          </p>
        )}

        <ul className="space-y-3">
          {groups.map((group) => (
            <li key={group.key}>
              <p className="mb-1 px-2 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.deals.map((deal) => {
                  const [name] = both(deal.companyKo, deal.companyEn);
                  const open = manualOpen[deal.id] ?? deal.id === activeDealId;
                  return (
                    <li key={deal.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setManualOpen((prev) => ({ ...prev, [deal.id]: !open }))
                        }
                        className={`flex w-full items-center justify-between gap-1 rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors ${
                          deal.id === activeDealId
                            ? "text-indigo-700 dark:text-indigo-300"
                            : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800/60"
                        }`}
                      >
                        <span className="truncate">{name}</span>
                        <span className="shrink-0 text-neutral-400">{open ? "▾" : "▸"}</span>
                      </button>

                      {open && (
                        <ul className="mt-0.5 mb-1 ml-2 border-l border-neutral-200 pl-2 dark:border-neutral-800">
                          {banners(deal.id).map((b) => {
                            const isActive = pathname === b.href;
                            return (
                              <li key={b.href}>
                                <Link
                                  href={b.href}
                                  aria-current={isActive ? "page" : undefined}
                                  className={`block rounded-md px-2 py-1 text-xs transition-colors ${
                                    isActive
                                      ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                                      : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                                  }`}
                                >
                                  {b.label}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
