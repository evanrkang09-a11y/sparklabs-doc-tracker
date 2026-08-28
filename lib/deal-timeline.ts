import { get, put } from "@vercel/blob";

export type PhaseKey = "documents" | "diligence" | "agreement" | "execution";

export type PhaseWindow = {
  start?: string; // YYYY-MM-DD
  end?: string;
};

export type DealTimeline = {
  [K in PhaseKey]?: PhaseWindow;
};

function path(dealId: string) {
  return `deals/${dealId}/timeline.json`;
}

export async function getTimeline(dealId: string): Promise<DealTimeline> {
  try {
    const found = await get(path(dealId), { access: "private", useCache: false });
    if (!found?.stream) return {};
    const data = (await new Response(found.stream).json()) as DealTimeline;
    return typeof data === "object" && data !== null ? data : {};
  } catch {
    return {};
  }
}

export async function patchTimeline(
  dealId: string,
  phase: PhaseKey,
  changes: PhaseWindow,
): Promise<DealTimeline> {
  const current = await getTimeline(dealId);
  const updated: DealTimeline = {
    ...current,
    [phase]: { ...(current[phase] ?? {}), ...changes },
  };
  await put(path(dealId), JSON.stringify(updated), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
  return updated;
}
