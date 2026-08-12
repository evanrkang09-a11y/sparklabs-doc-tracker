/**
 * Who is allowed in.
 *
 * Sign-in goes through Google, so this app never sees anyone's password - the
 * password is typed on google.com and Google reports back a verified email
 * address. Nothing here to leak.
 *
 * The employee check is the domain of that verified address. It runs in the
 * signIn callback, on the server, deliberately: Google's `hd` parameter only
 * filters which accounts the *login screen* offers, and a request can be made
 * without it. The server-side check is the actual gate.
 *
 * Everyone using this tool is SparkLabs staff. Companies email their documents
 * in and an employee uploads them, so there is no external user to account for.
 */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { readEnv, readEnvList, readEnvOr } from "@/lib/env";

/** Override with ALLOWED_EMAIL_DOMAIN if the company domain is ever different. */
const ALLOWED_DOMAIN = readEnvOr("ALLOWED_EMAIL_DOMAIN", "sparklabs.co.kr");

/**
 * Named exceptions, comma separated in ALLOWED_EMAILS.
 *
 * For people who do the work but don't have a company address - interns and
 * contractors, mainly. Deliberately a list of exact addresses rather than a
 * second domain: every entry is a decision someone made, and `vercel env ls`
 * shows the whole list. Empty in the normal case.
 */
const EXTRA_EMAILS = readEnvList("ALLOWED_EMAILS");

export function allowedDomain(): string {
  return ALLOWED_DOMAIN;
}

/** True for a Google-verified company address, or a named exception. */
export function isAllowedEmail(email: unknown, verified: unknown): boolean {
  if (typeof email !== "string") return false;

  // Google marks Workspace addresses verified. Without this check a self-hosted
  // or unverified account could claim any address it liked.
  if (verified !== true) return false;

  const address = email.toLowerCase();

  return (
    address.endsWith(`@${ALLOWED_DOMAIN.toLowerCase()}`) || EXTRA_EMAILS.includes(address)
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      // Passed explicitly rather than left to auto-detection, so they go
      // through readEnv above and arrive clean.
      clientId: readEnv("AUTH_GOOGLE_ID"),
      clientSecret: readEnv("AUTH_GOOGLE_SECRET"),
      authorization: {
        params: {
          // `hd` narrows which accounts Google's chooser offers. It's a
          // convenience - the real check is in signIn below - but it filters
          // out the named exceptions too, so it only goes on when there
          // aren't any. Dropping it changes what users see, never who gets in.
          ...(EXTRA_EMAILS.length === 0 ? { hd: ALLOWED_DOMAIN } : {}),
          prompt: "select_account",
        },
      },
    }),
  ],

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    /** The gate. Returning false refuses the sign-in. */
    signIn({ profile }) {
      return isAllowedEmail(profile?.email, profile?.email_verified);
    },

    /**
     * Re-checks the address on every request rather than trusting the token
     * until it expires. Returning null throws the session away, so removing
     * someone from ALLOWED_EMAILS - or a colleague leaving and losing their
     * company address - takes effect on their next request rather than
     * whenever their cookie happens to lapse.
     */
    jwt({ token }) {
      return isAllowedEmail(token.email, true) ? token : null;
    },
  },

  session: { strategy: "jwt" },
});
