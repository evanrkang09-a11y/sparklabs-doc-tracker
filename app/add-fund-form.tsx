"use client";

import { useState } from "react";
import type { Fund } from "@/lib/funds";
import { describe } from "@/lib/errors";
import { useLang } from "./lang-provider";

const CATEGORIES = ["SparkLabs Ventures", "SparkLabs Partners", "SparkLabs", "Other"];
const CURRENCIES = ["KRW", "USD"];

export default function AddFundForm({ onDone }: { onDone: (fund: Fund) => void }) {
  const { lang } = useLang();
  const ko = lang === "ko";

  const [name, setName] = useState("");
  const [category, setCategory] = useState("SparkLabs");
  const [currency, setCurrency] = useState("KRW");
  const [createDrive, setCreateDrive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, currency, createDriveFolder: createDrive }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? `${res.status}`);
      onDone(data as Fund);
    } catch (problem) {
      setError(describe(problem));
    } finally {
      setBusy(false);
    }
  }

  const field =
    "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950";
  const label = "block text-xs font-medium text-neutral-500";

  return (
    <form
      onSubmit={submit}
      className="mb-8 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
    >
      <h2 className="mb-4 text-sm font-semibold">{ko ? "새 펀드 추가" : "Add new fund"}</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={label} htmlFor="fundName">
            {ko ? "펀드 이름" : "Fund name"}
          </label>
          <input
            id="fundName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="SKF5"
            required
            className={field}
          />
        </div>

        <div>
          <label className={label} htmlFor="fundCategory">
            {ko ? "카테고리" : "Category"}
          </label>
          <select
            id="fundCategory"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={field}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={label} htmlFor="fundCurrency">
            {ko ? "통화" : "Currency"}
          </label>
          <select
            id="fundCurrency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className={field}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300 sm:col-span-2">
          <input
            type="checkbox"
            checked={createDrive}
            onChange={(e) => setCreateDrive(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300"
          />
          {ko ? "구글 드라이브 폴더 생성" : "Create Google Drive folder for this fund"}
        </label>
      </div>

      {error && (
        <p className="mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-4">
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
        >
          {busy ? (ko ? "추가 중…" : "Adding…") : (ko ? "펀드 추가" : "Add fund")}
        </button>
      </div>
    </form>
  );
}
