"use client";

import { useEffect, useState } from "react";
import type { UserEntry, StartupAccount, AdminConfig, StartupPermission } from "@/lib/admin-store";
import { PERMISSIONS, PERMISSION_LABELS, type Permission } from "@/lib/permissions";
import type { ActivityEvent } from "@/app/api/admin/activity/route";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STARTUP_PERMS: { key: StartupPermission; label: string }[] = [
  { key: "documents", label: "Documents" },
  { key: "agreement", label: "Agreement" },
];

type Deal = { id: string; companyKo: string; companyEn: string };

export default function AdminPanel({
  users: initialUsers,
  startups: initialStartups,
  adminConfig,
  deals,
  currentAdminEmail,
}: {
  users: UserEntry[];
  startups: StartupAccount[];
  adminConfig: AdminConfig;
  deals: Deal[];
  currentAdminEmail: string;
}) {
  const [tab, setTab] = useState<"team" | "startups" | "activity" | "broadcast" | "templates">("team");
  const [users, setUsers] = useState(initialUsers);
  const [startups, setStartups] = useState(initialStartups);
  const [superiorDraft, setSuperiorDraft] = useState("");
  const [superiorBusy, setSuperiorBusy] = useState(false);
  const [superiorMsg, setSuperiorMsg] = useState<string | null>(null);
  const [newStartup, setNewStartup] = useState({ email: "", dealId: "", companyName: "" });
  const [addBusy, setAddBusy] = useState(false);
  const [savingPerm, setSavingPerm] = useState<string | null>(null);

  // Read receipts: dealId → lastReadAt ISO string
  const [readReceipts, setReadReceipts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (tab !== "startups" || startups.length === 0) return;
    Promise.allSettled(
      startups.map((s) =>
        fetch(`/api/messages/${s.dealId}/read`)
          .then((r) => r.json())
          .then((d: { lastReadAt?: string }) => ({ dealId: s.dealId, lastReadAt: d.lastReadAt ?? null })),
      ),
    ).then((results) => {
      const map: Record<string, string> = {};
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.lastReadAt) {
          map[r.value.dealId] = r.value.lastReadAt;
        }
      }
      setReadReceipts(map);
    });
  }, [tab, startups]);

  // Templates state
  type TemplateStatus = { type: string; custom: boolean; uploadedAt: string | null; size: number | null };
  const [templateStatuses, setTemplateStatuses] = useState<TemplateStatus[]>([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateBusy, setTemplateBusy] = useState<string | null>(null);

  // Activity log state
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Broadcast state
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ sent: number; failed: number } | null>(null);

  // ── Team tab ───────────────────────────────────────────────────────────────

  async function togglePermission(email: string, perm: Permission, has: boolean) {
    const user = users.find((u) => u.email === email);
    if (!user) return;
    const next = has
      ? user.permissions.filter((p) => p !== perm)
      : [...user.permissions, perm];
    setSavingPerm(email + perm);
    try {
      await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, permissions: next }),
      });
      setUsers((prev) =>
        prev.map((u) => (u.email === email ? { ...u, permissions: next } : u)),
      );
    } finally {
      setSavingPerm(null);
    }
  }

  async function transferSuperior() {
    if (!superiorDraft.trim()) return;
    setSuperiorBusy(true);
    setSuperiorMsg(null);
    try {
      const res = await fetch("/api/admin/superior", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: superiorDraft.trim() }),
      });
      if (res.ok) {
        setSuperiorMsg("Superior user updated. Sign out and have the new admin sign in.");
      } else {
        setSuperiorMsg("Failed to update. Check the email and try again.");
      }
    } finally {
      setSuperiorBusy(false);
    }
  }

  // ── Startups tab ───────────────────────────────────────────────────────────

  async function addStartup() {
    if (!newStartup.email || !newStartup.dealId || !newStartup.companyName) return;
    setAddBusy(true);
    try {
      const res = await fetch("/api/admin/startup-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStartup),
      });
      const account = await res.json();
      setStartups((prev) => [...prev, account]);
      setNewStartup({ email: "", dealId: "", companyName: "" });
    } finally {
      setAddBusy(false);
    }
  }

  async function toggleStartupActive(id: string, active: boolean) {
    await fetch("/api/admin/startup-accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active }),
    });
    setStartups((prev) =>
      prev.map((s) => (s.id === id ? { ...s, active } : s)),
    );
  }

  async function toggleStartupPermission(id: string, perm: StartupPermission) {
    const startup = startups.find((s) => s.id === id);
    if (!startup) return;
    const current = startup.startupPermissions ?? [];
    const next = current.includes(perm) ? current.filter((p) => p !== perm) : [...current, perm];
    await fetch("/api/admin/startup-accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, startupPermissions: next }),
    });
    setStartups((prev) =>
      prev.map((s) => (s.id === id ? { ...s, startupPermissions: next } : s)),
    );
  }

  async function removeStartup(id: string) {
    if (!confirm("Remove this startup account? They will no longer be able to sign in.")) return;
    await fetch("/api/admin/startup-accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setStartups((prev) => prev.filter((s) => s.id !== id));
  }

  // ── Templates ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (tab !== "templates") return;
    setTemplateLoading(true);
    fetch("/api/admin/templates")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setTemplateStatuses(data); })
      .catch(() => {})
      .finally(() => setTemplateLoading(false));
  }, [tab]);

  async function uploadTemplate(type: string, file: File) {
    setTemplateBusy(type);
    const form = new FormData();
    form.append("type", type);
    form.append("file", file);
    try {
      await fetch("/api/admin/templates", { method: "POST", body: form });
      const res = await fetch("/api/admin/templates");
      const data = await res.json();
      if (Array.isArray(data)) setTemplateStatuses(data);
    } finally {
      setTemplateBusy(null);
    }
  }

  async function revertTemplate(type: string) {
    if (!confirm(`Revert ${type.toUpperCase()} template to the bundled default?`)) return;
    setTemplateBusy(type);
    try {
      await fetch("/api/admin/templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      setTemplateStatuses((prev) => prev.map((s) => s.type === type ? { ...s, custom: false, uploadedAt: null, size: null } : s));
    } finally {
      setTemplateBusy(null);
    }
  }

  // ── Activity log ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (tab !== "activity") return;
    setActivityLoading(true);
    fetch("/api/admin/activity")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setActivityEvents(data); })
      .catch(() => {})
      .finally(() => setActivityLoading(false));
  }, [tab]);

  // ── Broadcast ──────────────────────────────────────────────────────────────

  async function sendBroadcast() {
    if (!broadcastText.trim()) return;
    setBroadcastBusy(true);
    setBroadcastResult(null);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: broadcastText }),
      });
      const data = (await res.json()) as { sent?: number; failed?: number; error?: string };
      if (res.ok) {
        setBroadcastResult({ sent: data.sent ?? 0, failed: data.failed ?? 0 });
        setBroadcastText("");
      }
    } finally {
      setBroadcastBusy(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">

      {/* Superior user reminder banner */}
      <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
        <p className="font-semibold text-amber-900 dark:text-amber-200">
          ⚠ Superior User Reminder
        </p>
        <p className="mt-0.5 text-amber-800 dark:text-amber-300">
          You are currently the superior (admin) user as <span className="font-mono font-medium">{currentAdminEmail}</span>.
          Before you leave SparkLabs, transfer this role to another team member using the form below — otherwise no one will be able to manage access.
        </p>
      </div>

      <h1 className="mb-6 text-2xl font-bold tracking-tight">Admin Panel</h1>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-neutral-200 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-900">
        {(["team", "startups", "activity", "broadcast", "templates"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-white shadow-sm dark:bg-neutral-800"
                : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
            }`}
          >
            {t === "team" ? "SparkLabs Team"
              : t === "startups" ? "Portfolio Companies"
              : t === "activity" ? "Activity Log"
              : t === "broadcast" ? "Broadcast"
              : "Templates"}
          </button>
        ))}
      </div>

      {/* ── Team tab ──────────────────────────────────────────────────── */}
      {tab === "team" && (
        <div className="space-y-6">

          {/* Permission matrix */}
          <section className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
              <h2 className="font-semibold">Team Permissions</h2>
              <p className="text-xs text-neutral-500">Toggle which sections each team member can access. Changes take effect on their next sign-in.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-xs text-neutral-400 dark:border-neutral-800">
                    <th className="px-4 py-2 text-left font-medium">Member</th>
                    {PERMISSIONS.map((p) => (
                      <th key={p} className="px-2 py-2 text-center font-medium">
                        {PERMISSION_LABELS[p].en}
                      </th>
                    ))}
                    <th className="px-4 py-2 text-left font-medium">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={PERMISSIONS.length + 2} className="px-4 py-6 text-center text-neutral-400">
                        No team members have signed in yet.
                      </td>
                    </tr>
                  )}
                  {users.map((user) => (
                    <tr key={user.email} className="border-b border-neutral-50 last:border-0 dark:border-neutral-800/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-neutral-900 dark:text-white">{user.name}</p>
                        <p className="text-xs text-neutral-400">{user.email}</p>
                      </td>
                      {PERMISSIONS.map((perm) => {
                        const has = user.permissions.includes(perm);
                        const busy = savingPerm === user.email + perm;
                        return (
                          <td key={perm} className="px-2 py-3 text-center">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => togglePermission(user.email, perm, has)}
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                                has
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400"
                                  : "bg-neutral-100 text-neutral-300 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-600"
                              } disabled:opacity-50`}
                              title={has ? `Remove ${PERMISSION_LABELS[perm].en} access` : `Grant ${PERMISSION_LABELS[perm].en} access`}
                            >
                              {busy ? "…" : has ? "✓" : "–"}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-xs text-neutral-400">
                        {user.lastSeen ? user.lastSeen.slice(0, 10) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Transfer superior user */}
          <section className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
            <h2 className="mb-1 font-semibold text-red-900 dark:text-red-200">Transfer Superior User</h2>
            <p className="mb-3 text-xs text-red-700 dark:text-red-300">
              Enter the SparkLabs email of the person who should become the new admin. They must sign in again to activate the new role. You will immediately lose admin access.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={superiorDraft}
                onChange={(e) => setSuperiorDraft(e.target.value)}
                placeholder="colleague@sparklabs.co.kr"
                className="min-w-0 flex-1 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none dark:border-red-800 dark:bg-neutral-950"
              />
              <button
                type="button"
                disabled={superiorBusy || !superiorDraft.trim()}
                onClick={transferSuperior}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {superiorBusy ? "Saving…" : "Transfer"}
              </button>
            </div>
            {superiorMsg && (
              <p className="mt-2 text-sm text-red-800 dark:text-red-200">{superiorMsg}</p>
            )}
          </section>
        </div>
      )}

      {/* ── Startups tab ──────────────────────────────────────────────── */}
      {tab === "startups" && (
        <div className="space-y-6">

          {/* Add new startup */}
          <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="mb-3 font-semibold">Register Portfolio Company</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">Google email</label>
                <input
                  type="email"
                  value={newStartup.email}
                  onChange={(e) => setNewStartup((s) => ({ ...s, email: e.target.value }))}
                  placeholder="founder@startup.com"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">Company</label>
                <select
                  value={newStartup.dealId}
                  onChange={(e) => {
                    const deal = deals.find((d) => d.id === e.target.value);
                    setNewStartup((s) => ({
                      ...s,
                      dealId: e.target.value,
                      companyName: deal ? (deal.companyKo || deal.companyEn) : s.companyName,
                    }));
                  }}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950"
                >
                  <option value="">Select a company…</option>
                  {deals.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.companyKo || d.companyEn}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">Display name</label>
                <input
                  type="text"
                  value={newStartup.companyName}
                  onChange={(e) => setNewStartup((s) => ({ ...s, companyName: e.target.value }))}
                  placeholder="Auto-filled from company"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={addBusy || !newStartup.email || !newStartup.dealId || !newStartup.companyName}
              onClick={addStartup}
              className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {addBusy ? "Adding…" : "Add Account"}
            </button>
          </section>

          {/* Existing startup accounts */}
          <section className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
              <h2 className="font-semibold">Registered Accounts</h2>
              <p className="text-xs text-neutral-500">Toggle active to enable or suspend a company's access without deleting their account.</p>
            </div>
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {startups.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-neutral-400">No startup accounts yet.</p>
              )}
              {startups.map((s) => {
                const deal = deals.find((d) => d.id === s.dealId);
                return (
                  <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-neutral-900 dark:text-white truncate">{s.companyName}</p>
                      <p className="text-xs text-neutral-400 truncate">{s.email}</p>
                      {deal && (
                        <p className="text-xs text-neutral-400">{deal.companyKo || deal.companyEn}</p>
                      )}
                      {readReceipts[s.dealId] ? (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">
                          Seen {timeAgo(readReceipts[s.dealId])}
                        </p>
                      ) : (
                        <p className="text-xs text-neutral-300 dark:text-neutral-600">Never opened messages</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 border border-neutral-200 rounded-lg px-2 py-1 dark:border-neutral-700">
                        <span className="text-[10px] font-medium text-neutral-400 mr-1">Access:</span>
                        {STARTUP_PERMS.map((p) => {
                          const has = (s.startupPermissions ?? []).includes(p.key);
                          return (
                            <button
                              key={p.key}
                              type="button"
                              onClick={() => toggleStartupPermission(s.id, p.key)}
                              className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                                has
                                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400"
                                  : "text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                              }`}
                              title={has ? `Remove ${p.label} access` : `Grant ${p.label} access`}
                            >
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleStartupActive(s.id, !s.active)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          s.active
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400"
                            : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-800"
                        }`}
                      >
                        {s.active ? "Active" : "Suspended"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStartup(s.id)}
                        className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* ── Activity Log tab ──────────────────────────────────────────── */}
      {tab === "activity" && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-neutral-900 dark:text-white">System Activity (last 7 days)</h2>
            <button
              type="button"
              onClick={() => {
                setActivityLoading(true);
                fetch("/api/admin/activity")
                  .then((r) => r.json())
                  .then((data) => { if (Array.isArray(data)) setActivityEvents(data); })
                  .catch(() => {})
                  .finally(() => setActivityLoading(false));
              }}
              className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Refresh
            </button>
          </div>

          {activityLoading ? (
            <p className="py-12 text-center text-sm text-neutral-400">Loading…</p>
          ) : activityEvents.length === 0 ? (
            <p className="py-12 text-center text-sm text-neutral-400">No activity recorded yet.</p>
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
              <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {activityEvents.map((ev, i) => (
                  <li key={i} className="flex items-start gap-3 px-4 py-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400">
                      {(ev.userName || ev.userEmail).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-neutral-900 dark:text-white">{ev.action}</p>
                      <p className="text-xs text-neutral-400">
                        {ev.userName || ev.userEmail}
                        {ev.dealId ? <span className="ml-1 text-neutral-300 dark:text-neutral-600">· {ev.dealId}</span> : null}
                        <span className="ml-2">{new Date(ev.time).toLocaleString()}</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Templates tab ─────────────────────────────────────────────── */}
      {tab === "templates" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
              <h2 className="font-semibold">Contract Templates</h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Upload a prepared .docx to override the bundled template for any contract type. The new file takes effect immediately. Revert to restore the original.
              </p>
            </div>
            {templateLoading ? (
              <p className="px-4 py-8 text-center text-sm text-neutral-400">Loading…</p>
            ) : (
              <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {(templateStatuses.length > 0
                  ? templateStatuses
                  : [
                      { type: "cps", custom: false, uploadedAt: null, size: null },
                      { type: "rcps", custom: false, uploadedAt: null, size: null },
                      { type: "safe", custom: false, uploadedAt: null, size: null },
                    ]
                ).map((s) => (
                  <li key={s.type} className="flex flex-wrap items-center gap-3 px-4 py-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-neutral-900 dark:text-white">
                        {s.type.toUpperCase()} Agreement
                      </p>
                      {s.custom ? (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">
                          Custom template · {s.uploadedAt ? new Date(s.uploadedAt).toLocaleDateString() : "uploaded"}
                          {s.size ? ` · ${(s.size / 1024).toFixed(0)} KB` : ""}
                        </p>
                      ) : (
                        <p className="text-xs text-neutral-400">Using bundled default</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <label className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        templateBusy === s.type
                          ? "bg-neutral-100 text-neutral-400 dark:bg-neutral-800"
                          : "bg-indigo-600 text-white hover:bg-indigo-700"
                      }`}>
                        {templateBusy === s.type ? "Uploading…" : "Upload .docx"}
                        <input
                          type="file"
                          accept=".docx"
                          className="hidden"
                          disabled={templateBusy !== null}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadTemplate(s.type, f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {s.custom && (
                        <button
                          type="button"
                          disabled={templateBusy !== null}
                          onClick={() => revertTemplate(s.type)}
                          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-400"
                        >
                          Revert to default
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ── Broadcast tab ─────────────────────────────────────────────── */}
      {tab === "broadcast" && (
        <div className="space-y-6">
          <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="mb-1 font-semibold">Send Broadcast Message</h2>
            <p className="mb-3 text-xs text-neutral-500">
              This message will be posted to the chat thread of every active startup account. Use for announcements, reminders, or urgent notices.
            </p>
            <textarea
              value={broadcastText}
              onChange={(e) => setBroadcastText(e.target.value)}
              rows={5}
              maxLength={4000}
              placeholder="Type your message here…"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-neutral-400">{broadcastText.length}/4000</span>
              <button
                type="button"
                disabled={broadcastBusy || !broadcastText.trim()}
                onClick={sendBroadcast}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {broadcastBusy ? "Sending…" : "Send to all active startups"}
              </button>
            </div>
            {broadcastResult && (
              <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${
                broadcastResult.failed > 0
                  ? "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                  : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
              }`}>
                Sent to {broadcastResult.sent} startup{broadcastResult.sent !== 1 ? "s" : ""}.
                {broadcastResult.failed > 0 && ` ${broadcastResult.failed} failed.`}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
