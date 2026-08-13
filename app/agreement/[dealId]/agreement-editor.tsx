"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Deal } from "@/lib/deals";
import {
  AGREEMENT_GROUPS,
  departsFromStandard,
  FIELD_BY_TOKEN,
  missingFields,
  tokenValues,
  type AgreementValues,
} from "@/lib/agreement-fields";
import type { AgreementRecord } from "@/lib/agreement-store";
import type { Block, DocxLayout } from "@/lib/docx-layout";
import { T } from "@/lib/i18n";
import { describe } from "@/lib/errors";
import { useLang } from "@/app/lang-provider";
import ContractView, { type ActiveSlot } from "./contract-view";

/**
 * Contract on the left, the values that fill it on the right.
 *
 * The preview substitutes tokens in the browser as you type, so the effect of a
 * change is immediate and costs nothing. The .docx download goes to the server,
 * which fills the real template - the preview is for reading, the docx is the
 * document.
 *
 * A token with no value stays visible in both, on purpose: an empty term in a
 * contract reads as deliberate, where a visible gap reads as unfinished. On
 * screen the gap shows the field's name (hover for the raw token); the .docx
 * keeps the literal {{f27}}.
 *
 * Clicking into a field jumps the contract to where that value lands, like
 * Ctrl+F. Several fields fill more than one place - the signing year fills five
 * - so it goes to the first one and marks the rest faintly.
 */

/**
 * Scrolls the contract pane so a slot sits in the middle of it.
 *
 * Deliberately not `scrollIntoView`: the contract is a scrolling box inside the
 * page, and scrollIntoView also scrolls the page itself, which yanks the input
 * being typed in out of view.
 */
function centreWithin(container: HTMLElement, node: HTMLElement) {
  const outer = container.getBoundingClientRect();
  const inner = node.getBoundingClientRect();

  container.scrollTop +=
    inner.top - outer.top - container.clientHeight / 2 + inner.height / 2;
}
export default function AgreementEditor({
  deal,
  layout,
  initial,
}: {
  deal: Deal;
  /** The template as drawable blocks, slots still empty. */
  layout: DocxLayout;
  initial: AgreementRecord;
}) {
  const { lang, t, pick } = useLang();

  const [values, setValues] = useState<AgreementValues>(initial.values);
  const [saved, setSaved] = useState<AgreementRecord>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  /** The field being edited, and the one slot the contract is scrolled to. */
  const [active, setActive] = useState<ActiveSlot>(null);

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

  /**
   * Each field's slots in the order they appear in the contract.
   *
   * Read off the document rather than taken from `field.tokens`, because token
   * numbers are not document order - the year tokens were appended as f78-f85
   * so that the earlier numbering stayed stable. The two happen to agree in
   * today's template; `scripts/check-slot-order.mts` reports it if they stop.
   */
  const slotsByField = useMemo(() => {
    const map = new Map<string, string[]>();

    const walk = (blocks: Block[]) => {
      for (const block of blocks) {
        if (block.kind === "table") {
          for (const row of block.rows) for (const cell of row) walk(cell.blocks);
          continue;
        }

        for (const run of block.runs) {
          const field = run.token ? FIELD_BY_TOKEN[run.token] : undefined;
          if (!run.token || !field) continue;

          map.set(field.id, [...(map.get(field.id) ?? []), run.token]);
        }
      }
    };

    walk(layout.blocks);
    return map;
  }, [layout]);

  /** What to show in a slot nobody has filled yet. */
  const slotLabel = useMemo(
    () => (token: string) => {
      const field = FIELD_BY_TOKEN[token];
      return field ? pick(field.labelKo, field.labelEn) : `{{${token}}}`;
    },
    [pick],
  );

  /** Scrolls the contract to where this field lands, and marks the spot. */
  function locate(fieldId: string) {
    const first = slotsByField.get(fieldId)?.[0];
    if (!first) return;

    setActive({ fieldId, token: first });

    const container = previewRef.current;
    const slot = container?.querySelector<HTMLElement>(`[data-token="${first}"]`);
    if (container && slot) centreWithin(container, slot);
  }

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
          className="max-h-[calc(100vh-11rem)] overflow-auto rounded-xl border border-neutral-200 bg-neutral-100 p-4 print:max-h-none print:overflow-visible print:border-0 print:bg-white print:p-0 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <ContractView
            layout={layout}
            replacements={replacements}
            active={active}
            label={slotLabel}
          />
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
                  const slots = slotsByField.get(field.id)?.length ?? 0;

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
                        {/* Numbers only, so it needs no translation. Says the
                            value lands in more than one clause. */}
                        {slots > 1 && (
                          <span className="ml-1 text-neutral-400">×{slots}</span>
                        )}
                      </label>

                      <input
                        id={field.id}
                        ref={(node) => {
                          if (node) fieldRefs.current.set(field.id, node);
                        }}
                        value={value}
                        onFocus={() => locate(field.id)}
                        onBlur={() => setActive(null)}
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
