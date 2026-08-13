/**
 * Renders the contract view to a standalone HTML file.
 *
 * Two reasons this exists. It proves the component runs without throwing before
 * anything is deployed - and it produces something a person can open in a
 * browser and compare against the Word document side by side, which is the only
 * way to check "does this look like the contract" from outside a browser.
 *
 *   npx tsx scripts/render-contract.mts
 *   start contract-preview.html
 */

import { writeFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { templateLayout } from "../lib/agreement-docx.ts";
import { defaultValues, FIELD_BY_TOKEN, tokenValues } from "../lib/agreement-fields.ts";
import * as view from "../app/agreement/[dealId]/contract-view.tsx";

// The component file is a "use client" module; loaded outside a bundler its
// default export can arrive nested, so take whichever shape turned up.
const ContractView = (
  typeof view.default === "function" ? view.default : (view as { default: { default: unknown } }).default.default
) as (props: Record<string, unknown>) => React.ReactElement;

const layout = await templateLayout();

// Standard terms only, the way a fresh contract opens.
const replacements = tokenValues(defaultValues());

const body = renderToStaticMarkup(
  createElement(ContractView, {
    layout,
    replacements,
    active: null,
    label: (token: string) => FIELD_BY_TOKEN[token]?.labelKo ?? `{{${token}}}`,
  }),
);

// Tailwind classes carry the slot highlighting, which isn't available here, so
// the few that matter are inlined. Everything structural is inline styles
// already and comes through as-is.
const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>contract preview (offline render)</title>
<style>
  body { margin: 0; padding: 24px; background: #f5f5f5; }
  .rounded { border-radius: 3px; }
  .border { border-width: 1px; border-style: solid; }
  .border-dashed { border-style: dashed; }
  .border-neutral-400 { border-color: #a3a3a3; }
  .text-neutral-500 { color: #737373; }
  .px-1 { padding-left: 3px; padding-right: 3px; }
</style>
</head>
<body>${body}</body>
</html>
`;

await writeFile("contract-preview.html", html, "utf8");

console.log(`rendered: contract-preview.html  (${Math.round(html.length / 1024)} KB)`);
console.log(`paragraph elements: ${(body.match(/<p[ >]/g) ?? []).length}`);
console.log(`tables: ${(body.match(/<table/g) ?? []).length}`);
console.log(`slots: ${(body.match(/data-token=/g) ?? []).length}`);
console.log(`bold runs: ${(body.match(/font-weight:600/g) ?? []).length}`);
console.log(`centred paragraphs: ${(body.match(/text-align:center/g) ?? []).length}`);
console.log("\nOpen it next to the Word file to compare:  start contract-preview.html");
