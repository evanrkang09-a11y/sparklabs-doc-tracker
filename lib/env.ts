/**
 * One way to read an environment variable, for the whole app.
 *
 * Every value here arrives by being pasted into a dashboard or piped through a
 * shell, and both routes attach invisible characters. A byte-order mark on the
 * front of a value is invisible in every UI that would show it to you, so the
 * value looks perfect while nothing matches it.
 *
 * That has cost this project real time twice: once on the Google Drive service
 * account, once on the OAuth client id, where it produced "OAuth client was not
 * found" against an id that was character-for-character correct on screen.
 *
 * So: strip it here, once, and have every env read go through this.
 */

/**
 * U+FEFF, written as an escape on purpose. Typing the literal character here
 * would put an invisible character in the source of the invisible-character
 * fix, which nobody would be able to see or review.
 */
const BOM = /^\uFEFF/;

/** Reads an env var with invisible junk removed. Returns "" when unset. */
export function readEnv(name: string): string {
  return (process.env[name] ?? "").replace(BOM, "").trim();
}

/** Same, but falls back when the variable is unset or blank. */
export function readEnvOr(name: string, fallback: string): string {
  return readEnv(name) || fallback;
}

/** Reads a comma-separated env var into a lowercased list. Empty when unset. */
export function readEnvList(name: string): string[] {
  return readEnv(name)
    .split(",")
    .map((entry) => entry.replace(BOM, "").trim().toLowerCase())
    .filter(Boolean);
}
