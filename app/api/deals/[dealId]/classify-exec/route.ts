import { auth } from "@/auth";
import { getDeal } from "@/lib/deals-store";
import { readExecution } from "@/lib/execution-store";
import { postPaymentDocs } from "@/lib/execution";
import { callOpenRouter, isAiConfigured, MISSING_KEY_MESSAGE } from "@/lib/openrouter";
import { MIN_CONFIDENCE } from "@/lib/classify";

const SYSTEM = `You identify Korean and English startup investment documents from their filenames alone.

You are given a checklist of post-investment execution documents a portfolio company must provide, and a list of uploaded filenames. For each filename, decide which checklist document it most likely is.

Rules:
- Answer only with an id from the checklist, or null.
- null is the right answer when the filename is genuinely ambiguous. A wrong id is worse than null.
- Filenames are often abbreviated, misspelled, in mixed Korean and English, or carry version suffixes like _final_v2 or (1). Read through that.
- A confidence below 0.6 will be discarded, so use the full range honestly.
- Keep each reason to one short sentence, in Korean.`;

const SCHEMA = {
  type: "object",
  properties: {
    guesses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          filename: { type: "string" },
          documentId: { type: "string", nullable: true },
          confidence: { type: "number" },
          reason: { type: "string" },
        },
        required: ["filename", "documentId", "confidence", "reason"],
      },
    },
  },
  required: ["guesses"],
} as const;

export async function POST(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { dealId } = await context.params;

  // Startup users may only classify their own deal.
  if (session.user.role === "startup" && session.user.dealId !== dealId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const [deal, exec] = await Promise.all([getDeal(dealId), readExecution(dealId)]);
  if (!deal) return Response.json({ error: "Not found" }, { status: 404 });
  if (!exec.structure) return Response.json({ suggestions: [] });

  if (!isAiConfigured()) {
    return Response.json({ error: MISSING_KEY_MESSAGE }, { status: 503 });
  }

  const docs = postPaymentDocs(deal.market, exec.structure);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const filenames: string[] = Array.isArray((body as { filenames?: unknown }).filenames)
    ? ((body as { filenames: unknown[] }).filenames).filter((f): f is string => typeof f === "string").slice(0, 20)
    : [];

  if (filenames.length === 0) return Response.json({ suggestions: [] });

  const checklist = docs.map((d) => `- ${d.id}: ${d.nameKo} (${d.nameEn})`).join("\n");

  try {
    const parsed = await callOpenRouter({
      system: SYSTEM,
      content: `체크리스트:\n${checklist}\n\n분류할 파일명:\n${filenames.map((n) => `- ${n}`).join("\n")}`,
      schema: SCHEMA,
      schemaName: "guesses",
      maxTokens: 1000,
    });

    const validIds = new Set(docs.map((d) => d.id));
    const askedFor = new Set(filenames);
    const raw = parsed as { guesses?: unknown[] };
    const guesses = Array.isArray(raw.guesses) ? raw.guesses : [];

    const suggestions = guesses
      .filter((g): g is Record<string, unknown> => typeof g === "object" && g !== null)
      .filter((g) => typeof g.filename === "string" && askedFor.has(g.filename as string))
      .filter((g) => typeof g.confidence === "number" && (g.confidence as number) >= MIN_CONFIDENCE)
      .filter((g) => g.documentId === null || (typeof g.documentId === "string" && validIds.has(g.documentId as string)))
      .map((g) => {
        const doc = docs.find((d) => d.id === g.documentId);
        return {
          filename: g.filename as string,
          documentId: g.documentId as string | null,
          confidence: g.confidence as number,
          reason: g.reason as string,
          documentNameKo: doc?.nameKo ?? String(g.documentId),
          documentNameEn: doc?.nameEn ?? String(g.documentId),
        };
      });

    return Response.json({ suggestions });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
