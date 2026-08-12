import { DEALS } from "@/lib/deals";
import { documentsFor } from "@/lib/documents";
import DealList from "./deal-list";
import SiteHeader from "./site-header";

export default function Home() {
  // Counting on the server keeps the whole document list out of the browser
  // bundle - the home page only needs the number.
  const deals = DEALS.map((deal) => ({
    id: deal.id,
    companyKo: deal.companyKo,
    companyEn: deal.companyEn,
    market: deal.market,
    requiredCount: documentsFor(deal.market).filter((doc) => !doc.optional).length,
  }));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <DealList deals={deals} />
      </main>
    </>
  );
}
