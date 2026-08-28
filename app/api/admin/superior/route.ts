import { auth } from "@/auth";
import { setSuperiorUser } from "@/lib/admin-store";
import { describe } from "@/lib/errors";

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { email } = (await request.json()) as { email?: string };
    if (!email?.trim()) {
      return Response.json({ error: "email required" }, { status: 400 });
    }
    await setSuperiorUser(email.trim().toLowerCase());
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: describe(e) }, { status: 500 });
  }
}
