/**
 * Filling the contract template and producing a .docx.
 *
 * The hard part was done offline by scripts/prepare-template (see
 * python-practice/prepare_template.py): every placeholder in the mentor's file
 * is already a single clean {{token}} run. So filling here is a string replace
 * on one XML part, and the rest of the document - styles, fonts, headers, the
 * appendices, the page layout the lawyers care about - passes through untouched.
 *
 * That is the point of the design. Rebuilding a contract's formatting in code
 * would be both a lot of work and impossible to trust; copying the original and
 * changing 77 spans is verifiable.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { unzipSync, zipSync } from "fflate";
import { tokenValues, type AgreementValues } from "./agreement-fields";

const TEMPLATE_PATH = path.join(process.cwd(), "templates", "investment-agreement.docx");
const DOCUMENT_PART = "word/document.xml";

/** Parts whose text may contain tokens. Headers and footers can quote parties. */
const TEXT_PARTS = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/;

/**
 * XML-escapes a value before it goes into document.xml.
 *
 * Company names contain ampersands and quotes often enough to matter, and an
 * unescaped one produces a file Word refuses to open - which would look like
 * the whole feature was broken rather than one character being wrong.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * The template, read and unzipped once per server instance.
 *
 * It's a 2MB archive that never changes between deployments, so reading and
 * inflating it on every page load and every download is pure waste. Cached as a
 * promise so concurrent requests share one read rather than racing.
 */
let templateCache: Promise<Record<string, Uint8Array>> | null = null;

function templateParts(): Promise<Record<string, Uint8Array>> {
  templateCache ??= readFile(TEMPLATE_PATH)
    .then((buffer) => unzipSync(new Uint8Array(buffer)))
    .catch((problem) => {
      // Don't cache a failure - a transient read error would otherwise break
      // the feature until the instance recycled.
      templateCache = null;
      throw problem;
    });

  return templateCache;
}

export type FilledDocx = {
  bytes: Uint8Array;
  /** Tokens that had no value and remain visible in the output. */
  unfilled: string[];
};

export async function fillAgreement(values: AgreementValues): Promise<FilledDocx> {
  // A shallow copy: zipSync would otherwise write back into the cached parts,
  // and the next request would inherit this contract's values.
  const parts = { ...(await templateParts()) };

  const replacements = tokenValues(values);
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const unfilled = new Set<string>();

  for (const name of Object.keys(parts)) {
    if (!TEXT_PARTS.test(name)) continue;

    let xml = decoder.decode(parts[name]);
    if (!xml.includes("{{f")) continue;

    xml = xml.replace(/\{\{(f\d+)\}\}/g, (whole, token: string) => {
      const value = replacements[token];
      if (value === undefined) {
        // Left in place on purpose: a visible {{f12}} says "this was never
        // filled", where a blank would read as a deliberately empty term.
        unfilled.add(token);
        return whole;
      }
      return escapeXml(value);
    });

    parts[name] = encoder.encode(xml);
  }

  // mimetype-style ordering doesn't matter for docx, but deflate does - Word is
  // happy with a normally compressed archive.
  const bytes = zipSync(parts, { level: 6 });

  return { bytes, unfilled: [...unfilled].sort() };
}

/** The preview text, parsed once - it's the same for every company. */
let paragraphCache: string[] | null = null;

/** Reads the template's plain text, for the on-screen preview. */
export async function templateParagraphs(): Promise<string[]> {
  if (paragraphCache) return paragraphCache;

  const parts = await templateParts();
  const xml = new TextDecoder().decode(parts[DOCUMENT_PART]);

  // One entry per <w:p>, with its runs concatenated. Enough for a readable
  // preview; the .docx download is what carries the real formatting.
  paragraphCache = [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)]
    .map((match) =>
      [...match[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
        .map((run) => unescapeXml(run[1]))
        .join(""),
    )
    .map((line) => line.trimEnd());

  return paragraphCache;
}

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
