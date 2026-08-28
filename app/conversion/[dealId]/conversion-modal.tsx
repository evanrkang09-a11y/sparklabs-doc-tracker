"use client";

import { useEffect, useRef, useState } from "react";
import type { Deal } from "@/lib/deals";
import type { ConversionRecord } from "@/lib/conversion-store";
import ConversionTracker from "./conversion-tracker";

export default function ConversionModal({ deal }: { deal: Pick<Deal, "id" | "companyKo" | "companyEn" | "market" | "dealType" | "batchId" | "fundId" | "archived" | "createdAt"> }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [record, setRecord] = useState<ConversionRecord | null>(null);
  const [loading, setLoading] = useState(false);

  async function open() {
    if (!record) {
      setLoading(true);
      try {
        const res = await fetch(`/api/deals/${deal.id}/conversion`);
        setRecord(await res.json());
      } finally {
        setLoading(false);
      }
    }
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      if (e.target === el) close();
    };
    el.addEventListener("click", handler);
    return () => el.removeEventListener("click", handler);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={loading}
        className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 text-left"
      >
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-neutral-200 dark:bg-neutral-700" />
        <span className="text-sm font-medium">SAFE conversion</span>
        <span className="ml-auto text-[11px] text-neutral-400">{loading ? "Loading…" : "Open ↗"}</span>
      </button>

      <dialog
        ref={dialogRef}
        className="m-0 h-screen w-screen max-h-none max-w-none bg-transparent p-0 backdrop:bg-black/60"
      >
        <div className="flex h-screen w-screen flex-col bg-white dark:bg-neutral-950 overflow-hidden">
          <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-6 py-3 dark:border-neutral-800">
            <p className="text-sm font-semibold">SAFE Conversion — {deal.companyKo || deal.companyEn}</p>
            <button
              type="button"
              onClick={close}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Close ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {record ? (
              <ConversionTracker deal={deal as Deal} initial={record} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-neutral-400">Loading…</div>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
