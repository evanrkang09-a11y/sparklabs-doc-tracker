"use client";

/**
 * Draws the contract the way Word does.
 *
 * The layout comes off the .docx itself (lib/docx-layout.ts) rather than being
 * styled by hand, so the cover stays centred, clause numbers stay numbered,
 * defined terms stay bold and the tables stay tables. A person checking a
 * contract needs to recognise the document in front of them.
 *
 * What it does not do is paginate. Word decides where pages end by measuring
 * text; this is one continuous sheet at the right width and margins, with the
 * document's three explicit page breaks marked. The .docx download is the
 * document of record.
 */

import { memo, useState } from "react";
import type { Block, DocxLayout, Paragraph, Run, Table } from "@/lib/docx-layout";
import { FIELD_BY_TOKEN } from "@/lib/agreement-fields";

/** Which slot the contract is scrolled to, and which field it belongs to. */
export type ActiveSlot = { fieldId: string; token: string } | null;

type AnnotationMark = { id: string; comment: string; authorName: string };
type ParagraphSuggestionMark = { id: string; selectedText: string; proposedText: string; authorName: string };

type Context = {
  /** Token -> the value typed for it. Missing means still empty. */
  replacements: Record<string, string>;
  active: ActiveSlot;
  /** Reads a field's label in the language the page is in. */
  label: (token: string) => string;
  /** User-written overrides for plain-text paragraphs, keyed by block index. */
  overrides?: Record<string, string>;
  /** Called when the user finishes editing a plain-text paragraph. */
  onParagraphEdit?: (key: string, text: string) => void;
  /**
   * fieldId → proposed value for pending company suggestions.
   * When present, the slot is highlighted in orange and shows the proposed value
   * so the employee can see what the document would look like if approved.
   */
  pendingSuggestions?: Record<string, string>;
  /**
   * blockKey → annotations anchored to that paragraph.
   * Paragraphs with entries get a yellow highlight and a 💬 marker in the right margin.
   */
  annotationsByBlock?: Record<string, AnnotationMark[]>;
  /**
   * blockKey → pending paragraph text suggestion from the startup.
   * Employee view shows an inline review zone; startup view shows an orange tint.
   */
  paragraphSuggestionsByBlock?: Record<string, ParagraphSuggestionMark>;
  /**
   * Called when an employee accepts or rejects a paragraph suggestion.
   * Presence signals the employee view — startup view leaves this undefined.
   */
  onParagraphSuggestionAction?: (id: string, action: "approve" | "reject") => void;
};

export default function ContractView({
  layout,
  ...context
}: { layout: DocxLayout } & Context) {
  const { page } = layout;

  return (
    <div
      // contract-sheet is what the print styles look for: this element already
      // has the document's page margins, so the printer must not add more.
      className="contract-sheet mx-auto bg-white text-neutral-900 shadow-sm print:shadow-none dark:bg-neutral-100"
      style={{
        width: `${page.widthPt}pt`,
        maxWidth: "100%",
        paddingTop: `${page.marginTopPt}pt`,
        paddingBottom: `${page.marginBottomPt}pt`,
        paddingLeft: `${page.marginLeftPt}pt`,
        paddingRight: `${page.marginRightPt}pt`,
        fontSize: `${layout.defaultSizePt}pt`,
        // The template is set in 맑은 고딕; naming it first means the preview
        // uses the same face as the printed contract on a Korean machine.
        fontFamily: '"Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", sans-serif',
        lineHeight: 1.5,
        tabSize: 4,
      }}
    >
      <Blocks blocks={layout.blocks} context={context} keyPrefix="" />
    </div>
  );
}

