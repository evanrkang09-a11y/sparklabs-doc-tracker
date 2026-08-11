import Link from "next/link";
import { DEALS } from "@/lib/deals";
import { documentsFor } from "@/lib/documents";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm font-medium tracking-wide text-neutral-500 uppercase">
          SparkLabs Korea
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">서류 취합 트래커</h1>
        <p className="mt-1 text-neutral-500">
          Document Collection Tracker &middot; 투자 전 제출 서류 관리
        </p>
      </header>

      <p className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
        기업별 페이지 링크를 해당 기업에 전달하면, 기업이 직접 서류를 업로드할 수 있습니다.
        <span className="mt-1 block text-neutral-500">
          Send a company its own link and they upload their documents themselves.
        </span>
      </p>

      <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {DEALS.map((deal) => {
          const documents = documentsFor(deal.market);
          const requiredCount = documents.filter((doc) => !doc.optional).length;

          return (
            <li key={deal.id}>
              <Link
                href={`/deal/${deal.id}`}
                className="flex items-center justify-between gap-4 py-4 transition-opacity hover:opacity-70"
              >
                <div className="min-w-0">
                  <p className="font-medium">{deal.companyKo}</p>
                  <p className="text-sm text-neutral-500">
                    {deal.companyEn} &middot;{" "}
                    {deal.market === "overseas" ? "해외 기업" : "국내 기업"} &middot; 필수{" "}
                    {requiredCount}건
                  </p>
                </div>
                <span aria-hidden className="text-neutral-400">
                  →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
