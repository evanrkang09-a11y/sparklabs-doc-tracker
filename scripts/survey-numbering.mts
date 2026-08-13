/**
 * How is the contract's clause numbering defined?
 *
 * 274 paragraphs carry <w:numPr>, so a preview without resolved numbering loses
 * the clause numbers - which in a contract is most of the structure.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { unzipSync } from "fflate";

const parts = unzipSync(
  new Uint8Array(
    await readFile(path.join(process.cwd(), "templates", "investment-agreement.docx")),
  ),
);

const decoder = new TextDecoder();
const document = decoder.decode(parts["word/document.xml"]);
const numbering = decoder.decode(parts["word/numbering.xml"]);

console.log("--- numIds actually used in the document ---");
const used = new Map<string, number>();
for (const match of document.matchAll(/<w:numPr>[\s\S]*?<\/w:numPr>/g)) {
  const numId = match[0].match(/<w:numId w:val="(\d+)"/)?.[1] ?? "?";
  const ilvl = match[0].match(/<w:ilvl w:val="(\d+)"/)?.[1] ?? "0";
  const key = `numId ${numId} · level ${ilvl}`;
  used.set(key, (used.get(key) ?? 0) + 1);
}
for (const [key, n] of [...used].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${key.padEnd(26)} ${n} paragraphs`);
}

console.log("\n--- number formats defined in numbering.xml ---");
const formats = new Map<string, number>();
for (const match of numbering.matchAll(/<w:numFmt w:val="([^"]+)"/g)) {
  formats.set(match[1], (formats.get(match[1]) ?? 0) + 1);
}
for (const [value, n] of [...formats].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${value.padEnd(24)} ${n}`);
}

console.log("\n--- lvlText patterns (first 20) ---");
const texts = new Map<string, number>();
for (const match of numbering.matchAll(/<w:lvlText w:val="([^"]*)"/g)) {
  texts.set(match[1], (texts.get(match[1]) ?? 0) + 1);
}
for (const [value, n] of [...texts].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
  console.log(`  ${JSON.stringify(value).padEnd(20)} ${n}`);
}

console.log("\n--- one full level definition, for shape ---");
const first = [...used.keys()][0];
const firstNumId = first.match(/numId (\d+)/)?.[1];
const num = numbering.match(
  new RegExp(`<w:num w:numId="${firstNumId}"[\\s\\S]*?</w:num>`),
);
console.log(num?.[0] ?? "num not found");

const abstractId = num?.[0].match(/<w:abstractNumId w:val="(\d+)"/)?.[1];
const abstract = numbering.match(
  new RegExp(`<w:abstractNum w:abstractNumId="${abstractId}"[\\s\\S]*?</w:abstractNum>`),
);
console.log(`\nabstractNum ${abstractId}, level 0 and 1:`);
const levels = [...(abstract?.[0].matchAll(/<w:lvl w:ilvl="[01]"[\s\S]*?<\/w:lvl>/g) ?? [])];
for (const level of levels) console.log(`\n${level[0]}`);