function Blocks({
  blocks,
  context,
  keyPrefix,
}: {
  blocks: Block[];
  context: Context;
  keyPrefix?: string;
}) {
  return (
    <>
      {blocks.map((block, at) =>
        block.kind === "table" ? (
          <TableView key={at} table={block} context={context} keyPrefix={keyPrefix} at={at} />
        ) : (
          <ParagraphView
            key={at}
            paragraph={block}
            context={context}
            signature={signatureOf(block, context, keyPrefix !== undefined ? `${keyPrefix}${at}` : undefined)}
            blockKey={keyPrefix !== undefined ? `${keyPrefix}${at}` : undefined}
          />
        ),
      )}
    </>
  );
}

/**
 * Everything about a paragraph that can change while typing.
 *
 * Used to skip re-rendering the ~630 paragraphs that a keystroke cannot
 * possibly have altered. Without it every keystroke re-renders the whole
 * contract, which is 650 paragraphs and 2,000-odd spans of layout work.
 */
function signatureOf(paragraph: Paragraph, context: Context, blockKey?: string): string {
  const { replacements, active, pendingSuggestions, annotationsByBlock, paragraphSuggestionsByBlock } = context;
  let out = "";

  for (const run of paragraph.runs) {
    if (!run.token) continue;
    out += `|${run.token}=${replacements[run.token] ?? ""}`;
    if (run.token === active?.token) out += "#here";
    else if (FIELD_BY_TOKEN[run.token]?.id === active?.fieldId) out += "#near";
    const fieldId = FIELD_BY_TOKEN[run.token]?.id ?? run.token;
    if (pendingSuggestions?.[fieldId]) out += `#sug=${pendingSuggestions[fieldId]}`;
  }

  if (blockKey) {
    const anns = annotationsByBlock?.[blockKey];
    if (anns?.length) out += `#ann=${anns.length}`;
    const paraSug = paragraphSuggestionsByBlock?.[blockKey];
    if (paraSug) out += `#parasug=${paraSug.id}`;
  }

  return out;
}

