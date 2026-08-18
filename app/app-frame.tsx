"use client";

import { usePathname } from "next/navigation";
import AppSidebar from "./app-sidebar";

/**
 * Wraps every page with the persistent left sidebar, and pads the content to
 * the right of it on large screens. The login page gets neither — there's no
 * session to navigate yet.
 */
export default function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") return <>{children}</>;

  return (
    <>
      <AppSidebar />
      <div className="lg:pl-56">{children}</div>
    </>
  );
}
