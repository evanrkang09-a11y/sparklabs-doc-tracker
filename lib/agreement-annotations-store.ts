import { get, put } from "@vercel/blob";

export type Annotation = {
  id: string;
  selectedText: string;
  /** blockKey from the contract paragraph — used to anchor the highlight in the rendered contract. */
  blockKey?: string;
  comment: string;
  authorEmail: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
};

function pathFor(dealId: string): string {
  return `annotations/${dealId}.json`;
}

function isAnnotation(x: unknown): x is Annotation {
  if (typeof x !== "object" || x === null) return false;
  const a = x as Record<string, unknown>;
  return (
    typeof a.id === "string" &&
    typeof a.selectedText === "string" &&
    typeof a.comment === "string" &&
    typeof a.authorEmail === "string" &&
    typeof a.authorName === "string" &&
    typeof a.createdAt === "string"
  );
}

export async function readAnnotations(dealId: string): Promise<Annotation[]> {
  const found = await get(pathFor(dealId), { access: "private", useCache: false });
  if (!found?.stream) return [];

  try {
    const raw: unknown = JSON.parse(await new Response(found.stream).text());
    if (!Array.isArray(raw)) return [];
    return raw.filter(isAnnotation);
  } catch {
    return [];
  }
}

export async function addAnnotation(
  dealId: string,
  annotation: Omit<Annotation, "id" | "createdAt">,
): Promise<Annotation> {
  const existing = await readAnnotations(dealId);
  const id = `ann-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const created: Annotation = { ...annotation, id, createdAt: new Date().toISOString() };
  await put(pathFor(dealId), JSON.stringify([...existing, created]), {
    access: "private",
    allowOverwrite: true,
    contentType: "application/json",
  });
  return created;
}

export async function deleteAnnotation(dealId: string, annotationId: string): Promise<void> {
  const existing = await readAnnotations(dealId);
  const filtered = existing.filter((a) => a.id !== annotationId);
  if (filtered.length === existing.length) return;
  await put(pathFor(dealId), JSON.stringify(filtered), {
    access: "private",
    allowOverwrite: true,
    contentType: "application/json",
  });
}
