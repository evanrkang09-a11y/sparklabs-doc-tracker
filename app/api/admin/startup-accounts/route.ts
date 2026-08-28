import { auth } from "@/auth";
import {
  getAllStartupAccounts,
  addStartupAccount,
  updateStartupAccount,
  removeStartupAccount,
} from "@/lib/admin-store";
import { describe } from "@/lib/errors";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const accounts = await getAllStartupAccounts();
  return Response.json(accounts);
}

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { email, dealId, companyName } = (await request.json()) as {
      email?: string;
      dealId?: string;
      companyName?: string;
    };
    if (!email || !dealId || !companyName) {
      return Response.json({ error: "email, dealId, companyName required" }, { status: 400 });
    }
    const account = await addStartupAccount(email, dealId, companyName);
    return Response.json(account);
  } catch (e) {
    return Response.json({ error: describe(e) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { id, ...patch } = (await request.json()) as {
      id?: string;
      email?: string;
      dealId?: string;
      companyName?: string;
      active?: boolean;
    };
    if (!id) return Response.json({ error: "id required" }, { status: 400 });
    await updateStartupAccount(id, patch);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: describe(e) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { id } = (await request.json()) as { id?: string };
    if (!id) return Response.json({ error: "id required" }, { status: 400 });
    await removeStartupAccount(id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: describe(e) }, { status: 500 });
  }
}
