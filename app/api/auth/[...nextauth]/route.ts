/**
 * The endpoints Google redirects back to, and that the sign-in button posts to.
 * All of the work is in auth.ts; this just exposes it as a route.
 */

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
