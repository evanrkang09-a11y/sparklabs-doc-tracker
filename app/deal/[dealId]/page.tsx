import { notFound } from "next/navigation";
import { getDeal } from "@/lib/deals";
import DealTracker from "./deal-tracker";

export default async function DealPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const deal = getDeal(dealId);

  if (!deal) {
    notFound();
  }

  return <DealTracker deal={deal} />;
}
