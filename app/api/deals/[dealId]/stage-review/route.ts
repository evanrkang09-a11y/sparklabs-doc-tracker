/**
 * An AI advisory review of one deal's Execution or Conversion stage.
 *
 * Builds a plain description of the current state (config, dates, checklist
 * progress, consistency) and asks the model to summarise progress, what's
 * missing, deadline risks, and next actions. On-demand only.
 */

import { auth } from "@/auth";
import { getDeal } from "@/lib/deals-store";
import { describe } from "@/lib/errors";
import { isAiConfigured } from "@/lib/analysis";
import { MISSING_KEY_MESSAGE } from "@/lib/openrouter";
import { reviewStage } from "@/lib/stage-ai";
import { readExecution } from "@/lib/execution-store";
import { readConversion } from "@/lib/conversion-store";
import { readAgreement } from "@/lib/agreement-store";
import {
  operatingInstructionDocs,
  postPaymentDocs,
  postPaymentDeadlines,
  type FundType,
} from "@/lib/execution";
import {
  CONVERSION_STEPS,
  CONVERSION_PRE_DOCS,
  CONVERSION_POST_DOCS,
  conversionDeadlines,
  estimateConversion,
} from "@/lib/conversion";

const fmt = (d: Date) => d.toISOString().slice(0, 10);

async function executionState(dealId: string, market: "domestic" | "overseas"): Promise<string> {
  const [exec, agreement] = await Promise.all([readExecution(dealId), readAgreement(dealId)]);
  const fundType: FundType | null = market === "overseas" ? "private" : exec.fundType;

  const lines: string[] = [`Market: ${market}`];
  lines.push(`Fund type: ${fundType ?? "not set"}; Structure: ${exec.structure ?? "not set"}`);
  lines.push(`Instruction date: ${exec.instructionDate || "not set"}; Payment date: ${exec.paymentDate || "not set"}`);

  const dl = postPaymentDeadlines(exec.paymentDate);
  if (dl) lines.push(`Post-payment deadline: target ${fmt(dl.target)} (20d), hard ${fmt(dl.hard)} (30d)`);

  if (fundType) {
    const docs = operatingInstructionDocs(market, fundType);
    const done = docs.filter((d) => exec.oiChecks[d.id]);
    const todo = docs.filter((d) => !exec.oiChecks[d.id]);
    lines.push(`Operating-instruction docs gathered: ${done.length}/${docs.length}. Still needed: ${todo.map((d) => d.nameKo).join(", ") || "none"}`);
  } else {
    lines.push("Operating-instruction docs: fund type not selected yet.");
  }

  if (exec.structure) {
    const docs = postPaymentDocs(market, exec.structure);
    const todo = docs.filter((d) => !exec.postChecks[d.id]);
    lines.push(`Post-payment docs gathered: ${docs.length - todo.length}/${docs.length}. Still needed: ${todo.map((d) => d.nameKo).join(", ") || "none"}`);
  }

  const ag = {
    shares: agreement.values.newShares ?? "",
    price: agreement.values.issuePrice ?? "",
    amount: agreement.values.totalAmount ?? "",
  };
  lines.push(
    `Number consistency — agreement: shares ${ag.shares || "?"}, price ${ag.price || "?"}, amount ${ag.amount || "?"}; ` +
      `instruction: ${exec.consistency.instruction.shares || "?"}/${exec.consistency.instruction.price || "?"}/${exec.consistency.instruction.amount || "?"}; ` +
      `minutes: ${exec.consistency.minutes.shares || "?"}/${exec.consistency.minutes.price || "?"}/${exec.consistency.minutes.amount || "?"}`,
  );

  return lines.join("\n");
}

async function conversionState(dealId: string): Promise<string> {
  const conv = await readConversion(dealId);
  const lines: string[] = [];
  lines.push(`Follow-on payment date: ${conv.leadPaymentDate || "not set"}; Signing date: ${conv.signingDate || "not set"}; Fractional-share payment date: ${conv.fractionalPaymentDate || "not set"}`);
  lines.push(`Refund received: ${conv.refundReceived ? "yes" : "no"}`);

  const stepsDone = CONVERSION_STEPS.filter((s) => conv.stepChecks[s.id]);
  lines.push(`Process steps done: ${stepsDone.length}/${CONVERSION_STEPS.length} (${stepsDone.map((s) => s.titleEn).join("; ") || "none"})`);

  const preTodo = CONVERSION_PRE_DOCS.filter((d) => !conv.preChecks[d.id]);
  lines.push(`Pre-conversion docs still needed: ${preTodo.map((d) => d.nameEn).join(", ") || "none"}`);
  const postTodo = CONVERSION_POST_DOCS.filter((d) => !conv.postChecks[d.id]);
  lines.push(`Post-conversion docs still needed: ${postTodo.map((d) => d.nameEn).join(", ") || "none"}`);

  const regDl = conversionDeadlines(conv.fractionalPaymentDate);
  if (regDl) lines.push(`Registration deadline: ideal ${fmt(regDl.ideal)}, normal ${fmt(regDl.normal)}, max ${fmt(regDl.max)}`);

  const est = estimateConversion(conv.calc);
  if (est.shares != null) lines.push(`Share estimate: ~${est.shares} shares at conversion price ${est.conversionPrice}`);

  return lines.join("\n");
}

export async function POST(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role === "startup") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { dealId } = await context.params;
  const deal = await getDeal(dealId);
  if (!deal) return Response.json({ error: `Unknown deal: ${dealId}` }, { status: 404 });

  if (!isAiConfigured()) {
    return Response.json({ error: MISSING_KEY_MESSAGE }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { stage, lang } = (body ?? {}) as Record<string, unknown>;
  if (stage !== "execution" && stage !== "conversion") {
    return Response.json({ error: "stage must be 'execution' or 'conversion'" }, { status: 400 });
  }
  const language = lang === "ko" ? "ko" : "en";

  try {
    const stateText =
      stage === "execution"
        ? await executionState(dealId, deal.market)
        : await conversionState(dealId);

    const stageTitle = stage === "execution" ? "투자 집행 (Execution)" : "SAFE 전환 (Conversion)";
    const review = await reviewStage({ stageTitle, stateText, lang: language });
    return Response.json(review);
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}
