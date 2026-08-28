import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAllUsers, getAllStartupAccounts, getAdminConfig } from "@/lib/admin-store";
import { getRegistry } from "@/lib/deals-store";
import SiteHeader from "@/app/site-header";
import AdminPanel from "./admin-panel";

export const metadata: Metadata = {
  title: "Admin · SparkLabs",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/");

  const [users, startups, adminConfig, registry] = await Promise.all([
    getAllUsers(),
    getAllStartupAccounts(),
    getAdminConfig(),
    getRegistry(),
  ]);

  return (
    <>
      <SiteHeader userEmail={session.user.email} />
      <AdminPanel
        users={users}
        startups={startups}
        adminConfig={adminConfig}
        deals={registry.deals.map((d) => ({
          id: d.id,
          companyKo: d.companyKo,
          companyEn: d.companyEn,
        }))}
        currentAdminEmail={session.user.email ?? ""}
      />
    </>
  );
}
