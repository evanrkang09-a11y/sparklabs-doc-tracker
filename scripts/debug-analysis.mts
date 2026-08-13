/**
 * Reproduces the exact request lib/analysis.ts sends, against the real
 * documents, and prints the whole error body instead of the wrapper.
 *
 * "Provider returned error" tells you nothing; this is here to find out what
 * the provider actually said.
 *
 * Usage:
 *   node --env-file=.env.local scripts/debug-analysis.ts "<zip>"
 */

import { readFile } from "node:fs/promises";
import { unzip } from "../lib/unzip";

const zipPath = process.argv[2];
const key = process.env.OPENROUTER_API_KEY?.trim();
if (!zipPath || !key) {
  console.error("Usage: node --env-file=.env.local scripts/debug-analysis.ts <zip>");
  process.exit(1);
}

const entries = unzip(new Uint8Array(await readFile(zipPath)));

// The two documents the share-count check reads.
const wanted = entries.filter(
  (e) => e.name.includes("등기사항") || e.name.includes("주주명부"),
);
console.log("sending:", wanted.map((e) => `${e.name} (${(e.data.length / 1024).toFixed(0)}KB)`));

const SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["met", "issues", "unclear"] },
    confidence: { type: "number" },
    summaryKo: { type: "string" },
    summaryEn: { type: "string" },
    keyFacts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          labelKo: { type: "string" },
          labelEn: { type: "string" },
          value: { type: "string" },
          source: { type: "string" },
        },
        required: ["labelKo", "labelEn", "value", "source"],
        additionalProperties: false,
      },
    },
    issuesKo: { type: "array", items: { type: "string" } },
    issuesEn: { type: "array", items: { type: "string" } },
    instructionsKo: { type: "array", items: { type: "string" } },
    instructionsEn: { type: "array", items: { type: "string" } },
  },
  required: [
    "verdict", "confidence", "summaryKo", "summaryEn", "keyFacts",
    "issuesKo", "issuesEn", "instructionsKo", "instructionsEn",
  ],
  additionalProperties: false,
};

async function attempt(
  label: string,
  tweak: (body: Record<string, unknown>) => void,
  mime = "application/pdf",
) {
  const content: unknown[] = [
    { type: "text", text: "발행주식수와 액면가가 등기부등본과 주주명부에서 일치하는지 확인하세요." },
  ];
  for (const e of wanted) {
    content.push({
      type: "file",
      file: {
        filename: e.name,
        file_data: `data:${mime};base64,${Buffer.from(e.data).toString("base64")}`,
      },
    });
  }

  const body: Record<string, unknown> = {
    model: "google/gemini-2.5-flash-lite",
    max_tokens: 2500,
    messages: [
      { role: "system", content: "You assist with Korean VC document due diligence." },
      { role: "user", content },
    ],
    plugins: [{ id: "file-parser", pdf: { engine: "native" } }],
    response_format: { type: "json_schema", json_schema: { name: "analysis", strict: true, schema: SCHEMA } },
  };
  tweak(body);

  const started = Date.now();
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const parsed = await response.json();
  console.log(`\n=== ${label} — HTTP ${response.status} (${Date.now() - started}ms)`);

  if (!response.ok || parsed.error) {
    console.log(JSON.stringify(parsed, null, 2).slice(0, 1500));
    return;
  }

  const text = parsed.choices?.[0]?.message?.content ?? "";
  console.log(`tokens in=${parsed.usage?.prompt_tokens} out=${parsed.usage?.completion_tokens}`);
  console.log(text.slice(0, 600));
}

// The suspicion: a file uploaded without a .pdf extension gets stored as
// application/octet-stream, and the data URL then claims it isn't a PDF.
await attempt("declared as application/pdf", () => {}, "application/pdf");
await attempt("declared as octet-stream", () => {}, "application/octet-stream");
await attempt("filename without .pdf, declared pdf", (b) => {
  const msg = (b.messages as { content: { type: string; file?: { filename: string } }[] }[])[1];
  for (const part of msg.content) {
    if (part.type === "file" && part.file) part.file.filename = part.file.filename.replace(/\.pdf$/, "");
  }
}, "application/pdf");
