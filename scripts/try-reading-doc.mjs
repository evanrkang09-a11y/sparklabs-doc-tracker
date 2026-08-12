/**
 * Can a cheap model actually read a real Korean scanned document?
 *
 * Everything in the AI due-diligence feature rests on this working, so it gets
 * checked against a real scan before anything is built on top. The test file is
 * the 제스트 사업자등록증 - a photocopied Korean government form, which is the
 * hardest realistic case: no text layer, small print, official formatting.
 *
 * Usage:
 *   node --env-file=.env.local scripts/try-reading-doc.mjs "<path to pdf>"
 */

import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const MODELS = ["google/gemini-2.5-flash-lite", "openai/gpt-5-nano"];

const path = process.argv[2];
if (!path) {
  console.error('Usage: node --env-file=.env.local scripts/try-reading-doc.mjs "<pdf>"');
  process.exit(1);
}

const key = process.env.OPENROUTER_API_KEY?.trim();
if (!key) {
  console.error("OPENROUTER_API_KEY is not set");
  process.exit(1);
}

const bytes = await readFile(path);
const dataUrl = `data:application/pdf;base64,${bytes.toString("base64")}`;
console.log(`${basename(path)} — ${(bytes.length / 1024).toFixed(0)} KB\n`);

const SCHEMA = {
  type: "object",
  properties: {
    documentType: { type: "string" },
    companyName: { type: ["string", "null"] },
    registrationNumber: { type: ["string", "null"] },
    businessTypes: { type: "array", items: { type: "string" } },
    readable: { type: "boolean" },
  },
  required: ["documentType", "companyName", "registrationNumber", "businessTypes", "readable"],
  additionalProperties: false,
};

for (const model of MODELS) {
  const started = Date.now();
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "이 서류를 읽고 무슨 서류인지, 회사명, 등록번호, 그리고 '사업의 종류'에 적힌 업태/종목을 모두 추출하세요. 읽을 수 없으면 readable=false.",
              },
              { type: "file", file: { filename: basename(path), file_data: dataUrl } },
            ],
          },
        ],
        // native = the model reads the PDF itself. mistral-ocr costs $2/1000
        // pages; if native handles scans we don't need to pay that.
        plugins: [{ id: "file-parser", pdf: { engine: "native" } }],
        response_format: {
          type: "json_schema",
          json_schema: { name: "extract", strict: true, schema: SCHEMA },
        },
      }),
    });

    const body = await response.json();
    if (!response.ok) throw new Error(body?.error?.message ?? `HTTP ${response.status}`);

    const text = (body.choices?.[0]?.message?.content ?? "")
      .replace(/^```(?:json)?\s*|\s*```$/g, "")
      .trim();

    console.log(`${model}  (${Date.now() - started}ms, in=${body.usage?.prompt_tokens} out=${body.usage?.completion_tokens})`);
    console.log(JSON.stringify(JSON.parse(text), null, 2));
    console.log("");
  } catch (problem) {
    console.log(`${model}\n  FAILED: ${problem.message}\n`);
  }
}
