/**
 * Turning a caught value into something worth showing someone.
 *
 * Lives on its own rather than in lib/deal-status.ts because client components
 * need it too, and that module pulls in googleapis - importing it from the
 * browser would drag the whole Google SDK into the bundle.
 */

/** The message from an Error, or a fallback for whatever else was thrown. */
export function describe(problem: unknown, fallback = "unknown error"): string {
  return problem instanceof Error ? problem.message : fallback;
}
