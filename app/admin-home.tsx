"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import type { Batch } from "@/lib/deals";
import DealList, { type DealSummary, stageOf } from "./deal-list";
import type { UserEntry, StartupAccount } from "@/lib/admin-store";
import type { DayGroup } from "@/lib/session-log";
import { useLang } from "./lang-provider";
import { T } from "@/lib/i18n";

function downloadCsv(deals: DealSummary[]) {
  const cols = ["Company (KO)", "Company (EN)", "Stage", "Payment Date", "Docs Submitted", "Docs Required", "DD Checked", "DD Total", "Archived"];
  const rows = deals.map((d) => [
    d.companyKo ?? "",
    d.companyEn ?? "",
    stageOf(d),
    d.paymentDate ?? "",
    String((d.totalRequired ?? 0) - (d.missingCount ?? 0)),
    String(d.totalRequired ?? 0),
    String(d.totalChecks - d.uncheckedCount),
    String(d.totalChecks),
    d.archived ? "Yes" : "No",
  ]);
  const csv = [cols, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sparklabs-portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminHome({
  userName,
  deals,
  batches,
  users,
  startups,
  recapDays,
  isSuperior,
}: {
  userName: string;
  deals: DealSummary[];
  batches: Batch[];
  users: UserEntry[];
  startups: StartupAccount[];
  recapDays: DayGroup[];
  isSuperior?: boolean;
}) {
  const { lang, setLang, t } = useLang();
  const activeDeals = deals.filter((d) => !d.archived);
  const activeStartups = startups.filter((s) => s.active);
  const totalDocs = deals.reduce(
    (sum, d) => sum + (d.totalRequired ?? 0),
    0,
  );
  const missingDocs = deals.reduce(
    (sum, d) => sum + (d.missingCount ?? 0),
    0,
  );
  const submittedDocs = totalDocs - missingDocs;

  const statCards = [
    { label: "Portfolio companies", value: activeDeals.length, sub: `${deals.filter((d) => d.archived).length} archived`, color: "indigo" },
    { label: "SparkLabs employees", value: users.length, sub: "with portal access", color: "sky" },
    { label: "Startup accounts", value: startups.length, sub: `${activeStartups.length} active`, color: "emerald" },
    { label: "Documents submitted", value: submittedDocs, sub: `of ${totalDocs} required`, color: "violet" },
  ] as const;

  const colorMap = {
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-900",
    sky: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900",
    violet: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-900",
  };

  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Admin hero banner */}
      <div className="border-b border-amber-200 bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-8 dark:border-amber-900">
        <div className="w-full">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-xl text-white">
                {isSuperior ? "👑" : "⚙"}
              </div>
              <div>
                <p className="text-sm font-medium text-amber-100">
                  {isSuperior ? "Superior Administrator" : "Administrator"}
                </p>
                <h1 className="text-2xl font-bold text-white">
                  Welcome back, {userName.split(" ")[0]}
                  {isSuperior && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-yellow-300/20 px-2 py-0.5 text-sm font-semibold text-yellow-200 ring-1 ring-yellow-300/40">
                      ★ Superior
                    </span>
                  )}
                </h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setLang(lang === "ko" ? "en" : "ko")}
                aria-label="Switch language"
                className="rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/20"
              >
                {t(T.langToggle)}
              </button>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="rounded-lg px-3 py-1.5 text-sm text-amber-100 transition-colors hover:bg-white/10"
              >
                {lang === "ko" ? "로그아웃" : "Sign out"}
              </button>
            </div>
          </div>
          <p className="mt-2 text-sm text-amber-100">
            Full system access · SparkLabs Korea Investment Tracker
          </p>
        </div>
      </div>

      <div className="w-full px-6 py-8 space-y-8">

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className={`rounded-xl border px-4 py-4 ${colorMap[card.color]}`}
            >
              <p className="text-3xl font-bold">{card.value}</p>
              <p className="mt-1 text-sm font-medium">{card.label}</p>
              <p className="mt-0.5 text-xs opacity-70">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Quick actions
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 transition-colors hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-lg text-white">⚙</span>
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-200">Admin Panel</p>
                <p className="text-xs text-amber-700 dark:text-amber-400">Users, startups, permissions</p>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => downloadCsv(deals)}
              className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-left transition-colors hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-lg text-white">↓</span>
              <div>
                <p className="font-semibold text-emerald-900 dark:text-emerald-200">Export Portfolio CSV</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">Download all companies as a spreadsheet</p>
              </div>
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent activity */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Recent activity
            </h2>
            <div className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
              {recapDays.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-neutral-400">No recent activity</p>
              ) : (
                <div className="divide-y divide-neutral-50 dark:divide-neutral-800">
                  {recapDays.map((day) => (
                    <div key={day.date} className="px-4 py-3">
                      <p className="mb-1.5 text-[11px] font-semibold text-neutral-400">
                        {new Date(day.date + "T12:00:00").toLocaleDateString(undefined, {
                          weekday: "short", month: "short", day: "numeric",
                        })}
                      </p>
                      <ul className="space-y-0.5">
                        {day.events.slice(0, 5).map((ev, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                            <span className="mt-0.5 shrink-0 text-neutral-300 dark:text-neutral-600">·</span>
                            {ev.action}
                          </li>
                        ))}
                        {day.events.length > 5 && (
                          <li className="text-xs text-neutral-400">+{day.events.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Startup accounts */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Startup accounts
            </h2>
            <div className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
              {startups.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-neutral-400">No startup accounts yet</p>
              ) : (
                <ul className="divide-y divide-neutral-50 dark:divide-neutral-800">
                  {startups.slice(0, 6).map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">{s.companyName}</p>
                        <p className="truncate text-xs text-neutral-400">{s.email}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        s.active
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                          : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800"
                      }`}>
                        {s.active ? "Active" : "Suspended"}
                      </span>
                    </li>
                  ))}
                  {startups.length > 6 && (
                    <li className="px-4 py-2">
                      <Link href="/admin" className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">
                        +{startups.length - 6} more · Manage in Admin Panel
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </div>
          </section>
        </div>

        {/* Company management — full deal list with Add Company / Add Fund */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Company Management
          </h2>
          <DealList deals={deals} batches={batches} />
        </section>

        {/* Pipeline kanban */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Portfolio pipeline
          </h2>
          <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-x-visible sm:px-0 sm:pb-0">
            {(
              [
                { stage: "collecting", label: "Collecting Docs", color: "amber", dot: "bg-amber-400" },
                { stage: "diligence",  label: "Due Diligence",   color: "sky",   dot: "bg-sky-400" },
                { stage: "ready",      label: "Ready to Close",  color: "emerald", dot: "bg-emerald-400" },
              ] as const
            ).map(({ stage, label, color, dot }) => {
              const col = activeDeals.filter((d) => stageOf(d) === stage);
              const colColors = {
                amber:   "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20",
                sky:     "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/20",
                emerald: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20",
              };
              const labelColors = {
                amber:   "text-amber-700 dark:text-amber-400",
                sky:     "text-sky-700 dark:text-sky-400",
                emerald: "text-emerald-700 dark:text-emerald-400",
              };
              return (
                <div key={stage} className={`min-w-[75vw] shrink-0 rounded-xl border p-3 sm:min-w-0 ${colColors[color]}`}>
                  <div className="mb-2.5 flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${dot}`} />
                    <p className={`text-xs font-semibold ${labelColors[color]}`}>{label}</p>
                    <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold ${labelColors[color]} bg-white/60 dark:bg-white/10`}>
                      {col.length}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {col.length === 0 && (
                      <p className="py-3 text-center text-xs text-neutral-400">None</p>
                    )}
                    {col.map((d) => {
                      const deadline = d.paymentDate
                        ? Math.ceil((new Date(d.paymentDate).getTime() - Date.now()) / 86_400_000)
                        : null;
                      return (
                        <Link
                          key={d.id}
                          href={`/overview/${d.id}`}
                          className="flex items-start justify-between gap-2 rounded-lg bg-white px-3 py-2 shadow-sm transition-shadow hover:shadow-md dark:bg-neutral-900"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">
                              {d.companyKo || d.companyEn}
                            </p>
                            {d.affiliationDate && (
                              <p className="text-[10px] text-neutral-400">
                                Since {d.affiliationDate}
                              </p>
                            )}
                            {deadline !== null && deadline <= 7 && (
                              <p className={`text-[10px] font-medium ${deadline < 0 ? "text-red-500" : deadline <= 3 ? "text-red-400" : "text-amber-500"}`}>
                                {deadline < 0 ? "Payment overdue" : `Payment in ${deadline}d`}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 text-[10px] text-neutral-400">
                            {d.missingCount != null
                              ? `${(d.totalRequired ?? 0) - d.missingCount}/${d.totalRequired} docs`
                              : `${d.totalChecks - d.uncheckedCount}/${d.totalChecks} DD`}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </main>
  );
}
