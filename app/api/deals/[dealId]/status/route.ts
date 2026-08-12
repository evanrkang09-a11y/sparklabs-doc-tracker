import { getDeal } from "@/lib/deals-store";
import { collectDealStatus } from "@/lib/deal-status";

export async function GET(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await context.params;
  const deal = await getDeal(dealId);

  if (!deal) {
    return Response.json({ error: `Unknown deal: ${dealId}` }, { status: 404 });
  }

  const status = await collectDealStatus(deal);

  return Response.json({
    deal: {
      id: deal.id,
      companyKo: deal.companyKo,
      companyEn: deal.companyEn,
      market: deal.market,
    },
    ...status,
  });
}
