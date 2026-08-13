/**
 * Checks the .docx layout reader against the real contract.
 *
 * The things that can silently go wrong: clause numbers coming out in the wrong
 * order, slots getting lost while runs are split, tables collapsing, or text
 * disappearing into a wrapper the reader doesn't descend through.
 */

import { templateLayout } from "../lib/agreement-docx.ts";
import type { Block, Paragraph } from "../lib/docx-layout.ts";
import { FIELD_BY_TOKEN } from "../lib/agreement-fields.ts";

const layout = await templateLayout();

function paragraphsOf(blocks: Block[]): Paragraph[] {
  const out: Paragraph[] = [];

  for (const block of blocks) {
    if (block.kind === "paragraph") out.push(block);
    else for (const row of block.rows) for (const cell of row) out.push(...paragraphsOf(cell.blocks));
  }

  return out;
}

const tables = layout.blocks.filter((block) => block.kind === "table");
const paragraphs = paragraphsOf(layout.blocks);
const text = (paragraph: Paragraph) => paragraph.runs.map((run) => run.text).join("");

console.log("--- page setup ---");
console.log(layout.page);
console.log(`default font size: ${layout.defaultSizePt}pt`);

console.log("\n--- structure found ---");
console.log(`top-level blocks : ${layout.blocks.length}`);
console.log(`tables           : ${tables.length}`);
console.log(`paragraphs       : ${paragraphs.length}`);
console.log(`  with a marker  : ${paragraphs.filter((p) => p.marker).length}`);
console.log(`  centred        : ${paragraphs.filter((p) => p.align === "center").length}`);
console.log(`  page-broken    : ${paragraphs.filter((p) => p.pageBreak).length}`);
console.log(`runs             : ${paragraphs.reduce((n, p) => n + p.runs.length, 0)}`);
console.log(`  bold           : ${paragraphs.reduce((n, p) => n + p.runs.filter((r) => r.bold).length, 0)}`);
console.log(`  underlined     : ${paragraphs.reduce((n, p) => n + p.runs.filter((r) => r.underline).length, 0)}`);

const slots = paragraphs.flatMap((p) => p.runs.filter((r) => r.token).map((r) => r.token!));
console.log(`\nslots reachable  : ${slots.length} (template has 85)`);
const duplicated = slots.filter((token, at, all) => all.indexOf(token) !== at);
console.log(`duplicated slots : ${duplicated.length}`);
const unknown = slots.filter((token) => !FIELD_BY_TOKEN[token]);
console.log(`slots with no field: ${unknown.length}`);

console.log("\n--- no text lost? ---");
const withMarkup = paragraphs.filter((p) => /<\/?w[a-z0-9]*:/.test(text(p)));
console.log(`paragraphs containing XML markup: ${withMarkup.length}`);
const empty = paragraphs.filter((p) => p.runs.length === 0);
console.log(`paragraphs with no runs (blank lines): ${empty.length}`);

console.log("\n--- where clicking a field jumps to ---");
// "First instance" has to mean first in the DOCUMENT, not lowest token number:
// the year slots were appended as f78-f85 so the earlier numbering stayed
// stable. This warns if the two ever disagree.
const byField = new Map<string, string[]>();
for (const paragraph of paragraphs) {
  for (const run of paragraph.runs) {
    const field = run.token ? FIELD_BY_TOKEN[run.token] : undefined;
    if (!run.token || !field) continue;
    byField.set(field.id, [...(byField.get(field.id) ?? []), run.token]);
  }
}

const unreachable = [...new Set(Object.values(FIELD_BY_TOKEN).map((f) => f.id))].filter(
  (id) => !byField.has(id),
);
console.log(`fields with nowhere to jump to: ${unreachable.length}`);
for (const id of unreachable) console.log(`  ${id}`);

for (const [id, tokens] of byField) {
  if (tokens.length < 2) continue;

  const lowest = [...tokens].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))[0];
  const warning = lowest !== tokens[0] ? `  <- by number it would be ${lowest}, WRONG` : "";
  console.log(`  ${id.padEnd(18)} ×${tokens.length}  jumps to ${tokens[0]}${warning}`);
}

console.log("\n--- the article numbers, in order ---");
const articles = paragraphs.filter((p) => p.marker?.includes("조"));
console.log(articles.map((p) => `${p.marker} ${text(p).trim()}`.slice(0, 46)).join("\n"));

console.log("\n--- the first 30 lines as they will render ---");
let shown = 0;
for (const paragraph of paragraphs) {
  const body = text(paragraph).trim();
  if (!body && !paragraph.marker) continue;

  const marks = [
    paragraph.align === "center" ? "centre" : paragraph.align,
    paragraph.runs.some((r) => r.bold) ? "bold" : null,
    paragraph.indentPt ? `indent ${paragraph.indentPt}pt` : null,
  ]
    .filter(Boolean)
    .join(" ");

  console.log(
    `${(paragraph.marker ?? "").padEnd(8)}${body.slice(0, 60).padEnd(62)}${marks ? `[${marks}]` : ""}`,
  );
  if (++shown >= 30) break;
}

console.log("\n--- first table, as a grid ---");
const first = tables[0];
if (first && first.kind === "table") {
  console.log(`bordered: ${first.bordered}`);
  for (const row of first.rows) {
    console.log(
      row
        .map(
          (cell) =>
            `${paragraphsOf(cell.blocks).map(text).join(" ").trim().slice(0, 22)}`.padEnd(24),
        )
        .join("| "),
    );
  }
}
