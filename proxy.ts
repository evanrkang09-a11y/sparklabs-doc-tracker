/**
 * Every request passes through here first.
 *
 * Called proxy.ts rather than middleware.ts because Next.js 16 renamed the
 * convention — a middleware.ts file would never run.
 *
 * Rules:
 *  1. Unauthenticated → /login (except /login itself and NextAuth routes)
 *  2. Startup role → must be on /startup/* or permitted APIs; redirected otherwise
 *  3. Protected pages check the user's permissions array
 *  4. /admin requires "admin" role
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { ROUTE_PERMISSIONS } from "@/lib/permissions";

const PUBLIC = ["/login", "/api/auth"];

export default auth((req: NextRequest & { auth: { user?: { role?: string; permissions?: string[]; dealId?: string; startupPermissions?: string[] } } | null }) => {
  const { pathname } = req.nextUrl;

  // Always allow public routes and NextAuth internals.
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const session = req.auth;

  // Not signed in → login.
  if (!session?.user) {
    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const { role, permissions = [], dealId, startupPermissions = [] } = session.user;

  // Startup users: allowed on their own portal, their own deal pages, and permitted APIs.
  if (role === "startup") {
    const ownPages = dealId
      ? [
          `/startup/${dealId}`,
          `/deal/${dealId}`,
          `/agreement/${dealId}`,
          `/diligence/${dealId}`,
        ]
      : [`/startup/`];

    if (
      ownPages.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
      pathname.startsWith("/api/messages/") ||
      pathname.startsWith("/api/upload") ||
      (dealId && (
        pathname === `/api/deals/${dealId}/status` ||
        pathname.startsWith(`/api/deals/${dealId}/files`) ||
        pathname === `/api/deals/${dealId}/agreement` ||
        pathname.startsWith(`/api/deals/${dealId}/agreement/`) ||
        pathname === `/api/deals/${dealId}/classify-exec`
      )) ||
      pathname.startsWith("/api/session-log")
    ) {
      return NextResponse.next();
    }
    const url = req.nextUrl.clone();
    url.pathname = dealId ? `/startup/${dealId}` : "/login";
    return NextResponse.redirect(url);
  }

  // Admin panel: admin role only.
  if (pathname.startsWith("/admin")) {
    if (role === "admin") return NextResponse.next();
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  // Startup portal: employees and admins shouldn't be there.
  if (pathname.startsWith("/startup/")) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  // Section-level permission check for employees and admins.
  for (const { prefix, permission } of ROUTE_PERMISSIONS) {
    if (pathname.startsWith(prefix)) {
      if (role === "admin" || permissions.includes(permission)) {
        return NextResponse.next();
      }
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("denied", permission);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
