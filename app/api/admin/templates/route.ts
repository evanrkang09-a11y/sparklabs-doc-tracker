import { auth } from "@/auth";
import { put, head, del } from "@vercel/blob";
import { describe } from "@/lib/errors";
import { isContractType, getContract, CONTRACT_ORDER } from "@/lib/contracts";
import { invalidateTemplateCache } from "@/lib/agreement-docx";

function blobKey(type: string): string {
  const file = getContract(type as never)?.templateFile ?? `${type}-agreement.docx`;
  return `admin/templates/${file}`;
}

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const statuses = await Promise.all(
    CONTRACT_ORDER.map(async (type) => {
      try {
        const meta = await head(blobKey(type));
        return { type, custom: true, uploadedAt: meta.uploadedAt?.toISOString() ?? null, size: meta.size };
      } catch {
        return { type, custom: false, uploadedAt: null, size: null };
      }
    }),
  );

  return Response.json(statuses);
}

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const typeRaw = form.get("type");
  const file = form.get("file");

  if (typeof typeRaw !== "string" || !isContractType(typeRaw)) {
    return Response.json({ error: "Invalid contract type" }, { status: 400 });
  }
  if (!(file instanceof Blob)) {
    return Response.json({ error: "file required" }, { status: 400 });
  }
  if (!file.name?.endsWith(".docx")) {
    return Response.json({ error: "File must be a .docx" }, { status: 400 });
  }
  if (file.size > 20 * 1024 * 1024) {
    return Response.json({ error: "File too large (max 20MB)" }, { status: 400 });
  }

  try {
    await put(blobKey(typeRaw), file, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    invalidateTemplateCache(typeRaw);
    return Response.json({ ok: true, type: typeRaw });
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { type } = (await req.json()) as { type?: string };
  if (!type || !isContractType(type)) {
    return Response.json({ error: "Invalid contract type" }, { status: 400 });
  }

  try {
    await del(blobKey(type));
    invalidateTemplateCache(type);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: true }); // already gone is fine
  }
}
