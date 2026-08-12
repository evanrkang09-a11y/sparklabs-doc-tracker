/**
 * Runs the AI fallback over a deal's unclassified files.
 *
 * Read-only and on demand: it returns suggestions and changes nothing. Ticking
 * a document off the checklist because a model was fairly sure about a
 * filename is not a decision this app should make on its own.
 */

import { getDeal } from "@/lib/deals";
import { collectDealStatus, describe } from "@/lib/deal-status";
import { classifyFilenames, isAiConfigured, MIN_CONFIDENCE } from "@/lib/classify";
import { documentsFor } from "@/lib/documents";

export async function POST(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await context.params;
  const deal = getDeal(dealId);

  if (!deal) {
    return Response.json({ error: `Unknown deal: ${dealId}` }, { status: 404 });
  }

  if (!isAiConfigured()) {
    return Response.json(
      { error: "OPENROUTER_API_KEY가 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  try {
    const status = await collectDealStatus(deal);
    const filenames = status.unrecognized.map((file) => file.name);

    if (filenames.length === 0) {
      return Response.json({ suggestions: [], checkedCount: 0 });
    }

    const guesses = await classifyFilenames(filenames, deal.market);
    const namesById = new Map(
      documentsFor(deal.market).map((doc) => [doc.id, doc.nameKo]),
    );

    const suggestions = guesses
      .filter((guess) => guess.documentId && guess.confidence >= MIN_CONFIDENCE)
      .map((guess) => ({
        ...guess,
        documentNameKo: namesById.get(guess.documentId!) ?? guess.documentId,
      }));

    return Response.json({ suggestions, checkedCount: filenames.length });
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}
