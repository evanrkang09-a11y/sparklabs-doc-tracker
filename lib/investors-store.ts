/**
 * Where the reusable investor profiles live.
 *
 * One JSON record in the private Blob store at config/investors.json, mirroring
 * lib/deals-store.ts. Same caveat: every write reads the whole record, changes
 * it and writes it back, so two people editing in the same second would have
 * the later save win. Fine for a team of a few editing occasionally.
 */

import { del, get, put } from "@vercel/blob";
import { toDealId } from "./deals";
import {
  cleanProfileValues,
  seedInvestorProfiles,
  type InvestorProfile,
} from "./investors";

const PATH = "config/investors.json";

async function read(): Promise<InvestorProfile[]> {
  // useCache: false so a save is immediately visible on reload.
  const found = await get(PATH, { access: "private", useCache: false });

  if (!found?.stream) return seedInvestorProfiles();

  try {
    const raw: unknown = JSON.parse(await new Response(found.stream).text());
    return sanitize(raw);
  } catch {
    return seedInvestorProfiles();
  }
}

async function write(profiles: InvestorProfile[]): Promise<void> {
  await put(PATH, JSON.stringify({ profiles }, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

export async function listInvestorProfiles(): Promise<InvestorProfile[]> {
  return read();
}

export async function getInvestorProfile(
  id: string,
): Promise<InvestorProfile | undefined> {
  return (await read()).find((profile) => profile.id === id);
}

export type ProfileInput = {
  label: string;
  values: Record<string, string>;
};

export async function createInvestorProfile(
  input: ProfileInput,
): Promise<InvestorProfile> {
  const profiles = await read();

  const label = input.label.trim();
  if (!label) throw new Error("A profile name is required");

  const profile: InvestorProfile = {
    id: uniqueId(
      toDealId(label),
      profiles.map((p) => p.id),
    ),
    label,
    values: cleanProfileValues(input.values),
    createdAt: new Date().toISOString(),
  };

  await write([...profiles, profile]);
  return profile;
}

/** Applies a partial change to one profile. Id and createdAt are not editable. */
export async function updateInvestorProfile(
  id: string,
  changes: Partial<ProfileInput>,
): Promise<InvestorProfile> {
  const profiles = await read();
  const existing = profiles.find((profile) => profile.id === id);
  if (!existing) throw new Error(`Unknown investor profile: ${id}`);

  const updated: InvestorProfile = {
    ...existing,
    label: changes.label?.trim() || existing.label,
    values: changes.values ? cleanProfileValues(changes.values) : existing.values,
  };

  await write(profiles.map((profile) => (profile.id === id ? updated : profile)));
  return updated;
}

export async function deleteInvestorProfile(id: string): Promise<void> {
  const profiles = await read();
  await write(profiles.filter((profile) => profile.id !== id));
}

/** Throws away every profile. Only used to reset back to the seed. */
export async function clearInvestorProfiles(): Promise<void> {
  try {
    await del(PATH);
  } catch {
    // Nothing saved yet; not a failure.
  }
}

// --- helpers ---------------------------------------------------------------

/** Appends -2, -3 … until the id is free, so two funds can share a name. */
function uniqueId(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base;

  let suffix = 2;
  while (taken.includes(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

/** Whatever is on disk may be older or hand-edited; rebuild what we trust. */
function sanitize(raw: unknown): InvestorProfile[] {
  if (typeof raw !== "object" || raw === null) return seedInvestorProfiles();

  const { profiles } = raw as { profiles?: unknown };
  if (!Array.isArray(profiles)) return seedInvestorProfiles();

  const clean: InvestorProfile[] = profiles
    .filter(
      (p): p is InvestorProfile =>
        typeof p?.id === "string" && typeof p?.label === "string",
    )
    .map((p) => ({
      id: p.id,
      label: p.label,
      values: cleanProfileValues(p.values),
      createdAt: typeof p.createdAt === "string" ? p.createdAt : "",
    }));

  return clean;
}
