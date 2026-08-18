/**
 * Reads a deal's uploaded documents and extracts the figures on the 운용지시서
 * and 의사록, so the consistency check can be pre-filled instead of typed.
 * On-demand only. A suggestion the analyst confirms, not an authority.
 */

import { getDeal } from "@/lib/deals-store";
import { describe } from "@/lib/errors";
import { isAiConfigured } from "@/lib/analysis";
import { MISSING_KEY_MESSAGE } from "@/lib/openrouter";
import { extractExecutionNumbers } from "@/lib/stage-ai";

export async function POST(
  _request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await context.params;
  if (!(await getDeal(dealId))) {
    return Response.json({ error: `Unknown deal: ${dealId}` }, { status: 404 });
  }
  if (!isAiConfigured()) {
    return Response.json({ error: MISSING_KEY_MESSAGE }, { status: 503 });
  }

  try {
    return Response.json(await extractExecutionNumbers(dealId));
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}
