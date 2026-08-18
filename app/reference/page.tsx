import type { Metadata } from "next";
import { auth } from "@/auth";
import SiteHeader from "@/app/site-header";
import ReferenceContent from "./reference-content";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ReferencePage() {
  const session = await auth();

  return (
    <>
      <SiteHeader userEmail={session?.user?.email} />
      <ReferenceContent />
    </>
  );
}
