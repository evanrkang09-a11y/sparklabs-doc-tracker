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
import { type AgreementValues } from "./agreement-fields";
import { getContract, type ContractType } from "./contracts";
import { readLayout, type DocxLayout } from "./docx-layout";

function templatePath(type: ContractType): string {
  const file = getContract(type).templateFile;
  if (!file) throw new Error(`No template prepared for contract type: ${type}`);
  return path.join(process.cwd(), "templates", file);
}

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
const templateCaches = new Map<ContractType, Promise<Record<string, Uint8Array>>>();

function templateParts(type: ContractType): Promise<Record<string, Uint8Array>> {
  let cached = templateCaches.get(type);
  if (!cached) {
    cached = readFile(templatePath(type))
      .then((buffer) => unzipSync(new Uint8Array(buffer)))
      .catch((problem) => {
        // Don't cache a failure - a transient read error would otherwise break
        // the feature until the instance recycled.
        templateCaches.delete(type);
        throw problem;
      });
    templateCaches.set(type, cached);
  }
  return cached;
}

export type FilledDocx = {
  bytes: Uint8Array;
  /** Tokens that had no value and remain visible in the output. */
  unfilled: string[];
};

export async function fillAgreement(
  type: ContractType,
  values: AgreementValues,
): Promise<FilledDocx> {
  // A shallow copy: zipSync would otherwise write back into the cached parts,
  // and the next request would inherit this contract's values.
  const parts = { ...(await templateParts(type)) };

  const replacements = getContract(type).spec.tokenValues(values);
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const unfilled = new Set<string>();

  for (const name of Object.keys(parts)) {
    if (!TEXT_PARTS.test(name)) continue;

    let xml = decoder.decode(parts[name]);
    if (!xml.includes("{{")) continue;

    xml = xml.replace(/\{\{([a-z]{1,4}\d+)\}\}/g, (whole, token: string) => {
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

/** The parsed layout per contract type, built once - same for every company. */
const layoutCaches = new Map<ContractType, DocxLayout>();

/**
 * The template as a drawable layout, for the on-screen preview.
 *
 * Parsed on the server: the .docx lives on disk, and doing it here means the
 * browser is handed a small tree of paragraphs instead of a zip.
 */
export async function templateLayout(type: ContractType): Promise<DocxLayout> {
  const cached = layoutCaches.get(type);
  if (cached) return cached;
  const layout = readLayout(await templateParts(type));
  layoutCaches.set(type, layout);
  return layout;
}
