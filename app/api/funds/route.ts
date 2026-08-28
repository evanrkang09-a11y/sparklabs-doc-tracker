import { auth } from "@/auth";
import { describe } from "@/lib/errors";
import { listFunds, createFund } from "@/lib/funds-store";
import { createDealFolder } from "@/lib/drive";

export async function GET() {
  if (!(await auth())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const funds = await listFunds();
    return Response.json(funds);
  } catch (problem) {
    return Response.json({ error: describe(problem, "Failed to list funds") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await auth())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      name?: unknown;
      category?: unknown;
      currency?: unknown;
      createDriveFolder?: unknown;
    };

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return Response.json({ error: "Fund name is required" }, { status: 400 });
    }

    const category = typeof body.category === "string" ? body.category.trim() : "Other";
    const currency = typeof body.currency === "string" ? body.currency.trim() : "KRW";

    let driveFolderId: string | undefined;
    if (body.createDriveFolder) {
      try {
        driveFolderId = await createDealFolder(`[Fund] ${name}`);
      } catch {
        // Drive folder creation is best-effort.
      }
    }

    const fund = await createFund({ name, category, currency, driveFolderId });
    return Response.json(fund, { status: 201 });
  } catch (problem) {
    return Response.json({ error: describe(problem, "Failed to create fund") }, { status: 500 });
  }
}
