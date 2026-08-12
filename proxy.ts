/**
 * Every request passes through here first.
 *
 * Called proxy.ts rather than middleware.ts because Next.js 16 renamed the
 * convention - a middleware.ts file here would simply never run.
 *
 * Anything not signed in gets sent to /login. The two exceptions are the login
 * page itself and the auth endpoints Google redirects back to, which would
 * otherwise be an unreachable loop.
 *
 * This is the front door, not the only lock: routes that touch data check the
 * session themselves too. A redirect here is for humans; the checks in the API
 * routes are what stop a request that skips the browser entirely.
 */

import { auth } from "@/auth";

export default auth((request) => {
  const { pathname } = request.nextUrl;

  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    // Vercel Blob calls this back server-to-server when an upload finishes, so
    // it can't present a browser session. The route itself still demands one
    // before handing out an upload token - see app/api/upload/route.ts.
    pathname === "/api/upload";

  if (isPublic || request.auth) return;

  // A redirect is useless to code calling the API - say no in a way a caller
  // can actually read.
  if (pathname.startsWith("/api/")) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const login = new URL("/login", request.nextUrl.origin);
  // So a bookmarked deep link still lands where it was going after sign-in.
  if (pathname !== "/") login.searchParams.set("next", pathname);

  return Response.redirect(login);
});

export const config = {
  // Skip Next's own asset routes - they're static files, not pages.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
