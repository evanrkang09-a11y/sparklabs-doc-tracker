/**
 * Checks the zip reader against a real archive before it goes anywhere near
 * production - specifically that Korean filenames survive.
 *
 * Usage (Node 24 strips the types itself):
 *   node scripts/test-unzip.ts "<path to zip>"
 */

import { readFile } from "node:fs/promises";
import { unzip } from "../lib/unzip.ts";

const path = process.argv[2];
if (!path) {
  console.error('Usage: node scripts/test-unzip.ts "<zip>"');
  process.exit(1);
}

const bytes = new Uint8Array(await readFile(path));
console.log(`archive: ${(bytes.length / 1024 / 1024).toFixed(1)} MB\n`);

const entries = unzip(bytes);
console.log(`${entries.length} file(s) extracted:\n`);

for (const entry of entries) {
  const kb = (entry.data.length / 1024).toFixed(0);
  // A PDF starts with %PDF - a quick check that the bytes are really the file
  // and not a half-decompressed mess.
  const head = new TextDecoder().decode(entry.data.subarray(0, 4));
  const looksRight = entry.name.toLowerCase().endsWith(".pdf")
    ? head === "%PDF"
      ? "ok"
      : "SUSPECT"
    : "";

  console.log(`  ${entry.name.padEnd(45)} ${kb.padStart(6)} KB  ${looksRight}`);
}
