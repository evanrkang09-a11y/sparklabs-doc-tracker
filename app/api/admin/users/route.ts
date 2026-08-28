import { auth } from "@/auth";
import { getAllUsers, setUserPermissions } from "@/lib/admin-store";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import { describe } from "@/lib/errors";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const users = await getAllUsers();
  return Response.json(users);
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { email, permissions } = (await request.json()) as {
      email?: string;
      permissions?: unknown[];
    };
    if (!email || !Array.isArray(permissions)) {
      return Response.json({ error: "email and permissions required" }, { status: 400 });
    }
    const valid = permissions.filter((p): p is Permission =>
      PERMISSIONS.includes(p as Permission),
    );
    await setUserPermissions(email, valid);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: describe(e) }, { status: 500 });
  }
}
