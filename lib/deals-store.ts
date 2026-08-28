/**
 * Where the list of companies and batches actually lives.
 *
 * One JSON record in the private Blob store at config/deals.json, holding both
 * lists together. Together rather than in two files because assigning a company
 * to a batch touches both, and a half-applied change would leave a company
 * pointing at a batch that doesn't exist.
 *
 * Caveat, same as the diligence store: every write reads the whole record,
 * changes it and writes it back, so two people adding a company in the same
 * second would have the later save win. Fine for a team of a few doing this
 * occasionally. Comments deliberately do NOT work this way - see
 * lib/comments-store.ts - because those really are written concurrently.
 */

import { get, put } from "@vercel/blob";
import { SEED_DEALS, toDealId, type Batch, type Deal } from "./deals";
import { isValidFundId } from "./funds-store";

const PATH = "config/deals.json";

type Registry = {
  deals: Deal[];
  batches: Batch[];
};

async function read(): Promise<Registry> {
  // useCache: false so a save is immediately visible - otherwise someone adds
  // a company and it isn't there when the page reloads.
  const found = await get(PATH, { access: "private", useCache: false });

  if (!found?.stream) return { deals: SEED_DEALS, batches: [] };

  const parsed: unknown = JSON.parse(await new Response(found.stream).text());
  return sanitize(parsed);
}

async function write(registry: Registry): Promise<void> {
  await put(PATH, JSON.stringify(registry, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

// --- reading ---------------------------------------------------------------

export async function listDeals(): Promise<Deal[]> {
  return (await read()).deals;
}

export async function listBatches(): Promise<Batch[]> {
  return (await read()).batches;
}

export async function getRegistry(): Promise<Registry> {
  return read();
}

export async function getDeal(id: string): Promise<Deal | undefined> {
  return (await read()).deals.find((deal) => deal.id === id);
}

// --- companies -------------------------------------------------------------

export type NewDeal = {
  companyKo: string;
  companyEn: string;
  market: Deal["market"];
  dealType: Deal["dealType"];
  batchId: string | null;
  fundId: string | null;
};

export async function createDeal(input: NewDeal): Promise<Deal> {
  const registry = await read();

  // Prefer the English name for the URL; fall back to the Korean one.
  const base = toDealId(input.companyEn || input.companyKo);
  const id = uniqueId(
    base,
    registry.deals.map((deal) => deal.id),
  );

  const deal: Deal = {
    id,
    companyKo: input.companyKo.trim(),
    companyEn: input.companyEn.trim(),
    market: input.market,
    dealType: input.dealType,
    batchId: input.batchId,
    fundId: (await isValidFundId(input.fundId)) ? input.fundId : null,
    archived: false,
    createdAt: new Date().toISOString(),
  };

  registry.deals = [...registry.deals, deal];
  await write(registry);
  return deal;
}

/** Applies a partial change to one company. Id and createdAt are not editable. */
export async function updateDeal(
  id: string,
  changes: Partial<Omit<Deal, "id" | "createdAt">>,
): Promise<Deal> {
  const registry = await read();
  const existing = registry.deals.find((deal) => deal.id === id);
  if (!existing) throw new Error(`Unknown company: ${id}`);

  const updated: Deal = { ...existing, ...changes, id: existing.id };
  registry.deals = registry.deals.map((deal) => (deal.id === id ? updated : deal));

  await write(registry);
  return updated;
}

/**
 * Removes the company from the list. Does NOT remove its uploaded documents or
 * diligence notes - the caller does that, so that "delete the record" and
 * "delete the files" are visibly two decisions.
 */
export async function deleteDeal(id: string): Promise<void> {
  const registry = await read();
  registry.deals = registry.deals.filter((deal) => deal.id !== id);
  await write(registry);
}

// --- batches ---------------------------------------------------------------

export async function createBatch(name: string, note?: string): Promise<Batch> {
  const registry = await read();

  const batch: Batch = {
    id: uniqueId(
      toDealId(name),
      registry.batches.map((b) => b.id),
    ),
    name: name.trim(),
    note: note?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  registry.batches = [...registry.batches, batch];
  await write(registry);
  return batch;
}

/**
 * Deleting a batch un-assigns its companies rather than deleting them. Losing a
 * company because someone tidied up a batch would be a nasty surprise.
 */
export async function deleteBatch(id: string): Promise<void> {
  const registry = await read();

  registry.batches = registry.batches.filter((batch) => batch.id !== id);
  registry.deals = registry.deals.map((deal) =>
    deal.batchId === id ? { ...deal, batchId: null } : deal,
  );

  await write(registry);
}

// --- helpers ---------------------------------------------------------------

/** Appends -2, -3 … until the id is free, so two "Zest"s can coexist. */
function uniqueId(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base;

  let suffix = 2;
  while (taken.includes(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

/** Whatever is in the file may be older or hand-edited; rebuild what we trust. */
function sanitize(raw: unknown): Registry {
  if (typeof raw !== "object" || raw === null) return { deals: SEED_DEALS, batches: [] };

  const { deals, batches } = raw as Partial<Registry>;

  const cleanBatches: Batch[] = Array.isArray(batches)
    ? batches.filter(
        (batch): batch is Batch =>
          typeof batch?.id === "string" && typeof batch?.name === "string",
      )
    : [];

  const batchIds = new Set(cleanBatches.map((batch) => batch.id));

  const cleanDeals: Deal[] = Array.isArray(deals)
    ? deals
        .filter(
          (deal): deal is Deal =>
            typeof deal?.id === "string" && typeof deal?.companyKo === "string",
        )
        .map((deal) => ({
          ...deal,
          market: deal.market === "overseas" ? "overseas" : "domestic",
          dealType: ["batch", "tips", "general"].includes(deal.dealType)
            ? deal.dealType
            : "general",
          // Drop a reference to a batch that no longer exists, rather than
          // rendering a company under a heading that isn't there.
          batchId: deal.batchId && batchIds.has(deal.batchId) ? deal.batchId : null,
          // Accept any non-empty string fundId (both seed funds and dynamically
          // created ones). Validation happens at create/update time.
          fundId: typeof deal.fundId === "string" && deal.fundId ? deal.fundId : null,
          archived: deal.archived === true,
          createdAt: typeof deal.createdAt === "string" ? deal.createdAt : "",
          driveFolderId: typeof deal.driveFolderId === "string" && deal.driveFolderId
            ? deal.driveFolderId
            : undefined,
          initialDocsFolderId: typeof deal.initialDocsFolderId === "string" && deal.initialDocsFolderId
            ? deal.initialDocsFolderId
            : undefined,
          execDocsFolderId: typeof deal.execDocsFolderId === "string" && deal.execDocsFolderId
            ? deal.execDocsFolderId
            : undefined,
          affiliationDate: typeof deal.affiliationDate === "string" && deal.affiliationDate
            ? deal.affiliationDate
            : undefined,
        }))
    : [];

  return { deals: cleanDeals, batches: cleanBatches };
}
