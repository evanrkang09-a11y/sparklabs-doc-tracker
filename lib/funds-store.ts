/**
 * Dynamic fund list — persisted to config/funds.json in Blob.
 *
 * Seeded from the static FUNDS array on first access. Admins can add new funds
 * via the UI; each fund can optionally have a Drive folder created for it.
 */

import { get, put } from "@vercel/blob";
import { FUNDS as SEED_FUNDS, type Fund } from "./funds";

const PATH = "config/funds.json";

type FundRegistry = {
  funds: Fund[];
};

async function read(): Promise<FundRegistry> {
  const found = await get(PATH, { access: "private", useCache: false });
  if (!found?.stream) return { funds: SEED_FUNDS };

  try {
    const parsed: unknown = JSON.parse(await new Response(found.stream).text());
    if (typeof parsed !== "object" || parsed === null) return { funds: SEED_FUNDS };
    const raw = parsed as { funds?: unknown };
    const funds = Array.isArray(raw.funds) ? (raw.funds as Fund[]).filter(isValidFund) : SEED_FUNDS;
    return { funds };
  } catch {
    return { funds: SEED_FUNDS };
  }
}

function isValidFund(f: unknown): f is Fund {
  if (typeof f !== "object" || f === null) return false;
  const r = f as Record<string, unknown>;
  return typeof r.id === "string" && typeof r.name === "string";
}

async function write(registry: FundRegistry): Promise<void> {
  await put(PATH, JSON.stringify(registry, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

export async function listFunds(): Promise<Fund[]> {
  return (await read()).funds;
}

export async function isValidFundId(id: unknown): Promise<boolean> {
  if (typeof id !== "string" || !id) return false;
  const funds = await listFunds();
  return funds.some((f) => f.id === id);
}

export type NewFund = {
  name: string;
  category: string;
  currency: string;
  driveFolderId?: string;
};

export async function createFund(input: NewFund): Promise<Fund> {
  const registry = await read();

  const base = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const existing = new Set(registry.funds.map((f) => f.id));
  let id = base;
  let n = 2;
  while (existing.has(id)) {
    id = `${base}-${n++}`;
  }

  const fund: Fund = {
    id,
    name: input.name.trim(),
    category: input.category.trim() || "Other",
    currency: input.currency.trim() || "KRW",
    ...(input.driveFolderId ? { driveFolderId: input.driveFolderId } : {}),
  };

  registry.funds = [...registry.funds, fund];
  await write(registry);
  return fund;
}
