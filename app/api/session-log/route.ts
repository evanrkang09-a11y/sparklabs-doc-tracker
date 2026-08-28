import { auth } from "@/auth";
import { logEvent } from "@/lib/session-log";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return new Response(null, { status: 204 });

  try {
    const { action, dealId } = (await request.json()) as {
      action?: string;
      dealId?: string;
    };
    if (action) {
      await logEvent(session.user.email, action, dealId);
    }
  } catch {
    // best-effort
  }
  return new Response(null, { status: 204 });
}
