/**
 * Dev helper: drop a dummy file into a deal's Blob folder, to check that
 * uploading and matching work without going through a browser.
 *
 * Usage (from the project root):
 *   node --env-file=.env.local scripts/put-test-file.mjs <dealId> <filename>
 *
 * Delete it again with:
 *   npx vercel blob del "deals/<dealId>/<filename>"
 */

import { put } from "@vercel/blob";

const [dealId, filename] = process.argv.slice(2);

if (!dealId || !filename) {
  console.error("Usage: node --env-file=.env.local scripts/put-test-file.mjs <dealId> <filename>");
  process.exit(1);
}

const pathname = `deals/${dealId}/${filename}`;

const result = await put(pathname, "DUMMY TEST FILE - not a real document.\n", {
  access: "private",
  addRandomSuffix: false,
  contentType: "text/plain",
});

console.log(`uploaded: ${result.pathname}`);
