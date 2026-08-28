import { auth } from "@/auth";
import { getDeal } from "@/lib/deals-store";
import { getTimeline, patchTimeline, type PhaseKey } from "@/lib/deal-timeline";

const VALID_PHASES: PhaseKey[] = ["documents", "diligence", "agreement", "execution"];

export async function GET(
  _req: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role === "startup") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { dealId } = await context.params;
  const timeline = await getTimeline(dealId);
  return Response.json(timeline);
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role === "startup") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { dealId } = await context.params;
  if (!(await getDeal(dealId))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json()) as { phase: string; start?: string | null; end?: string | null };
  if (!VALID_PHASES.includes(body.phase as PhaseKey)) {
    return Response.json({ error: "Invalid phase" }, { status: 400 });
  }

  const changes: { start?: string; end?: string } = {};
  if (body.start !== undefined) changes.start = body.start ?? undefined;
  if (body.end !== undefined) changes.end = body.end ?? undefined;

  const updated = await patchTimeline(dealId, body.phase as PhaseKey, changes);
  return Response.json(updated);
}
