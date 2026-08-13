/**
 * Unpacking a ZIP of documents.
 *
 * People collect a company's paperwork in a folder and send the folder, so a
 * zip arrives as one 7MB file that matches no document and can't be read.
 *
 * The central directory is parsed by hand rather than handed to a library
 * wholesale, for one reason: filenames. A zip records whether its names are
 * UTF-8 in a flag bit, and zips made on Korean Windows usually don't set it -
 * the names are CP949 (EUC-KR). Decoding those as UTF-8 turns 주주명부.pdf into
 * mojibake, and a mojibake filename matches no document, which is the exact
 * problem we're trying to fix. Reading the flag ourselves lets us decode each
 * name the way it was actually written.
 */

import { inflateSync } from "fflate";

export type ZipEntry = {
  name: string;
  data: Uint8Array;
};

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

/** Bit 11 of the general purpose flags: filenames are UTF-8. */
const FLAG_UTF8 = 0x800;

/** Guard against a zip bomb - a few document scans, not a filesystem. */
const MAX_ENTRIES = 100;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;

export function unzip(buffer: Uint8Array): ZipEntry[] {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  const eocd = findEocd(view, buffer.length);
  if (eocd < 0) throw new Error("Not a zip file, or the archive is damaged");

  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);

  const entries: ZipEntry[] = [];
  let totalBytes = 0;

  for (let index = 0; index < Math.min(entryCount, MAX_ENTRIES); index += 1) {
    if (offset + 46 > buffer.length) break;
    if (view.getUint32(offset, true) !== SIG_CENTRAL) break;

    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);

    const nameBytes = buffer.subarray(offset + 46, offset + 46 + nameLength);
    const name = decodeName(nameBytes, (flags & FLAG_UTF8) !== 0);

    offset += 46 + nameLength + extraLength + commentLength;

    // Directory entries and the junk macOS puts in every archive.
    if (!name || name.endsWith("/") || name.startsWith("__MACOSX/")) continue;
    if (name.split("/").pop()?.startsWith("._")) continue;

    totalBytes += uncompressedSize;
    if (totalBytes > MAX_TOTAL_BYTES) break;

    const data = readLocalEntry(buffer, view, localOffset, method, compressedSize);
    if (data) {
      // Flatten any folder structure - what matters is the filename, and
      // "폴더/주주명부.pdf" would be stored as a path rather than a document.
      entries.push({ name: name.split("/").pop() ?? name, data });
    }
  }

  return entries;
}

function readLocalEntry(
  buffer: Uint8Array,
  view: DataView,
  localOffset: number,
  method: number,
  compressedSize: number,
): Uint8Array | null {
  if (localOffset + 30 > buffer.length) return null;
  if (view.getUint32(localOffset, true) !== SIG_LOCAL) return null;

  // The local header repeats the name and extra lengths, and they can differ
  // from the central directory's - the local ones are what the data follows.
  const nameLength = view.getUint16(localOffset + 26, true);
  const extraLength = view.getUint16(localOffset + 28, true);
  const start = localOffset + 30 + nameLength + extraLength;
  const raw = buffer.subarray(start, start + compressedSize);

  try {
    if (method === 0) return raw; // stored
    if (method === 8) return inflateSync(raw); // deflate
    return null; // anything else is rare enough to skip rather than guess at
  } catch {
    return null;
  }
}

/**
 * Decodes a filename, honouring the archive's own claim about its encoding.
 *
 * When the UTF-8 flag isn't set the bytes are in whatever code page the
 * creating machine used. EUC-KR is the one that matters here; it also covers
 * plain ASCII names, so it's a safe default for the non-UTF-8 case.
 */
function decodeName(bytes: Uint8Array, isUtf8: boolean): string {
  if (isUtf8) return new TextDecoder("utf-8").decode(bytes);

  try {
    return new TextDecoder("euc-kr").decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

/** The end-of-central-directory record sits at the end, after a variable comment. */
function findEocd(view: DataView, length: number): number {
  const earliest = Math.max(0, length - 0xffff - 22);

  for (let i = length - 22; i >= earliest; i -= 1) {
    if (view.getUint32(i, true) === SIG_EOCD) return i;
  }

  return -1;
}
