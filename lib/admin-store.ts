/**
 * Admin configuration, user permissions, and startup accounts.
 * All stored in private Vercel Blob as JSON files.
 *
 * admin-config.json   — who the superior user is
 * admin-users.json    — SparkLabs employee permission map
 * admin-startups.json — registered startup / portfolio company accounts
 */

import { get, put } from "@vercel/blob";
import { readEnv, readEnvOr } from "./env";
import { DEFAULT_EMPLOYEE_PERMISSIONS, type Permission } from "./permissions";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AdminConfig = {
  superiorEmail: string;
  superiorSetAt: string;
};

export type UserEntry = {
  email: string;
  name: string;
  permissions: Permission[];
  lastSeen: string;
};

export type StartupPermission = "documents" | "agreement";

export type StartupAccount = {
  id: string; // random slug, stable across renames
  email: string; // Google account they sign in with
  dealId: string; // which deal/company they represent
  companyName: string; // display name
  active: boolean;
  addedAt: string;
  /** Which employee-facing pages this startup can also access. */
  startupPermissions?: StartupPermission[];
};

// ─── Paths ───────────────────────────────────────────────────────────────────

const ADMIN_CONFIG_PATH = "admin/admin-config.json";
const USERS_PATH = "admin/admin-users.json";
const STARTUPS_PATH = "admin/admin-startups.json";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const found = await get(path, { access: "private", useCache: false });
    if (!found) return null;
    return (await new Response(found.stream).json()) as T;
  } catch {
    return null;
  }
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await put(path, JSON.stringify(data, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

// ─── Admin config ─────────────────────────────────────────────────────────────

/** Returns the superior user email. Falls back to ADMIN_EMAIL env var. */
export async function getAdminConfig(): Promise<AdminConfig> {
  const stored = await readJson<AdminConfig>(ADMIN_CONFIG_PATH);
  if (stored?.superiorEmail) return stored;

  const envEmail = readEnv("ADMIN_EMAIL").toLowerCase();
  return {
    superiorEmail: envEmail,
    superiorSetAt: new Date().toISOString(),
  };
}

export async function setSuperiorUser(email: string): Promise<void> {
  const config: AdminConfig = {
    superiorEmail: email.toLowerCase().trim(),
    superiorSetAt: new Date().toISOString(),
  };
  await writeJson(ADMIN_CONFIG_PATH, config);
}

export async function isSuperiorUser(email: string): Promise<boolean> {
  const normalised = email.toLowerCase().trim();
  // Env var always wins — if ADMIN_EMAIL is set it overrides any stored config.
  const envEmail = readEnvOr("ADMIN_EMAIL", "").toLowerCase().trim();
  if (envEmail && envEmail === normalised) return true;
  const config = await getAdminConfig();
  return config.superiorEmail === normalised;
}

// ─── Employee users ───────────────────────────────────────────────────────────

async function readUsers(): Promise<UserEntry[]> {
  return (await readJson<UserEntry[]>(USERS_PATH)) ?? [];
}

async function writeUsers(users: UserEntry[]): Promise<void> {
  await writeJson(USERS_PATH, users);
}

export async function getAllUsers(): Promise<UserEntry[]> {
  return readUsers();
}

/** Creates or updates a user record. Returns the entry. */
export async function upsertUser(
  email: string,
  name: string,
): Promise<UserEntry> {
  const users = await readUsers();
  const idx = users.findIndex((u) => u.email === email.toLowerCase());
  const now = new Date().toISOString();

  if (idx >= 0) {
    users[idx] = { ...users[idx], name, lastSeen: now };
    await writeUsers(users);
    return users[idx];
  }

  const entry: UserEntry = {
    email: email.toLowerCase(),
    name,
    permissions: DEFAULT_EMPLOYEE_PERMISSIONS,
    lastSeen: now,
  };
  await writeUsers([...users, entry]);
  return entry;
}

export async function getUserPermissions(email: string): Promise<Permission[]> {
  const users = await readUsers();
  const entry = users.find((u) => u.email === email.toLowerCase());
  return entry?.permissions ?? DEFAULT_EMPLOYEE_PERMISSIONS;
}

export async function setUserPermissions(
  email: string,
  permissions: Permission[],
): Promise<void> {
  const users = await readUsers();
  const idx = users.findIndex((u) => u.email === email.toLowerCase());
  if (idx >= 0) {
    users[idx] = { ...users[idx], permissions };
    await writeUsers(users);
  }
}

// ─── Startup accounts ─────────────────────────────────────────────────────────

async function readStartups(): Promise<StartupAccount[]> {
  return (await readJson<StartupAccount[]>(STARTUPS_PATH)) ?? [];
}

async function writeStartups(accounts: StartupAccount[]): Promise<void> {
  await writeJson(STARTUPS_PATH, accounts);
}

export async function getAllStartupAccounts(): Promise<StartupAccount[]> {
  return readStartups();
}

export async function getStartupByEmail(
  email: string,
): Promise<StartupAccount | null> {
  const accounts = await readStartups();
  return (
    accounts.find(
      (a) => a.active && a.email.toLowerCase() === email.toLowerCase(),
    ) ?? null
  );
}

export async function addStartupAccount(
  email: string,
  dealId: string,
  companyName: string,
): Promise<StartupAccount> {
  const accounts = await readStartups();
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const account: StartupAccount = {
    id,
    email: email.toLowerCase().trim(),
    dealId,
    companyName,
    active: true,
    addedAt: new Date().toISOString(),
  };
  await writeStartups([...accounts, account]);
  return account;
}

export async function updateStartupAccount(
  id: string,
  patch: Partial<Pick<StartupAccount, "email" | "dealId" | "companyName" | "active" | "startupPermissions">>,
): Promise<void> {
  const accounts = await readStartups();
  const idx = accounts.findIndex((a) => a.id === id);
  if (idx >= 0) {
    accounts[idx] = { ...accounts[idx], ...patch };
    await writeStartups(accounts);
  }
}

export async function removeStartupAccount(id: string): Promise<void> {
  const accounts = await readStartups();
  await writeStartups(accounts.filter((a) => a.id !== id));
}
