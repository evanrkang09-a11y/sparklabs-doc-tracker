/**
 * Checks the "jump to the first instance" logic.
 *
 * Two things worth knowing before trusting the jump:
 *   - every field has somewhere to jump TO (a field mapped to a token that
 *     isn't in the document would silently do nothing on click), and
 *   - token numbers are not document order. They agree in today's template,
 *     but the year tokens were appended as f78-f85, so a future revision could
 *     easily break the assumption. This prints a warning when it does.
 */

import { templateParagraphs } from "../lib/agreement-docx.ts";
import { ALL_FIELDS, FIELD_BY_TOKEN } from "../lib/agreement-fields.ts";

const paragraphs = await templateParagraphs();

const order: { token: string; paragraph: number }[] = [];
for (const [paragraph, line] of paragraphs.entries()) {
  for (const match of line.matchAll(/\{\{(f\d+)\}\}/g)) {
    order.push({ token: match[1], paragraph });
  }
}

console.log(`slots found in the preview: ${order.length}`);

const duplicated = order
  .map((slot) => slot.token)
  .filter((token, at, all) => all.indexOf(token) !== at);
console.log(`tokens appearing more than once: ${duplicated.length}`);

const unclaimed = order.filter((slot) => !FIELD_BY_TOKEN[slot.token]);
console.log(`slots with no field behind them: ${unclaimed.length}`);

const byField = new Map<string, { token: string; paragraph: number }[]>();
for (const slot of order) {
  const field = FIELD_BY_TOKEN[slot.token];
  if (!field) continue;
  byField.set(field.id, [...(byField.get(field.id) ?? []), slot]);
}

const missing = ALL_FIELDS.filter((field) => !byField.has(field.id));
console.log(`fields with nowhere to jump to: ${missing.length}`);
for (const field of missing) console.log(`  ${field.id}`);

console.log("\n--- fields filling more than one place ---");
for (const field of ALL_FIELDS) {
  const slots = byField.get(field.id);
  if (!slots || slots.length < 2) continue;

  const jumpsTo = slots[0];
  const lowestNumber = [...slots].sort(
    (a, b) => Number(a.token.slice(1)) - Number(b.token.slice(1)),
  )[0];
  const naiveWouldDiffer = lowestNumber.token !== jumpsTo.token;

  console.log(
    `${field.id.padEnd(16)} ×${slots.length}  jumps to ${jumpsTo.token} (paragraph ${jumpsTo.paragraph})` +
      (naiveWouldDiffer ? `  <- lowest-numbered would be ${lowestNumber.token}, WRONG` : ""),
  );
}
