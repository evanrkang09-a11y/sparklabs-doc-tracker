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

import { memo } from "react";
import type { Block, DocxLayout, Paragraph, Run, Table } from "@/lib/docx-layout";
import { FIELD_BY_TOKEN } from "@/lib/agreement-fields";

/** Which slot the contract is scrolled to, and which field it belongs to. */
export type ActiveSlot = { fieldId: string; token: string } | null;

type Context = {
  /** Token -> the value typed for it. Missing means still empty. */
  replacements: Record<string, string>;
  active: ActiveSlot;
  /** Reads a field's label in the language the page is in. */
  label: (token: string) => string;
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
      <Blocks blocks={layout.blocks} context={context} />
    </div>
  );
}

function Blocks({ blocks, context }: { blocks: Block[]; context: Context }) {
  return (
    <>
      {blocks.map((block, at) =>
        block.kind === "table" ? (
          <TableView key={at} table={block} context={context} />
        ) : (
          <ParagraphView
            key={at}
            paragraph={block}
            context={context}
            signature={signatureOf(block, context)}
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
function signatureOf(paragraph: Paragraph, { replacements, active }: Context): string {
  let out = "";

  for (const run of paragraph.runs) {
    if (!run.token) continue;

    out += `|${run.token}=${replacements[run.token] ?? ""}`;
    if (run.token === active?.token) out += "#here";
    else if (FIELD_BY_TOKEN[run.token]?.id === active?.fieldId) out += "#near";
  }

  return out;
}

const ParagraphView = memo(
  function ParagraphView({
    paragraph,
    context,
  }: {
    paragraph: Paragraph;
    context: Context;
    /** Compared instead of `context`, which is a new object every keystroke. */
    signature: string;
  }) {
    const { runs, marker } = paragraph;
    const hanging = paragraph.firstLinePt !== undefined && paragraph.firstLinePt < 0;

    // 227 of this contract's paragraphs are empty - they're the spacing between
    // clauses. Word gives each a line's height, where an empty <p> collapses to
    // nothing, so they get a non-breaking space. They keep their own styling: a
    // blank line still carries the spacing set on it.
    const blank = runs.length === 0 && !marker;

    return (
      <>
        {paragraph.pageBreak && <PageBreak />}
        <p
          style={{
            margin: 0,
            marginTop: paragraph.spaceBeforePt ? `${paragraph.spaceBeforePt}pt` : undefined,
            marginBottom: paragraph.spaceAfterPt ? `${paragraph.spaceAfterPt}pt` : undefined,
            textAlign: paragraph.align,
            paddingLeft: paragraph.indentPt ? `${paragraph.indentPt}pt` : undefined,
            textIndent: paragraph.firstLinePt ? `${paragraph.firstLinePt}pt` : undefined,
            lineHeight: paragraph.lineHeight,
            whiteSpace: "pre-wrap",
          }}
        >
          {marker && (
            <span
              style={{
                fontSize: paragraph.markerSizePt ? `${paragraph.markerSizePt}pt` : undefined,
                // A hanging indent exists so the number sits in the margin and
                // the text lines up past it. Filling that width puts the text
                // where Word puts it rather than one space after the number.
                //
                // min-width, not width: "제1조" is wider than its 20pt hanging
                // indent, and a fixed width would let the clause text run back
                // over the top of it. Word moves the text along to the next tab
                // stop instead, so this keeps a small gap and does the same.
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
            ? " "
            : runs.map((run, at) => <RunView key={at} run={run} context={context} />)}
        </p>
      </>
    );
  },
  (before, after) =>
    before.paragraph === after.paragraph && before.signature === after.signature,
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

  const { replacements, active, label } = context;
  const value = replacements[run.token];
  const here = active?.token === run.token;
  const near = !here && FIELD_BY_TOKEN[run.token]?.id === active?.fieldId;

  return (
    <span
      data-token={run.token}
      title={`{{${run.token}}} · ${label(run.token)}`}
      style={style}
      className={
        here
          ? "rounded bg-yellow-300 px-0.5 ring-2 ring-yellow-500 print:bg-transparent print:ring-0"
          : near
            ? "rounded bg-yellow-100 px-0.5 print:bg-transparent"
            : value === undefined
              ? "rounded border border-dashed border-neutral-400 px-1 text-neutral-500"
              : ""
      }
    >
      {/* An empty slot shows what belongs there. The .docx keeps the literal
          {{f27}}, which is what you want in a file, not on a screen. */}
      {value ?? label(run.token)}
    </span>
  );
}

function TableView({ table, context }: { table: Table; context: Context }) {
  const border = table.bordered ? "1px solid #999" : undefined;

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
        {table.rows.map((row, at) => (
          <tr key={at}>
            {row.map((cell, index) => (
              <td
                key={index}
                colSpan={cell.span > 1 ? cell.span : undefined}
                style={{
                  border,
                  width: cell.widthPct ? `${cell.widthPct}%` : undefined,
                  padding: "3pt 4pt",
                  verticalAlign: "top",
                }}
              >
                <Blocks blocks={cell.blocks} context={context} />
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
