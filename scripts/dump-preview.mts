/**
 * Prints what the contract preview actually shows.
 *
 * The screen was reported as showing raw WordprocessingML rather than contract
 * text, so this looks at the same strings the preview renders - and at the raw
 * XML behind one bad paragraph, to tell a broken template from a broken reader.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { unzipSync } from "fflate";
import { templateParagraphs } from "../lib/agreement-docx.ts";

const paragraphs = await templateParagraphs();
const withMarkup = paragraphs.filter((line) => /<\/?w[a-z0-9]*:/.test(line));

console.log(`paragraphs: ${paragraphs.length}`);
console.log(`paragraphs containing XML markup: ${withMarkup.length}`);

// The raw XML for the first offending paragraph. If the template itself were
// broken, the markup would appear escaped (&lt;) inside a <w:t> - if the reader
// is broken, the XML is perfectly ordinary.
const parts = unzipSync(
  new Uint8Array(
    await readFile(path.join(process.cwd(), "templates", "investment-agreement.docx")),
  ),
);
const xml = new TextDecoder().decode(parts["word/document.xml"]);

const at = xml.indexOf("{{f78}}");
console.log("\n--- raw XML around the first bad paragraph ---");
console.log(xml.slice(at - 60, at + 520));

console.log("\n--- escaped markup inside text nodes? ---");
console.log(`occurrences of "&lt;/w:r&gt;": ${xml.split("&lt;/w:r&gt;").length - 1}`);
console.log(`self-closing <w:t .../> tags: ${(xml.match(/<w:t\b[^>]*\/>/g) ?? []).length}`);
console.log(`self-closing <w:p .../> tags: ${(xml.match(/<w:p\b[^>]*\/>/g) ?? []).length}`);
