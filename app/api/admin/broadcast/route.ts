import { auth } from "@/auth";
import { describe } from "@/lib/errors";
import { getAllStartupAccounts } from "@/lib/admin-store";
import { postMessage } from "@/lib/message-store";

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const text = typeof (body as Record<string, unknown>)?.text === "string"
    ? ((body as Record<string, unknown>).text as string).trim()
    : "";

  if (!text) return Response.json({ error: "text required" }, { status: 400 });
  if (text.length > 4000) return Response.json({ error: "Too long (max 4000 chars)" }, { status: 400 });

  try {
    const accounts = await getAllStartupAccounts();
    const active = accounts.filter((s) => s.active);

    const senderName = session.user.name ?? session.user.email ?? "SparkLabs";

    const results = await Promise.allSettled(
      active.map((s) => postMessage(s.dealId, "sparklabs", senderName, text)),
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - sent;

    return Response.json({ sent, failed });
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}
