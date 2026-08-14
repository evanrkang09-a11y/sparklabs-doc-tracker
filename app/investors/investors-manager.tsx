"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { describe } from "@/lib/errors";
import {
  INVESTOR_PROFILE_FIELDS,
  type InvestorProfile,
} from "@/lib/investors";
import { useLang } from "@/app/lang-provider";

/**
 * Add, edit and delete investor profiles — SparkLabs' reusable side of an
 * agreement (fund name, GP, addresses, notice recipient).
 *
 * Each profile is one card. A card expands to a form over the same eleven
 * fields the agreement uses; saving PATCHes the one profile. A blank card at
 * the bottom creates a new one.
 */
export default function InvestorsManager({
  initial,
}: {
  initial: InvestorProfile[];
}) {
  const { lang, pick } = useLang();
  const router = useRouter();
  const ko = lang === "ko";

  const [profiles, setProfiles] = useState(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(url: string, method: string, body?: unknown) {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const parsed = await response.json().catch(() => null);
    if (!response.ok) throw new Error(parsed?.error ?? `${response.status}`);
    return parsed;
  }

  async function saveProfile(
    id: string | null,
    label: string,
    values: Record<string, string>,
  ) {
    setBusy(true);
    setError(null);
    try {
      if (id) {
        await send(`/api/investors/${id}`, "PATCH", { label, values });
      } else {
        await send("/api/investors", "POST", { label, values });
        setCreating(false);
      }
      setOpenId(null);
      // Re-read from the server so the list reflects exactly what was saved.
      const { profiles: fresh } = await send("/api/investors", "GET");
      setProfiles(fresh);
      router.refresh();
    } catch (problem) {
      setError(describe(problem));
    } finally {
      setBusy(false);
    }
  }

  async function remove(profile: InvestorProfile) {
    if (!confirm(`${profile.label}\n\n${ko ? "이 프로필을 삭제할까요?" : "Delete this profile?"}`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await send(`/api/investors/${profile.id}`, "DELETE");
      setProfiles((current) => current.filter((p) => p.id !== profile.id));
      router.refresh();
    } catch (problem) {
      setError(describe(problem));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {ko ? "투자자 프로필" : "Investor profiles"}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {ko
            ? "계약서의 스파크랩 측 정보(조합·업무집행조합원·통지처)를 저장해 두고, 계약서 작성 시 한 번에 채웁니다."
            : "Save SparkLabs' side of the contract (fund, general partner, notices) once and fill it into any agreement in one click."}
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <ul className="space-y-3">
        {profiles.map((profile) => (
          <li
            key={profile.id}
            className="rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => setOpenId(openId === profile.id ? null : profile.id)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-sm font-medium">{profile.label}</p>
                <p className="truncate text-xs text-neutral-500">
                  {profile.values.fundName || profile.values.investorName || "—"}
                </p>
              </button>
              <div className="flex shrink-0 items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setOpenId(openId === profile.id ? null : profile.id)}
                  className="rounded-lg border border-neutral-300 px-2.5 py-1 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  {openId === profile.id ? (ko ? "닫기" : "Close") : ko ? "편집" : "Edit"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(profile)}
                  disabled={busy}
                  className="text-neutral-400 transition-colors hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
                >
                  {ko ? "삭제" : "Delete"}
                </button>
              </div>
            </div>

            {openId === profile.id && (
              <ProfileForm
                key={profile.id}
                profile={profile}
                busy={busy}
                onSave={(label, values) => saveProfile(profile.id, label, values)}
                onCancel={() => setOpenId(null)}
              />
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4">
        {creating ? (
          <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700">
            <ProfileForm
              profile={null}
              busy={busy}
              onSave={(label, values) => saveProfile(null, label, values)}
              onCancel={() => setCreating(false)}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-neutral-800 hover:shadow active:scale-[0.98] dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
          >
            + {ko ? "새 프로필" : "New profile"}
          </button>
        )}
      </div>
    </>
  );

  function ProfileForm({
    profile,
    busy,
    onSave,
    onCancel,
  }: {
    profile: InvestorProfile | null;
    busy: boolean;
    onSave: (label: string, values: Record<string, string>) => void;
    onCancel: () => void;
  }) {
    const [label, setLabel] = useState(profile?.label ?? "");
    const [values, setValues] = useState<Record<string, string>>(
      profile?.values ?? {},
    );

    const input =
      "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950";

    return (
      <div className="border-t border-neutral-200 p-4 dark:border-neutral-800">
        <label className="block text-[11px] font-medium text-neutral-500">
          {ko ? "프로필 이름" : "Profile name"}
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={ko ? "예: 디스커버리펀드8호" : "e.g. Discovery Fund 8"}
            className={input}
          />
        </label>

        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {INVESTOR_PROFILE_FIELDS.map((field) => (
            <label
              key={field.id}
              className="block text-[11px] font-medium text-neutral-500"
            >
              {pick(field.labelKo, field.labelEn)}
              <input
                value={values[field.id] ?? ""}
                onChange={(e) =>
                  setValues((current) => ({ ...current, [field.id]: e.target.value }))
                }
                className={input}
              />
            </label>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => onSave(label, values)}
            disabled={busy || !label.trim()}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? (ko ? "저장 중…" : "Saving…") : ko ? "저장" : "Save"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
          >
            {ko ? "취소" : "Cancel"}
          </button>
        </div>
      </div>
    );
  }
}
