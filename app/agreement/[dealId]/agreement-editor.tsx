"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Deal } from "@/lib/deals";
import {
  ALL_FIELDS,
  departsFromStandard,
  FIELD_BY_TOKEN,
  missingFields,
  tokenValues,
  type AgreementField,
  type AgreementValues,
} from "@/lib/agreement-fields";
import type { FieldSuggestions } from "@/lib/agreement-suggest";
import type { AgreementRecord } from "@/lib/agreement-store";
import type { Block, DocxLayout } from "@/lib/docx-layout";
import { T } from "@/lib/i18n";
import { describe } from "@/lib/errors";
import { useLang } from "@/app/lang-provider";
import ContractView, { type ActiveSlot } from "./contract-view";

/** Year/month/day sub-fields that are collapsed into their group's date input. */
const DATE_HEADS = new Set(["signYear", "paymentYear", "closingYear", "financialsYear"]);
const DATE_SUBS = new Set([
  "signMonth", "signDay",
  "paymentMonth", "paymentDay",
  "closingMonth", "closingDay",
  "financialsMonth", "financialsDay",
]);

/** Four date triplets collapsed into single YYYY-MM-DD inputs. */
const DATE_GROUPS = [
  {
    id: "signYear",
    labelKo: "체결일",
    labelEn: "Signing date",
    hintKo: "표지·전문·서명란·별지2에 반영",
    hintEn: "Cover, preamble, signature block and appendix 2",
    yearId: "signYear",
    monthId: "signMonth",
    dayId: "signDay",
  },
  {
    id: "paymentYear",
    labelKo: "납입기일",
    labelEn: "Payment date",
    hintKo: "본건 종류주식의 납입기일",
    hintEn: "Payment date for the preferred shares",
    yearId: "paymentYear",
    monthId: "paymentMonth",
    dayId: "paymentDay",
  },
  {
    id: "closingYear",
    labelKo: "거래완결 기한",
    labelEn: "Closing deadline",
    hintKo: "이 날까지 완결되지 않으면 해제 사유",
    hintEn: "Missing this date is grounds for termination",
    yearId: "closingYear",
    monthId: "closingMonth",
    dayId: "closingDay",
  },
  {
    id: "financialsYear",
    labelKo: "재무제표 기준일",
    labelEn: "Financial statements as of",
    hintKo: "진술 및 보장의 기준이 되는 재무제표 일자",
    hintEn: "The financials the warranties are given against",
    yearId: "financialsYear",
    monthId: "financialsMonth",
    dayId: "financialsDay",
  },
] as const;

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

  /**
   * Raw text the user is actively typing into a date group input.
   * Keyed by date group id (= yearId). Cleared on blur so the display
   * falls back to the value derived from the stored year/month/day fields.
   */
  const [dateDrafts, setDateDrafts] = useState<Record<string, string>>({});

  const [suggestions, setSuggestions] = useState<FieldSuggestions>({});
  const [suggesting, setSuggesting] = useState(false);
  const [suggestMessage, setSuggestMessage] = useState<string | null>(null);

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

  // Temp-save: a contract is rarely filled in one sitting, so persist quietly a
  // short while after edits stop. The manual Save button still works; this just
  // means closing the tab mid-draft doesn't lose anything.
  useEffect(() => {
    if (!dirty || saving) return;
    const timer = setTimeout(() => {
      void save();
    }, 1500);
    return () => clearTimeout(timer);
    // save reads the latest values from its closure; re-running on values change
    // is what makes the autosave pick them up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, dirty]);

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

  /**
   * Fields ordered by first appearance in the contract (document order), so
   * the sidebar reads top-to-bottom just like the contract does.
   *
   * Date sub-fields (month/day) are excluded here — they're rendered as part
   * of their group's aggregated date input.
   */
  const sortedFields = useMemo<AgreementField[]>(() => {
    const seen = new Set<string>();
    const result: AgreementField[] = [];

    for (const fieldId of slotsByField.keys()) {
      if (!seen.has(fieldId) && !DATE_SUBS.has(fieldId)) {
        seen.add(fieldId);
        const field = ALL_FIELDS.find((f) => f.id === fieldId);
        if (field) result.push(field);
      }
    }

    // Append anything not in the template (e.g. words/copy fields with no slot).
    for (const field of ALL_FIELDS) {
      if (!seen.has(field.id) && !DATE_SUBS.has(field.id)) {
        result.push(field);
        seen.add(field.id);
      }
    }

    return result;
  }, [slotsByField]);

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

  /** Reconstructs the YYYY-MM-DD string from stored year/month/day values. */
  function derivedDate(group: (typeof DATE_GROUPS)[number]) {
    const y = values[group.yearId]?.trim();
    const m = values[group.monthId]?.trim();
    const d = values[group.dayId]?.trim();
    if (!y || !m || !d) return "";
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
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

  async function fetchSuggestions() {
    setSuggesting(true);
    setSuggestMessage(null);

    try {
      const response = await fetch(`/api/deals/${deal.id}/agreement/suggest`, {
        method: "POST",
      });

      const parsed = await response.json().catch(() => null);
      if (!response.ok) throw new Error(parsed?.error ?? `${response.status}`);

      const found = parsed as FieldSuggestions;
      setSuggestions(found);

      const count = Object.keys(found).length;
      setSuggestMessage(count === 0 ? t(T.aiSuggestNone) : null);
    } catch (problem) {
      setSuggestMessage(`${t(T.aiSuggestFailed)}: ${describe(problem)}`);
    } finally {
      setSuggesting(false);
    }
  }

  /** Applies all suggestions to fields that are still empty. */
  function applyAllSuggestions() {
    setValues((current) => {
      const next = { ...current };
      for (const [fieldId, suggestion] of Object.entries(suggestions)) {
        if (!next[fieldId]?.trim()) next[fieldId] = suggestion;
      }
      return next;
    });
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

          {/* Save: emerald so it stands apart from the PDF button beside it. */}
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
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

          {/* AI suggestion panel */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={fetchSuggestions}
              disabled={suggesting}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              {suggesting ? t(T.aiSuggesting) : t(T.aiSuggestFields)}
            </button>

            {Object.keys(suggestions).length > 0 && (
              <>
                <span className="text-xs text-neutral-500">
                  {Object.keys(suggestions).length}{t(T.aiSuggestCount)}
                </span>
                <button
                  type="button"
                  onClick={applyAllSuggestions}
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-sky-700"
                >
                  {t(T.aiSuggestApplyAll)}
                </button>
              </>
            )}
          </div>

          {suggestMessage && (
            <p className="mb-4 rounded-lg border border-neutral-200 px-3 py-2 text-xs text-neutral-500 dark:border-neutral-800">
              {suggestMessage}
            </p>
          )}

          <div className="space-y-2.5">
            {sortedFields.map((field) => {
              // Date group head — render a single YYYY-MM-DD input.
              if (DATE_HEADS.has(field.id)) {
                const dg = DATE_GROUPS.find((g) => g.yearId === field.id)!;
                const derived = derivedDate(dg);
                const displayValue = dateDrafts[dg.id] ?? derived;
                return (
                  <div key={field.id}>
                    <label
                      className="block text-[11px] font-medium text-neutral-500"
                      htmlFor={dg.id}
                    >
                      {pick(dg.labelKo, dg.labelEn)}
                    </label>
                    <input
                      id={dg.id}
                      ref={(node) => {
                        if (node) {
                          fieldRefs.current.set(dg.yearId, node);
                          fieldRefs.current.set(dg.monthId, node);
                          fieldRefs.current.set(dg.dayId, node);
                        }
                      }}
                      value={displayValue}
                      placeholder="YYYY-MM-DD"
                      onFocus={() => {
                        setDateDrafts((prev) => ({ ...prev, [dg.id]: derived }));
                        locate(dg.yearId);
                      }}
                      onBlur={() => {
                        setDateDrafts((prev) => {
                          const next = { ...prev };
                          delete next[dg.id];
                          return next;
                        });
                        setActive(null);
                      }}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setDateDrafts((prev) => ({ ...prev, [dg.id]: raw }));
                        const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                        if (match) {
                          const [, year, month, day] = match;
                          setValues((prev) => ({
                            ...prev,
                            [dg.yearId]: year,
                            [dg.monthId]: String(parseInt(month, 10)),
                            [dg.dayId]: String(parseInt(day, 10)),
                          }));
                        }
                      }}
                      className={`${input} placeholder:text-neutral-400 dark:placeholder:text-neutral-600`}
                    />
                    <p className="mt-0.5 text-[10px] text-neutral-400">
                      {lang === "ko" ? dg.hintKo : dg.hintEn}
                    </p>
                  </div>
                );
              }

              // Normal field.
              const value = values[field.id] ?? "";
              const off =
                field.standard && field.default && value.trim() !== field.default;
              const slots = slotsByField.get(field.id)?.length ?? 0;
              const suggestion = suggestions[field.id];
              const hasSuggestion = suggestion && !value.trim();

              return (
                <div key={field.id}>
                  <label
                    className="block text-[11px] font-medium text-neutral-500"
                    htmlFor={field.id}
                  >
                    {pick(field.labelKo, field.labelEn)}
                    {field.standard && (
                      <span className="ml-1 text-neutral-400">({field.default})</span>
                    )}
                    {slots > 1 && (
                      <span className="ml-1 text-neutral-400">×{slots}</span>
                    )}
                    {hasSuggestion && (
                      <button
                        type="button"
                        onClick={() =>
                          setValues((current) => ({ ...current, [field.id]: suggestion }))
                        }
                        className="ml-1.5 rounded bg-sky-100 px-1 py-0.5 text-[10px] font-normal text-sky-700 transition-colors hover:bg-sky-200 dark:bg-sky-950 dark:text-sky-300"
                      >
                        {t(T.aiSuggestApply)}
                      </button>
                    )}
                  </label>

                  <input
                    id={field.id}
                    ref={(node) => {
                      if (node) fieldRefs.current.set(field.id, node);
                    }}
                    value={value}
                    placeholder={suggestion ?? undefined}
                    onFocus={() => locate(field.id)}
                    onBlur={() => setActive(null)}
                    inputMode={
                      field.kind === "text" || field.kind === "words" ? "text" : "numeric"
                    }
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [field.id]: event.target.value,
                      }))
                    }
                    className={`${input} placeholder:text-neutral-400 dark:placeholder:text-neutral-600 ${
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
        </aside>
      </div>
    </div>
  );
}
