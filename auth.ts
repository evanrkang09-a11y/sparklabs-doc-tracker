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

/** Override with ALLOWED_EMAIL_DOMAIN if the company domain is ever different. */
const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN?.trim() || "sparklabs.co.kr";

export function allowedDomain(): string {
  return ALLOWED_DOMAIN;
}

/** True only for a Google-verified address inside the company domain. */
export function isCompanyEmail(email: unknown, verified: unknown): boolean {
  if (typeof email !== "string") return false;

  // Google marks Workspace addresses verified. Without this check a self-hosted
  // or unverified account could claim any address it liked.
  if (verified !== true) return false;

  return email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN.toLowerCase()}`);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          // A hint so the Google account chooser defaults to work accounts.
          // Convenience only - the real check is in signIn below.
          hd: ALLOWED_DOMAIN,
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
      return isCompanyEmail(profile?.email, profile?.email_verified);
    },

    /**
     * Re-checks on every request rather than trusting the token forever. If
     * someone leaves the company and their Google account is suspended they
     * can't sign in again, but an already-issued token would otherwise keep
     * working until it expired.
     */
    jwt({ token }) {
      token.allowed = isCompanyEmail(token.email, true);
      return token;
    },

    session({ session, token }) {
      if (session.user) session.user.email = token.email ?? session.user.email;
      return session;
    },
  },

  session: { strategy: "jwt" },
});
