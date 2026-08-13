/**
 * Suggests agreement field values from a company's uploaded documents.
 *
 * On demand only - AI costs money. The client shows the suggestions as
 * placeholder text in the form; a person decides what to accept.
 */

import { describe } from "@/lib/errors";
import { getDeal } from "@/lib/deals-store";
import { collectDealStatus } from "@/lib/deal-status";
import { isAiConfigured } from "@/lib/analysis";
import { MISSING_KEY_MESSAGE } from "@/lib/openrouter";
import { suggestAgreementFields } from "@/lib/agreement-suggest";

export async function POST(
  _request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await context.params;
  const deal = await getDeal(dealId);

  if (!deal) {
    return Response.json({ error: `Unknown deal: ${dealId}` }, { status: 404 });
  }

  if (!isAiConfigured()) {
    return Response.json(
      { error: MISSING_KEY_MESSAGE },
      { status: 503 },
    );
  }

  try {
    const status = await collectDealStatus(deal);
    const suggestions = await suggestAgreementFields(deal, status.documents);
    return Response.json(suggestions);
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}
