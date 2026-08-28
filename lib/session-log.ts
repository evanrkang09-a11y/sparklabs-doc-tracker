/**
 * Per-user activity log, stored in Vercel Blob.
 *
 * sessions/{email-slug}.json holds the last 30 events for that user,
 * grouped by calendar day so the recap widget can show "what you did last time".
 */

import { get, put } from "@vercel/blob";

export type SessionEvent = {
  time: string; // ISO timestamp
  action: string; // human-readable, e.g. "Viewed agreement for Acme Corp"
  dealId?: string;
};

export type DayGroup = {
  date: string; // YYYY-MM-DD
  events: SessionEvent[];
};

const MAX_DAYS = 10;
const MAX_EVENTS_PER_DAY = 20;

function emailSlug(email: string): string {
  return email
    .toLowerCase()
    .replace(/[@.]/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function pathFor(email: string): string {
  return `sessions/${emailSlug(email)}.json`;
}

async function readLog(email: string): Promise<DayGroup[]> {
  try {
    const found = await get(pathFor(email), {
      access: "private",
      useCache: false,
    });
    if (!found) return [];
    return (await new Response(found.stream).json()) as DayGroup[];
  } catch {
    return [];
  }
}

async function writeLog(email: string, days: DayGroup[]): Promise<void> {
  await put(pathFor(email), JSON.stringify(days, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

/** Appends an event for the user. Keeps only the last MAX_DAYS days. */
export async function logEvent(
  email: string,
  action: string,
  dealId?: string,
): Promise<void> {
  try {
    const days = await readLog(email);
    const today = new Date().toISOString().slice(0, 10);
    const event: SessionEvent = {
      time: new Date().toISOString(),
      action,
      ...(dealId ? { dealId } : {}),
    };

    const dayIdx = days.findIndex((d) => d.date === today);
    if (dayIdx >= 0) {
      const existing = days[dayIdx].events;
      // Deduplicate identical back-to-back actions within the same day.
      const last = existing[existing.length - 1];
      if (last?.action !== action) {
        days[dayIdx].events = [...existing, event].slice(-MAX_EVENTS_PER_DAY);
      }
    } else {
      days.push({ date: today, events: [event] });
    }

    // Keep most-recent days, sorted newest first.
    const trimmed = days
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, MAX_DAYS);
    await writeLog(email, trimmed);
  } catch {
    // Logging is best-effort — never break a user action over it.
  }
}

/** Returns the last N day groups for the recap widget. */
export async function getRecentActivity(
  email: string,
  maxDays = 3,
): Promise<DayGroup[]> {
  const days = await readLog(email);
  return days
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, maxDays);
}
