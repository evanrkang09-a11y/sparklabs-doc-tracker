import { get, put } from "@vercel/blob";

export type SuggestionStatus = "pending" | "approved" | "rejected";

export type AgreementSuggestion = {
  id: string;
  // Field suggestion (either fieldId+proposedValue or blockKey+proposedText is required)
  fieldId?: string;
  proposedValue?: string;
  // Paragraph suggestion
  blockKey?: string;
  selectedText?: string;
  proposedText?: string;
  note?: string;
  authorEmail: string;
  authorName: string;
  createdAt: string;
  status: SuggestionStatus;
  reviewedBy?: string;
  reviewedAt?: string;
};

function pathFor(dealId: string): string {
  return `agreement-suggestions/${dealId}.json`;
}

function isSuggestion(x: unknown): x is AgreementSuggestion {
  if (typeof x !== "object" || x === null) return false;
  const s = x as Record<string, unknown>;
  const isFieldSug = typeof s.fieldId === "string" && typeof s.proposedValue === "string";
  const isParaSug = typeof s.blockKey === "string" && typeof s.proposedText === "string";
  return (
    typeof s.id === "string" &&
    typeof s.authorEmail === "string" &&
    typeof s.authorName === "string" &&
    typeof s.createdAt === "string" &&
    (s.status === "pending" || s.status === "approved" || s.status === "rejected") &&
    (isFieldSug || isParaSug)
  );
}

export async function listSuggestions(dealId: string): Promise<AgreementSuggestion[]> {
  const found = await get(pathFor(dealId), { access: "private", useCache: false });
  if (!found?.stream) return [];
  try {
    const raw: unknown = JSON.parse(await new Response(found.stream).text());
    if (!Array.isArray(raw)) return [];
    return raw.filter(isSuggestion);
  } catch {
    return [];
  }
}

async function writeAll(dealId: string, list: AgreementSuggestion[]): Promise<void> {
  await put(pathFor(dealId), JSON.stringify(list, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

/**
 * Creates a suggestion. If the same startup already has a pending suggestion for
 * the same field, the old one is replaced — one suggestion per field at a time.
 */
export async function createSuggestion(
  dealId: string,
  data: Omit<AgreementSuggestion, "id" | "createdAt" | "status">,
): Promise<AgreementSuggestion> {
  const existing = await listSuggestions(dealId);
  // Remove any prior pending suggestion from the same author for the same target (field or paragraph).
  const filtered = existing.filter((s) => {
    if (s.authorEmail !== data.authorEmail || s.status !== "pending") return true;
    if (data.fieldId && s.fieldId === data.fieldId) return false;
    if (data.blockKey && s.blockKey === data.blockKey) return false;
    return true;
  });
  const id = `sug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const suggestion: AgreementSuggestion = {
    ...data,
    id,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  await writeAll(dealId, [...filtered, suggestion]);
  return suggestion;
}

export async function updateSuggestion(
  dealId: string,
  id: string,
  patch: Partial<Pick<AgreementSuggestion, "status" | "reviewedBy" | "reviewedAt">>,
): Promise<AgreementSuggestion> {
  const existing = await listSuggestions(dealId);
  const index = existing.findIndex((s) => s.id === id);
  if (index === -1) throw new Error(`Suggestion not found: ${id}`);
  const updated = { ...existing[index], ...patch };
  existing[index] = updated;
  await writeAll(dealId, existing);
  return updated;
}

export async function deleteSuggestion(dealId: string, id: string): Promise<void> {
  const existing = await listSuggestions(dealId);
  const filtered = existing.filter((s) => s.id !== id);
  if (filtered.length === existing.length) return;
  await writeAll(dealId, filtered);
}
