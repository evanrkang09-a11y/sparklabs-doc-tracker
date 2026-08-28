"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import AppSidebar from "./app-sidebar";

/**
 * Wraps every page with the persistent left sidebar, and pads the content to
 * the right of it on large screens. The login page and startup users get
 * neither — startups see only their own deal pages without the employee nav.
 */
export default function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isStartup = session?.user?.role === "startup";

  if (pathname === "/login" || pathname.startsWith("/startup/") || isStartup) {
    return <>{children}</>;
  }

  return (
    <>
      <AppSidebar />
      <div className="lg:pl-72">{children}</div>
    </>
  );
}
