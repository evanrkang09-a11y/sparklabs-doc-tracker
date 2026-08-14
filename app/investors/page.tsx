import type { Metadata } from "next";
import { auth } from "@/auth";
import { listInvestorProfiles } from "@/lib/investors-store";
import SiteHeader from "@/app/site-header";
import InvestorsManager from "./investors-manager";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function InvestorsPage() {
  const [session, profiles] = await Promise.all([auth(), listInvestorProfiles()]);

  return (
    <>
      <SiteHeader userEmail={session?.user?.email} />
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <InvestorsManager initial={profiles} />
      </main>
    </>
  );
}
