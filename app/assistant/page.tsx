import type { Metadata } from "next";
import { auth } from "@/auth";
import SiteHeader from "@/app/site-header";
import AssistantChat from "./assistant-chat";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AssistantPage() {
  const session = await auth();

  return (
    <>
      <SiteHeader userEmail={session?.user?.email} />
      <AssistantChat />
    </>
  );
}
