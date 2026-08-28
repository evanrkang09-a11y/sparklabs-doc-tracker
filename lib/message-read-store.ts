import { get, put } from "@vercel/blob";

export async function recordRead(dealId: string): Promise<void> {
  await put(
    `reads/${dealId}.json`,
    JSON.stringify({ lastReadAt: new Date().toISOString() }),
    { access: "private", addRandomSuffix: false, allowOverwrite: true },
  );
}

export async function getLastRead(dealId: string): Promise<string | null> {
  try {
    const found = await get(`reads/${dealId}.json`, { access: "private", useCache: false });
    if (!found) return null;
    const data = (await new Response(found.stream).json()) as { lastReadAt?: string };
    return data.lastReadAt ?? null;
  } catch {
    return null;
  }
}
