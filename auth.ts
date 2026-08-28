/**
 * Authentication for two audiences:
 *
 *  1. SparkLabs employees — must have a @sparklabs.co.kr address (or be in
 *     ALLOWED_EMAILS). They get a role of "admin" or "employee".
 *
 *  2. Portfolio companies — registered by the admin with a specific email
 *     address. They get a role of "startup" and a dealId.
 *
 * Both audiences use Google OAuth, so there's no password to manage. The
 * sign-in callback determines which role applies and stores it in the JWT.
 * The middleware reads the role on every request to enforce access control.
 */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";
import { readEnv, readEnvList, readEnvOr } from "@/lib/env";
import { isSuperiorUser, getStartupByEmail, upsertUser, getUserPermissions } from "@/lib/admin-store";
import { DEFAULT_EMPLOYEE_PERMISSIONS, type Permission } from "@/lib/permissions";

// ─── Extend the built-in JWT type ─────────────────────────────────────────────
declare module "next-auth/jwt" {
  interface JWT {
    role?: "admin" | "employee" | "startup";
    permissions?: Permission[];
    dealId?: string;
    startupPermissions?: string[];
  }
}

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: "admin" | "employee" | "startup";
      permissions?: Permission[];
      dealId?: string;
      startupPermissions?: string[];
    };
  }
}

// ─── Domain / exception list ──────────────────────────────────────────────────

const ALLOWED_DOMAIN = readEnvOr("ALLOWED_EMAIL_DOMAIN", "sparklabs.co.kr");
const EXTRA_EMAILS = readEnvList("ALLOWED_EMAILS");

export function allowedDomain(): string {
  return ALLOWED_DOMAIN;
}

export function isAllowedEmail(email: unknown, verified: unknown): boolean {
  if (typeof email !== "string") return false;
  if (verified !== true) return false;
  const address = email.toLowerCase();
  return (
    address.endsWith(`@${ALLOWED_DOMAIN.toLowerCase()}`) ||
    EXTRA_EMAILS.includes(address)
  );
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: readEnv("AUTH_GOOGLE_ID"),
      clientSecret: readEnv("AUTH_GOOGLE_SECRET"),
      authorization: {
        params: {
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
    async signIn({ profile }) {
      const email = profile?.email ?? "";
      const verified = profile?.email_verified === true;

      // Allow SparkLabs employees.
      if (isAllowedEmail(email, verified)) return true;

      // Allow registered startup accounts.
      const startup = await getStartupByEmail(email).catch(() => null);
      if (startup) return true;

      return false;
    },

    async jwt({ token, profile, trigger }) {
      // On initial sign-in `profile` is present; on subsequent requests it
      // isn't, so we keep whatever role/permissions are already in the token.
      if (trigger === "signIn" && profile) {

        const email = (profile.email ?? "").toLowerCase();
        const name = (profile.name as string | undefined) ?? email;
        const verified = profile.email_verified === true;

        if (isAllowedEmail(email, verified)) {
          // SparkLabs employee or admin.
          const isAdmin = await isSuperiorUser(email).catch(() => false);
          const permissions = isAdmin
            ? (["documents", "agreements", "execution", "conversion"] as Permission[])
            : await getUserPermissions(email).catch(
                () => ["documents", "agreements", "execution", "conversion"] as Permission[],
              );

          // Record/update the user in the user store.
          await upsertUser(email, name).catch(() => {});

          token.role = isAdmin ? "admin" : "employee";
          token.permissions = permissions;
          delete token.dealId;
        } else {
          // Portfolio company.
          const startup = await getStartupByEmail(email).catch(() => null);
          if (startup) {
            token.role = "startup";
            token.permissions = [];
            token.dealId = startup.dealId;
            token.startupPermissions = startup.startupPermissions ?? [];
          } else {
            return null as unknown as JWT; // deny
          }
        }
      }

      // Backfill: tokens minted before the role/permissions fields were introduced.
      //
      // Case 1 (role set, permissions missing): employee signed in after the role
      // system was added but before the permissions field was added — set permissions.
      //
      // Case 2 (neither role nor dealId): employee signed in before the role system
      // itself existed. Startup users always have dealId, so no dealId means SparkLabs
      // — set role and permissions both.
      if (
        (token.role === "employee" || token.role === "admin" || (!token.role && !token.dealId)) &&
        token.permissions === undefined
      ) {
        const email = typeof token.email === "string" ? token.email.toLowerCase() : "";

        if (!token.role) {
          const isAdm = await isSuperiorUser(email).catch(() => false);
          token.role = isAdm ? "admin" : "employee";
        }

        token.permissions =
          token.role === "admin"
            ? (["documents", "agreements", "execution", "conversion"] as Permission[])
            : await getUserPermissions(email).catch(() => DEFAULT_EMPLOYEE_PERMISSIONS);
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
        session.user.permissions = token.permissions;
        session.user.dealId = token.dealId;
        session.user.startupPermissions = token.startupPermissions;
      }
      return session;
    },
  },

  session: { strategy: "jwt" },
});
