"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

/**
 * Shown to startup users at the top of employee-facing pages they have access
 * to (documents, agreement). Gives them a way back to their portal and makes
 * it clear whose account they're viewing.
 */
export default function StartupNavBar({ dealId }: { dealId: string }) {
  const { data: session } = useSession();
  if (session?.user?.role !== "startup") return null;

  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-emerald-100 bg-emerald-600 px-4 py-2.5">
      <Link
        href={`/startup/${dealId}`}
        className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800"
      >
        ← Back to portal
      </Link>
      <span className="text-xs text-emerald-100">
        Viewing as {session.user.name ?? session.user.email}
      </span>
    </div>
  );
}
