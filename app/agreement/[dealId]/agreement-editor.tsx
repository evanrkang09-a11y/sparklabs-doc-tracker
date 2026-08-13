"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Deal } from "@/lib/deals";
import {
  AGREEMENT_GROUPS,
  departsFromStandard,
  missingFields,
  tokenValues,
  type AgreementValues,
} from "@/lib/agreement-fields";
import type { AgreementRecord } from "@/lib/agreement-store";
import { T } from "@/lib/i18n";
import { describe } from "@/lib/errors";
import { useLang } from "@/app/lang-provider";

/**
 * Contract on the left, the values that fill it on the right.
 *
 * The preview substitutes tokens in the browser as you type, so the effect of a
 * change is immediate and costs nothing. The .docx download goes to the server,
 * which fills the real template - the preview is for reading, the docx is the
 * document.
 *
 * A token with no value stays visible as {{f27}} in both, on purpose: an empty
 * term in a contract reads as deliberate, where a visible gap reads as
 * unfinished.
 */
export default function AgreementEditor({
  deal,
  paragraphs,
  initial,
}: {
  deal: Deal;
  /** Template text, one entry per paragraph, tokens still in place. */
  paragraphs: string[];
  initial: AgreementRecord;
}) {
  const { lang, t, pick } = useLang();

  const [values, setValues] = useState<AgreementValues>(initial.values);
  const [saved, setSaved] = useState<AgreementRecord>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);
  const fieldRefs = useRef(new Map<string, HTMLElement>());

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(saved.values),
    [values, saved.values],
  );

  // Warn before losing edits - a half-filled contract is real work.
  useEffect(() => {
    if (!dirty) return;

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const replacements = useMemo(() => tokenValues(values), [values]);
  const missing = useMemo(() => missingFields(values), [values]);
  const changedStandards = useMemo(() => departsFromStandard(values), [values]);

  const filled = useMemo(
    () =>
      paragraphs.map((line) =>
        line.replace(/\{\{(f\d+)\}\}/g, (whole, token: string) =>
          replacements[token] === undefined ? whole : replacements[token],
        ),
      ),
    [paragraphs, replacements],
  );

  async function save() {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/deals/${deal.id}/agreement`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });

      const parsed = await response.json().catch(() => null);
      if (!response.ok) throw new Error(parsed?.error ?? `${response.status}`);

      setSaved(parsed as AgreementRecord);
    } catch (problem) {
      setError(describe(problem));
    } finally {
      setSaving(false);
    }
  }

  async function downloadDocx() {
    // The server fills from the SAVED draft, so save first or the file won't
    // match what's on screen.
    if (dirty) await save();

    setDownloading(true);
    setError(null);

    try {
      const response = await fetch(`/api/deals/${deal.id}/agreement/download`);
      if (!response.ok) {
        const parsed = await response.json().catch(() => null);
        throw new Error(parsed?.error ?? `${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `투자계약서_${deal.companyKo || deal.id}.docx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (problem) {
      setError(describe(problem));
    } finally {
      setDownloading(false);
    }
  }

  function focusField(id: string) {
    const node = fieldRefs.current.get(id);
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
    node?.focus();
  }

  const input =
    "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950";

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6">
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">
            {pick(deal.companyKo, deal.companyEn)} · {t(T.agreementTitle)}
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">{t(T.agreementIntro)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-neutral-400">
            {dirty
              ? t(T.unsavedChanges)
              : saved.updatedAt
                ? `${t(T.savedBy)} ${new Date(saved.updatedAt).toLocaleString()}${
                    saved.updatedBy ? ` · ${saved.updatedBy}` : ""
                  }`
                : t(T.neverSaved)}
          </span>

          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {saving ? t(T.preparing) : t(T.saveAgreement)}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {t(T.downloadPdf)}
          </button>

          <button
            type="button"
            onClick={downloadDocx}
            disabled={downloading}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {downloading ? t(T.preparing) : t(T.downloadDocx)}
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-800 print:hidden dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="lg:grid lg:grid-cols-[1fr_26rem] lg:gap-6">
        {/* The contract */}
        <div
          ref={previewRef}
          className="max-h-[calc(100vh-11rem)] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-8 print:max-h-none print:overflow-visible print:border-0 print:p-0 dark:border-neutral-800 dark:bg-neutral-950"
        >
          {filled.map((line, index) => {
            if (!line.trim()) return <div key={index} className="h-3" />;

            const unfilled = /\{\{f\d+\}\}/.test(line);
            // Headings in this contract are short lines starting 제N조 or the
            // title itself; treating them as such makes 600 paragraphs readable.
            const heading = /^(제\s?\d+\s?조|별지|\[별지)/.test(line.trim());

            return (
              <p
                key={index}
                className={`text-[13px] leading-relaxed whitespace-pre-wrap ${
                  heading ? "mt-4 font-semibold" : "mt-1.5"
                } ${unfilled ? "text-neutral-400" : "text-neutral-800 dark:text-neutral-200"}`}
              >
                {line}
              </p>
            );
          })}
        </div>

        {/* The values */}
        <aside className="mt-6 max-h-[calc(100vh-11rem)] overflow-y-auto lg:mt-0 print:hidden">
          <div className="mb-4 rounded-lg border border-neutral-200 px-3 py-2.5 text-xs dark:border-neutral-800">
            {missing.length === 0 ? (
              <p className="font-medium text-emerald-700 dark:text-emerald-400">
                {t(T.allFieldsFilled)}
              </p>
            ) : (
              <>
                <p className="font-medium">
                  {t(T.fieldsRemaining)}: {missing.length}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {missing.slice(0, 8).map((field) => (
                    <button
                      key={field.id}
                      type="button"
                      onClick={() => focusField(field.id)}
                      className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-600 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
                    >
                      {pick(field.labelKo, field.labelEn)}
                    </button>
                  ))}
                  {missing.length > 8 && (
                    <span className="px-1 py-0.5 text-[11px] text-neutral-400">
                      +{missing.length - 8}
                    </span>
                  )}
                </div>
              </>
            )}

            {changedStandards.length > 0 && (
              <p className="mt-2 rounded bg-amber-100 px-2 py-1 text-[11px] text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                {t(T.standardChanged)} —{" "}
                {changedStandards
                  .map((field) => pick(field.labelKo, field.labelEn))
                  .join(", ")}
                <span className="mt-0.5 block opacity-80">{t(T.standardNote)}</span>
              </p>
            )}
          </div>

          {AGREEMENT_GROUPS.map((group) => (
            <section key={group.id} className="mb-5">
              <h2 className="mb-2 border-b border-neutral-200 pb-1 text-xs font-semibold dark:border-neutral-800">
                {pick(group.titleKo, group.titleEn)}
              </h2>

              <div className="space-y-2.5">
                {group.fields.map((field) => {
                  const value = values[field.id] ?? "";
                  const off =
                    field.standard && field.default && value.trim() !== field.default;

                  return (
                    <div key={field.id}>
                      <label
                        className="block text-[11px] font-medium text-neutral-500"
                        htmlFor={field.id}
                      >
                        {pick(field.labelKo, field.labelEn)}
                        {field.standard && (
                          <span className="ml-1 text-neutral-400">
                            ({field.default})
                          </span>
                        )}
                      </label>

                      <input
                        id={field.id}
                        ref={(node) => {
                          if (node) fieldRefs.current.set(field.id, node);
                        }}
                        value={value}
                        inputMode={
                          field.kind === "text" || field.kind === "words"
                            ? "text"
                            : "numeric"
                        }
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [field.id]: event.target.value,
                          }))
                        }
                        className={`${input} ${
                          off ? "border-amber-400 dark:border-amber-700" : ""
                        }`}
                      />

                      {(field.hintKo || field.hintEn) && (
                        <p className="mt-0.5 text-[10px] text-neutral-400">
                          {lang === "ko" ? field.hintKo : field.hintEn}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </aside>
      </div>
    </div>
  );
}