const ParagraphView = memo(
  function ParagraphView({
    paragraph,
    context,
    blockKey,
  }: {
    paragraph: Paragraph;
    context: Context;
    /** Compared instead of `context`, which is a new object every keystroke. */
    signature: string;
    blockKey?: string;
  }) {
    const { runs, marker } = paragraph;
    const hanging = paragraph.firstLinePt !== undefined && paragraph.firstLinePt < 0;

    // 227 of this contract's paragraphs are empty - they're the spacing between
    // clauses. Word gives each a line's height, where an empty <p> collapses to
    // nothing, so they get a non-breaking space. They keep their own styling: a
    // blank line still carries the spacing set on it.
    const blank = runs.length === 0 && !marker;

    const hasTokens = runs.some((r) => r.token);
    const canEdit = !hasTokens && !blank && !!blockKey && !!context.onParagraphEdit;
    const anns = blockKey ? (context.annotationsByBlock?.[blockKey] ?? []) : [];
    const paraSug = blockKey ? (context.paragraphSuggestionsByBlock?.[blockKey] ?? null) : null;
    const canReviewParaSug = !!context.onParagraphSuggestionAction;

    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState("");

    function startEdit() {
      if (!canEdit || !blockKey) return;
      const existingOverride = context.overrides?.[blockKey];
      const current =
        existingOverride !== undefined
          ? existingOverride
          : runs.map((r) => r.text ?? "").join("");
      setDraft(current);
      setEditing(true);
    }

    function finishEdit() {
      if (!blockKey) return;
      context.onParagraphEdit!(blockKey, draft);
      setEditing(false);
    }

    const pStyle = {
      margin: 0,
      marginTop: paragraph.spaceBeforePt ? `${paragraph.spaceBeforePt}pt` : undefined,
      marginBottom: paragraph.spaceAfterPt ? `${paragraph.spaceAfterPt}pt` : undefined,
      textAlign: paragraph.align,
      paddingLeft: paragraph.indentPt ? `${paragraph.indentPt}pt` : undefined,
      textIndent: paragraph.firstLinePt ? `${paragraph.firstLinePt}pt` : undefined,
      lineHeight: paragraph.lineHeight,
      whiteSpace: "pre-wrap" as const,
    };

    const override = blockKey ? context.overrides?.[blockKey] : undefined;

    return (
      <>
        {paragraph.pageBreak && <PageBreak />}
        {editing && canEdit ? (
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={finishEdit}
            onKeyDown={(e) => {
              if (e.key === "Escape") finishEdit();
            }}
            style={{
              ...pStyle,
              width: "100%",
              display: "block",
              resize: "none",
              border: "none",
              outline: "2px solid #3b82f6",
              borderRadius: "2px",
              background: "#eff6ff",
              padding: "2px",
              fontFamily: "inherit",
              fontSize: "inherit",
              color: "inherit",
            }}
            rows={Math.max(1, draft.split("\n").length)}
          />
        ) : (
          <div style={{ position: "relative" }}>
            <p
              data-blockkey={blockKey}
              onClick={canEdit ? startEdit : undefined}
              style={{
                ...pStyle,
                ...(paraSug
                  ? { backgroundColor: "rgba(251,146,60,0.15)", borderLeft: "3px solid rgba(251,146,60,0.6)", paddingLeft: "6px", borderRadius: "2px" }
                  : anns.length > 0
                    ? { backgroundColor: "rgba(253,224,71,0.25)", borderRadius: "2px" }
                    : {}),
              }}
              className={
                canEdit
                  ? "cursor-text rounded hover:outline hover:outline-2 hover:outline-blue-300"
                  : undefined
              }
              title={canEdit ? "Click to edit" : undefined}
            >
              {marker && (
                <span
                  style={{
                    fontSize: paragraph.markerSizePt
                      ? `${paragraph.markerSizePt}pt`
                      : undefined,
                    display: hanging ? "inline-block" : undefined,
                    boxSizing: "border-box",
                    minWidth: hanging ? `${-(paragraph.firstLinePt ?? 0)}pt` : undefined,
                    paddingRight: hanging ? "3pt" : undefined,
                  }}
                >
                  {marker}
                  {hanging ? "" : " "}
                </span>
              )}

              {blank
                ? " "
                : override !== undefined
                  ? override
                  : runs.map((run, at) => <RunView key={at} run={run} context={context} />)}
            </p>

            {/* ✏️ paragraph suggestion marker — right margin, orange */}
            {paraSug && (
              <span
                style={{ position: "absolute", right: "-28px", top: "1px" }}
                className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-400 text-[9px] font-bold text-orange-900 shadow-sm print:hidden"
                title={`${paraSug.authorName}: "${paraSug.selectedText}" → "${paraSug.proposedText}"`}
              >
                ✏
              </span>
            )}

            {/* 💬 annotation marker — sits in the right margin, outside the paragraph text */}
            {anns.length > 0 && (
              <button
                type="button"
                data-ann-btn
                data-annotation-ids={anns.map((a) => a.id).join(",")}
                style={{ position: "absolute", right: paraSug ? "-52px" : "-28px", top: "1px" }}
                className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-[9px] font-bold text-yellow-900 shadow-sm hover:bg-yellow-500 print:hidden"
                title={anns.map((a) => `${a.authorName}: ${a.comment}`).join("\n")}
              >
                {anns.length}
              </button>
            )}

            {/* Inline suggestion review zone — employees only */}
            {paraSug && canReviewParaSug && (
              <div className="mt-1 rounded-md border border-orange-200 bg-orange-50 px-2.5 py-2 text-[11px] print:hidden">
                <p className="font-medium text-orange-700">{paraSug.authorName} suggests changing:</p>
                <p className="mt-0.5 text-neutral-500 line-through leading-snug">&ldquo;{paraSug.selectedText}&rdquo;</p>
                <p className="mt-0.5 font-medium text-orange-900 leading-snug">&ldquo;{paraSug.proposedText}&rdquo;</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => context.onParagraphSuggestionAction!(paraSug.id, "approve")}
                    className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-emerald-700"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => context.onParagraphSuggestionAction!(paraSug.id, "reject")}
                    className="rounded border border-neutral-300 px-2 py-0.5 text-[10px] hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </>
    );
  },
  (before, after) =>
    before.paragraph === after.paragraph &&
    before.signature === after.signature &&
    before.blockKey === after.blockKey &&
    before.context.overrides === after.context.overrides &&
    before.context.pendingSuggestions === after.context.pendingSuggestions &&
    before.context.paragraphSuggestionsByBlock === after.context.paragraphSuggestionsByBlock &&
    before.context.onParagraphSuggestionAction === after.context.onParagraphSuggestionAction,
);

function RunView({ run, context }: { run: Run; context: Context }) {
  const style = {
    fontWeight: run.bold ? 600 : undefined,
    fontStyle: run.italic ? "italic" : undefined,
    textDecoration: run.underline ? "underline" : undefined,
    fontSize: run.sizePt ? `${run.sizePt}pt` : undefined,
    color: run.color,
  };

  if (!run.token) {
    return <span style={style}>{run.text}</span>;
  }

  const { replacements, active, label, pendingSuggestions } = context;
  const value = replacements[run.token];
  const here = active?.token === run.token;
  const near = !here && FIELD_BY_TOKEN[run.token]?.id === active?.fieldId;
  const fieldId = FIELD_BY_TOKEN[run.token]?.id ?? run.token;
  const suggestedValue = pendingSuggestions?.[fieldId];

  return (
    <span
      data-token={run.token}
      title={
        suggestedValue
          ? `Suggested: "${suggestedValue}"`
          : `{{${run.token}}} · ${label(run.token)}`
      }
      style={style}
      className={
        here
          ? "rounded bg-yellow-300 px-0.5 ring-2 ring-yellow-500 print:bg-transparent print:ring-0"
          : near
            ? "rounded bg-yellow-100 px-0.5 print:bg-transparent"
            : suggestedValue
              ? "rounded bg-orange-200 px-0.5 ring-1 ring-orange-400 print:bg-transparent print:ring-0"
              : value === undefined
                ? "rounded border border-dashed border-neutral-400 px-1 text-neutral-500"
                : ""
      }
    >
      {/* Pending suggestion: show the proposed value so the employee sees what would change. */}
      {suggestedValue ?? value ?? label(run.token)}
    </span>
  );
}

function TableView({
  table,
  context,
  keyPrefix,
  at,
}: {
  table: Table;
  context: Context;
  keyPrefix?: string;
  at?: number;
}) {
  const border = table.bordered ? "1px solid #999" : undefined;
  const tableKeyBase =
    keyPrefix !== undefined && at !== undefined ? `${keyPrefix}${at}.` : undefined;

  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        margin: "6pt 0",
        tableLayout: "fixed",
      }}
    >
      <tbody>
        {table.rows.map((row, rowAt) => (
          <tr key={rowAt}>
            {row.map((cell, cellAt) => (
              <td
                key={cellAt}
                colSpan={cell.span > 1 ? cell.span : undefined}
                style={{
                  border,
                  width: cell.widthPct ? `${cell.widthPct}%` : undefined,
                  padding: "3pt 4pt",
                  verticalAlign: "top",
                }}
              >
                <Blocks
                  blocks={cell.blocks}
                  context={context}
                  keyPrefix={
                    tableKeyBase !== undefined
                      ? `${tableKeyBase}${rowAt}_${cellAt}.`
                      : undefined
                  }
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Where the document forces a new page.
 *
 * Shown as a break rather than paginated, because guessing where Word's
 * automatic breaks fall would be inventing information.
 */
function PageBreak() {
  return (
    <div
      aria-hidden
      className="my-6 border-t border-dashed border-neutral-300 print:break-before-page print:my-0 print:border-0"
    />
  );
}