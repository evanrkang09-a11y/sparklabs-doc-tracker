import { auth } from "@/auth";
import { getThread, postMessage } from "@/lib/message-store";
import { describe } from "@/lib/errors";
import { getDeal } from "@/lib/deals-store";
import { getAllStartupAccounts } from "@/lib/admin-store";
import { notifyStartupOfMessage } from "@/lib/email";

export async function GET(
  _req: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Unauthenticated" }, { status: 401 });

  const { dealId } = await context.params;

  // Startup users can only see their own deal's thread.
  if (session.user.role === "startup" && session.user.dealId !== dealId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const messages = await getThread(dealId);
  return Response.json(messages);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Unauthenticated" }, { status: 401 });

  const { dealId } = await context.params;

  if (session.user.role === "startup" && session.user.dealId !== dealId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { text } = (await request.json()) as { text?: string };
    if (!text?.trim()) {
      return Response.json({ error: "text required" }, { status: 400 });
    }
    if (text.length > 4000) {
      return Response.json({ error: "Message too long (max 4000 characters)" }, { status: 400 });
    }

    const sender = session.user.role === "startup" ? "startup" : "sparklabs";
    const senderName = session.user.name ?? session.user.email ?? sender;
    const message = await postMessage(dealId, sender, senderName, text);

    // When SparkLabs sends a message, notify the startup by email.
    if (sender === "sparklabs") {
      Promise.all([
        getDeal(dealId),
        getAllStartupAccounts(),
      ]).then(([deal, accounts]) => {
        const startup = accounts.find((a) => a.dealId === dealId && a.active);
        if (!startup || !deal) return;
        notifyStartupOfMessage({
          startupEmail: startup.email,
          companyName: startup.companyName,
          senderName,
          messageText: text,
          dealId,
        });
      }).catch(() => {});
    }

    return Response.json(message);
  } catch (e) {
    return Response.json({ error: describe(e) }, { status: 500 });
  }
}
