/**
 * What formatting does the contract actually use?
 *
 * Written before building the renderer, so the renderer covers what is really
 * in this document instead of everything WordprocessingML can express.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { unzipSync } from "fflate";

const parts = unzipSync(
  new Uint8Array(
    await readFile(path.join(process.cwd(), "templates", "investment-agreement.docx")),
  ),
);

console.log("--- parts in the archive ---");
for (const name of Object.keys(parts).sort()) {
  console.log(`  ${name}  (${parts[name].length} bytes)`);
}

const xml = new TextDecoder().decode(parts["word/document.xml"]);

function count(label: string, pattern: RegExp) {
  console.log(`${label.padEnd(34)} ${(xml.match(pattern) ?? []).length}`);
}

console.log("\n--- structure ---");
count("<w:p> paragraphs", /<w:p\b(?![^>]*\/>)/g);
count("<w:tbl> tables", /<w:tbl>/g);
count("<w:tr> table rows", /<w:tr\b/g);
count("<w:tc> table cells", /<w:tc>/g);
count("<w:sdt> content controls", /<w:sdt>/g);
count("<w:hyperlink>", /<w:hyperlink\b/g);
count("<w:drawing> images", /<w:drawing>/g);
count("<w:sectPr> sections", /<w:sectPr\b/g);

console.log("\n--- paragraph formatting ---");
count("pageBreakBefore", /<w:pageBreakBefore\b/g);
count('<w:br w:type="page">', /<w:br w:type="page"\s*\/>/g);
count("<w:numPr> list numbering", /<w:numPr>/g);
count("<w:pStyle>", /<w:pStyle\b/g);
count("<w:ind> indents", /<w:ind\b/g);
count("<w:jc> alignment", /<w:jc\b/g);

console.log("\n--- alignment values used ---");
const aligns = new Map<string, number>();
for (const match of xml.matchAll(/<w:jc w:val="([^"]+)"/g)) {
  aligns.set(match[1], (aligns.get(match[1]) ?? 0) + 1);
}
for (const [value, n] of [...aligns].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${value.padEnd(12)} ${n}`);
}

console.log("\n--- paragraph styles used ---");
const styles = new Map<string, number>();
for (const match of xml.matchAll(/<w:pStyle w:val="([^"]+)"/g)) {
  styles.set(match[1], (styles.get(match[1]) ?? 0) + 1);
}
for (const [value, n] of [...styles].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`  ${value.padEnd(24)} ${n}`);
}

console.log("\n--- run formatting ---");
count("<w:b/> bold", /<w:b\s*\/>/g);
count("<w:i/> italic", /<w:i\s*\/>/g);
count("<w:u> underline", /<w:u\b/g);
count("<w:strike>", /<w:strike\b/g);
count("<w:sz> font size", /<w:sz\b/g);
count("<w:color>", /<w:color\b/g);
count("<w:vertAlign> super/subscript", /<w:vertAlign\b/g);

console.log("\n--- font sizes used (half-points) ---");
const sizes = new Map<string, number>();
for (const match of xml.matchAll(/<w:sz w:val="(\d+)"/g)) {
  sizes.set(match[1], (sizes.get(match[1]) ?? 0) + 1);
}
for (const [value, n] of [...sizes].sort((a, b) => Number(a[0]) - Number(b[0]))) {
  console.log(`  ${(Number(value) / 2).toString().padEnd(6)}pt  ${n}`);
}

console.log("\n--- page setup (sectPr) ---");
const sect = xml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
console.log(sect ? sect[0] : "none found");

console.log("\n--- numbering.xml present? ---");
console.log(parts["word/numbering.xml"] ? "yes" : "no");
