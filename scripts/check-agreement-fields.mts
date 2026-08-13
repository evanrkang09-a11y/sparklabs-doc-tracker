/**
 * Every token in the template must be claimed by exactly one field.
 *
 * An unclaimed token is a placeholder nobody can fill, which ships as a visible
 * {{f34}} in a signed contract. A token claimed twice means two inputs fight
 * over the same spot. Both are silent unless checked.
 *
 *   node scripts/check-agreement-fields.ts
 */

import { readFile } from "node:fs/promises";
import { ALL_FIELDS } from "../lib/agreement-fields";

const manifest = JSON.parse(
  await readFile("templates/agreement-manifest.json", "utf8"),
) as { token: string; sample: string; context: string }[];

const claimed = new Map<string, string[]>();
for (const field of ALL_FIELDS) {
  for (const token of field.tokens) {
    claimed.set(token, [...(claimed.get(token) ?? []), field.id]);
  }
}

const inTemplate = new Set(manifest.map((row) => row.token));

const unclaimed = manifest.filter((row) => !claimed.has(row.token));
const twice = [...claimed].filter(([, fields]) => fields.length > 1);
const ghosts = [...claimed.keys()].filter((token) => !inTemplate.has(token));

console.log(`tokens in template : ${inTemplate.size}`);
console.log(`fields defined     : ${ALL_FIELDS.length}`);
console.log(`tokens claimed     : ${claimed.size}`);

if (unclaimed.length) {
  console.log(`\nUNCLAIMED (${unclaimed.length}) - nobody can fill these:`);
  for (const row of unclaimed) {
    console.log(`  ${row.token}  ${row.sample}  ${row.context.slice(0, 70)}`);
  }
}

if (twice.length) {
  console.log(`\nCLAIMED TWICE (${twice.length}):`);
  for (const [token, fields] of twice) console.log(`  ${token} <- ${fields.join(", ")}`);
}

if (ghosts.length) {
  console.log(`\nFIELDS POINTING AT MISSING TOKENS (${ghosts.length}):`);
  for (const token of ghosts) console.log(`  ${token} <- ${claimed.get(token)!.join(", ")}`);
}

if (!unclaimed.length && !twice.length && !ghosts.length) {
  console.log("\nevery token claimed exactly once");
}
