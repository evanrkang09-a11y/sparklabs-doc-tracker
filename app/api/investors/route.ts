/**
 * Listing and creating investor profiles.
 *
 * Reaching this route requires a signed-in SparkLabs account - proxy.ts turns
 * anonymous API requests away with a 401 first.
 */

import { describe } from "@/lib/errors";
import {
  createInvestorProfile,
  listInvestorProfiles,
} from "@/lib/investors-store";

export async function GET() {
  try {
    return Response.json({ profiles: await listInvestorProfiles() });
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const input = (body ?? {}) as Record<string, unknown>;
  const label = typeof input.label === "string" ? input.label.trim() : "";

  if (!label) {
    return Response.json({ error: "A profile name is required" }, { status: 400 });
  }

  const values =
    typeof input.values === "object" && input.values !== null
      ? (input.values as Record<string, string>)
      : {};

  try {
    return Response.json(await createInvestorProfile({ label, values }));
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}
