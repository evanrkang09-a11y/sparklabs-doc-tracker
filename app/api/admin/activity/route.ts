import { auth } from "@/auth";
import { getAllUsers } from "@/lib/admin-store";
import { getRecentActivity } from "@/lib/session-log";

export type ActivityEvent = {
  userEmail: string;
  userName: string;
  action: string;
  time: string;
  dealId?: string;
};

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await getAllUsers();

  const perUser = await Promise.allSettled(
    users.map(async (user): Promise<ActivityEvent[]> => {
      const days = await getRecentActivity(user.email, 7);
      return days.flatMap((day) =>
        day.events.map((ev) => ({
          userEmail: user.email,
          userName: user.name || user.email,
          action: ev.action,
          time: ev.time,
          dealId: ev.dealId,
        })),
      );
    }),
  );

  const flat: ActivityEvent[] = perUser
    .filter((r): r is PromiseFulfilledResult<ActivityEvent[]> => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 150);

  return Response.json(flat);
}
