"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEAL_TYPES, type Batch, type DealType } from "@/lib/deals";
import { FUNDS } from "@/lib/funds";
import type { Market } from "@/lib/documents";
import { T } from "@/lib/i18n";
import { describe } from "@/lib/errors";
import { useLang } from "./lang-provider";

export default function AddCompanyForm({
  batches,
  onDone,
}: {
  batches: Batch[];
  onDone: () => void;
}) {
  const { lang, t } = useLang();
  const router = useRouter();

  const [companyKo, setCompanyKo] = useState("");
  const [companyEn, setCompanyEn] = useState("");
  const [market, setMarket] = useState<Market>("domestic");
  const [dealType, setDealType] = useState<DealType>("general");
  const [batchId, setBatchId] = useState("");
  const [fundId, setFundId] = useState("");

  const [newBatchName, setNewBatchName] = useState("");
  const [addingBatch, setAddingBatch] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(body: unknown) {
    const response = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const parsed = await response.json().catch(() => null);
    if (!response.ok) throw new Error(parsed?.error ?? `${response.status}`);
    return parsed;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await post({
        companyKo,
        companyEn,
        market,
        dealType,
        batchId: batchId || null,
        fundId: fundId || null,
      });
      onDone();
    } catch (problem) {
      setError(describe(problem));
    } finally {
      setBusy(false);
    }
  }

  async function createBatch() {
    if (!newBatchName.trim()) return;
    setBusy(true);
    setError(null);

    try {
      const batch = await post({ kind: "batch", name: newBatchName });
      setNewBatchName("");
      setAddingBatch(false);
      // Select the batch just created, which is almost always what was wanted.
      setBatchId(batch.id);
      router.refresh();
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="companyKo">
            {t(T.companyNameKo)}
          </label>
          <input
            id="companyKo"
            value={companyKo}
            onChange={(event) => setCompanyKo(event.target.value)}
            className={field}
            placeholder="제스트"
          />
        </div>

        <div>
          <label className={label} htmlFor="companyEn">
            {t(T.companyNameEn)}
          </label>
          <input
            id="companyEn"
            value={companyEn}
            onChange={(event) => setCompanyEn(event.target.value)}
            className={field}
            placeholder="Zest"
          />
        </div>

        <div>
          <label className={label} htmlFor="market">
            {t(T.marketLabel)}
          </label>
          <select
            id="market"
            value={market}
            onChange={(event) => setMarket(event.target.value as Market)}
            className={field}
          >
            <option value="domestic">{t(T.domesticCompany)}</option>
            <option value="overseas">{t(T.overseasCompany)}</option>
          </select>
        </div>

        <div>
          <label className={label} htmlFor="dealType">
            {t(T.dealTypeLabel)}
          </label>
          <select
            id="dealType"
            value={dealType}
            onChange={(event) => setDealType(event.target.value as DealType)}
            className={field}
          >
            {DEAL_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {lang === "ko" ? type.ko : type.en}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={label} htmlFor="fund">
            {lang === "ko" ? "펀드" : "Fund"}
          </label>
          <select
            id="fund"
            value={fundId}
            onChange={(event) => setFundId(event.target.value)}
            className={field}
          >
            <option value="">{lang === "ko" ? "미배정" : "Unassigned"}</option>
            {FUNDS.map((fund) => (
              <option key={fund.id} value={fund.id}>
                {fund.name} · {fund.category}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={label} htmlFor="batch">
            {t(T.batchLabel)}
          </label>

          {addingBatch ? (
            <div className="mt-1 flex gap-2">
              <input
                value={newBatchName}
                onChange={(event) => setNewBatchName(event.target.value)}
                className={field.replace("mt-1 ", "")}
                placeholder={t(T.batchName)}
                autoFocus
              />
              <button
                type="button"
                onClick={createBatch}
                disabled={busy || !newBatchName.trim()}
                className="shrink-0 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
              >
                {t(T.save)}
              </button>
              <button
                type="button"
                onClick={() => setAddingBatch(false)}
                className="shrink-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700"
              >
                {t(T.cancel)}
              </button>
            </div>
          ) : (
            <div className="mt-1 flex gap-2">
              <select
                id="batch"
                value={batchId}
                onChange={(event) => setBatchId(event.target.value)}
                className={field.replace("mt-1 ", "")}
              >
                <option value="">{t(T.noBatch)}</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setAddingBatch(true)}
                className="shrink-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm whitespace-nowrap transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                + {t(T.addBatch)}
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-5 flex gap-2">
        <button
          type="submit"
          disabled={busy || (!companyKo.trim() && !companyEn.trim())}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-neutral-800 hover:shadow active:scale-[0.98] disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
        >
          {busy ? t(T.saving2) : t(T.addCompany)}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
        >
          {t(T.cancel)}
        </button>
      </div>
    </form>
  );
}
