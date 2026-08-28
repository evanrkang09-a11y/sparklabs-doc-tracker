"use client";

import { useEffect } from "react";

export default function LogPageView({
  action,
  dealId,
}: {
  action: string;
  dealId?: string;
}) {
  useEffect(() => {
    fetch("/api/session-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...(dealId ? { dealId } : {}) }),
    }).catch(() => {});
  // Only fire once on mount; action/dealId won't change for a given page render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
