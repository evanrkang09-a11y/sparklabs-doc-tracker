import { auth } from "@/auth";
import { recordRead, getLastRead } from "@/lib/message-read-store";

export async function POST(
  _req: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const session = await auth();
  if (session?.user?.role !== "startup") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { dealId } = await context.params;
  if (session.user.dealId !== dealId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await recordRead(dealId);
  return Response.json({ ok: true });
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role === "startup") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { dealId } = await context.params;
  const lastReadAt = await getLastRead(dealId);
  return Response.json({ dealId, lastReadAt });
}
