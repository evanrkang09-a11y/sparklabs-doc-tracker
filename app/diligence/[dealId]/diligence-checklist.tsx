"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Deal } from "@/lib/deals";
import type { CheckState } from "@/lib/diligence-store";
import { T } from "@/lib/i18n";
import { useLang } from "@/app/lang-provider";

type RelatedDocument = {
  id: string;
  nameKo: string;
  nameEn: string;
  submitted: boolean;
  optional: boolean;
};

type Item = {
  id: string;
  titleKo: string;
  titleEn: string;
  sourceRef: string;
  detailsKo: string[];
  detailsEn: string[];
  tipsKo?: string[];
  tipsEn?: string[];
  relatedDocuments: RelatedDocument[];
};

type Section = {
  id: string;
  titleKo: string;
  titleEn: string;
  blurbKo: string;
  blurbEn: string;
  items: Item[];
};

/** Long enough not to save on every keystroke, short enough not to lose a thought. */
const NOTE_SAVE_DELAY_MS = 800;

const EMPTY: CheckState = { checked: false, note: "", updatedAt: "" };

export default function DiligenceChecklist({
  deal,
  sections,
  initialChecks,
  missingCount,
  totalRequired,
}: {
  deal: Deal;
  sections: Section[];
  initialChecks: Record<string, CheckState>;
  missingCount: number;
  totalRequired: number;
}) {
  const { lang, t } = useLang();
  const ko = lang === "ko";

  const [checks, setChecks] = useState(initialChecks);
  const [saving, setSaving] = useState(0);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // One pending timer per item, so typing in one memo never delays another.
  const noteTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timers = noteTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  async function save(checkId: string, patch: { checked?: boolean; note?: string }) {
    setSaving((count) => count + 1);
    setSaveError(null);

    try {
      const response = await fetch(`/api/deals/${deal.id}/diligence`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkId, ...patch }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `${response.status}`);
      }

      setSavedAt(new Date().toLocaleTimeString());
    } catch (problem) {
      setSaveError(problem instanceof Error ? problem.message : "Unknown error");
    } finally {
      setSaving((count) => count - 1);
    }
  }

  function toggle(item: Item, checked: boolean) {
    setChecks((current) => ({
      ...current,
      [item.id]: { ...(current[item.id] ?? EMPTY), checked },
    }));
    save(item.id, { checked });
  }

  function editNote(item: Item, note: string) {
    setChecks((current) => ({
      ...current,
      [item.id]: { ...(current[item.id] ?? EMPTY), note },
    }));

    const pending = noteTimers.current.get(item.id);
    if (pending) clearTimeout(pending);

    noteTimers.current.set(
      item.id,
      setTimeout(() => {
        noteTimers.current.delete(item.id);
        save(item.id, { note });
      }, NOTE_SAVE_DELAY_MS),
    );
  }

  const allItems = sections.flatMap((section) => section.items);
  const doneCount = allItems.filter((item) => checks[item.id]?.checked).length;
  const complete = doneCount === allItems.length;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-8">
        <p className="text-sm font-medium tracking-wide text-neutral-500 uppercase">
          {t(T.internalOnly)}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {ko ? deal.companyKo : deal.companyEn} {t(T.diligenceTitle)}
        </h1>
      </header>

      <p className="mb-6 rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
        {t(T.internalBanner)}
      </p>

      {/* Progress */}
      <section
        className={`rounded-xl border p-6 ${
          complete
            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
            : "border-neutral-300 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
        }`}
      >
        <p className="text-2xl font-semibold">
          {complete
            ? t(T.allChecked)
            : ko
              ? `${allItems.length}개 중 ${doneCount}개 확인`
              : `${doneCount} of ${allItems.length} checked`}
        </p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div
            className={`h-full rounded-full transition-all ${
              complete ? "bg-emerald-600" : "bg-neutral-900 dark:bg-white"
            }`}
            style={{ width: `${(doneCount / allItems.length) * 100}%` }}
          />
        </div>

        {missingCount > 0 && (
          <p className="mt-4 text-sm text-amber-700 dark:text-amber-500">
            {ko
              ? `아직 제출되지 않은 필수 서류가 ${totalRequired}건 중 ${missingCount}건 있습니다. `
              : `${missingCount} of ${totalRequired} required documents haven't arrived yet. `}
            {t(T.missingDocsWarning)}{" "}
            <Link href={`/deal/${deal.id}`} className="underline">
              {t(T.viewSubmissions)}
            </Link>
          </p>
        )}
      </section>

      {/* Save indicator */}
      <p className="mt-3 h-5 text-xs text-neutral-400">
        {saveError ? (
          <span className="text-red-600 dark:text-red-400">
            {t(T.saveFailed)} — {saveError}
          </span>
        ) : saving > 0 ? (
          t(T.saving)
        ) : savedAt ? (
          `${t(T.saved)} ${savedAt}`
        ) : (
          t(T.autosaveHint)
        )}
      </p>

      {sections.map((section) => (
        <section key={section.id} className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">
            {ko ? section.titleKo : section.titleEn}
            <span className="ml-2 text-sm font-normal text-neutral-500">
              {ko ? section.titleEn : section.titleKo}
            </span>
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            {ko ? section.blurbKo : section.blurbEn}
          </p>

          <ol className="mt-4 space-y-4">
            {section.items.map((item) => {
              const state = checks[item.id] ?? EMPTY;
              const details = ko ? item.detailsKo : item.detailsEn;
              const tips = ko ? item.tipsKo : item.tipsEn;

              return (
                <li
                  key={item.id}
                  className={`rounded-xl border p-5 transition-colors ${
                    state.checked
                      ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20"
                      : "border-neutral-200 dark:border-neutral-800"
                  }`}
                >
                  <label className="flex cursor-pointer gap-3">
                    <input
                      type="checkbox"
                      checked={state.checked}
                      onChange={(event) => toggle(item, event.target.checked)}
                      className="mt-1 h-5 w-5 shrink-0 accent-emerald-600"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">
                        {ko ? item.titleKo : item.titleEn}
                      </span>
                      <span className="mt-0.5 block text-sm text-neutral-500">
                        {ko ? item.titleEn : item.titleKo} &middot; {item.sourceRef}
                      </span>
                    </span>
                  </label>

                  <ul className="mt-3 ml-8 list-disc space-y-1 text-sm text-neutral-600 marker:text-neutral-300 dark:text-neutral-400">
                    {details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>

                  {tips?.map((tip) => (
                    <p
                      key={tip}
                      className="mt-2 ml-8 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
                    >
                      💡 {tip}
                    </p>
                  ))}

                  {item.relatedDocuments.length > 0 && (
                    <div className="mt-3 ml-8 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-neutral-400">{t(T.relatedDocs)}</span>
                      {item.relatedDocuments.map((doc) => (
                        <span
                          key={doc.id}
                          title={
                            doc.submitted
                              ? t(T.submitted)
                              : doc.optional
                                ? t(T.ifApplicable)
                                : t(T.notSubmitted)
                          }
                          className={`rounded px-1.5 py-0.5 text-xs ${
                            doc.submitted
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-neutral-100 text-neutral-500 line-through dark:bg-neutral-800 dark:text-neutral-500"
                          }`}
                        >
                          {ko ? doc.nameKo : doc.nameEn}
                        </span>
                      ))}
                    </div>
                  )}

                  <textarea
                    value={state.note}
                    onChange={(event) => editNote(item, event.target.value)}
                    rows={2}
                    placeholder={t(T.memoPlaceholder)}
                    className="mt-3 ml-8 block w-[calc(100%-2rem)] resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-950"
                  />
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      <footer className="mt-10 border-t border-neutral-200 pt-6 text-xs text-neutral-400 dark:border-neutral-800">
        {t(T.diligenceSource)}
      </footer>
    </main>
  );
}
