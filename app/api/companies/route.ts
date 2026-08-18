/**
 * Creating companies and batches.
 *
 * Reaching this route requires a signed-in SparkLabs account - proxy.ts turns
 * anonymous API requests away with a 401 first.
 */

import { describe } from "@/lib/errors";
import { createBatch, createDeal, getRegistry } from "@/lib/deals-store";

export async function GET() {
  try {
    return Response.json(await getRegistry());
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const input = (body ?? {}) as Record<string, unknown>;

  try {
    // One endpoint, two shapes - a batch is just a heading and needs nothing
    // but a name, so a separate route would be three files of ceremony.
    if (input.kind === "batch") {
      const name = typeof input.name === "string" ? input.name.trim() : "";
      if (!name) return Response.json({ error: "Batch name is required" }, { status: 400 });

      const note = typeof input.note === "string" ? input.note : undefined;
      return Response.json(await createBatch(name, note));
    }

    const companyKo = typeof input.companyKo === "string" ? input.companyKo.trim() : "";
    const companyEn = typeof input.companyEn === "string" ? input.companyEn.trim() : "";

    if (!companyKo && !companyEn) {
      return Response.json({ error: "A company name is required" }, { status: 400 });
    }

    const deal = await createDeal({
      // A company given only one name shows that name in both languages,
      // rather than rendering a blank where the other should be.
      companyKo: companyKo || companyEn,
      companyEn: companyEn || companyKo,
      market: input.market === "overseas" ? "overseas" : "domestic",
      dealType:
        input.dealType === "batch" || input.dealType === "tips"
          ? input.dealType
          : "general",
      batchId: typeof input.batchId === "string" && input.batchId ? input.batchId : null,
      fundId: typeof input.fundId === "string" && input.fundId ? input.fundId : null,
    });

    return Response.json(deal);
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}
