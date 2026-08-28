import { auth } from "@/auth";
import { describe } from "@/lib/errors";
import { getDeal } from "@/lib/deals-store";
import { listUploadedFiles, readFileAsDataUrl } from "@/lib/storage";
import { callOpenRouter } from "@/lib/openrouter";

const READABLE = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "text/plain",
]);

const SCHEMA = {
  type: "object",
  properties: { email: { type: "string" } },
  required: ["email"],
} as const;

const SYSTEM = `You assist a Korean venture capital firm.
Your job is to find the company's contact email address in the uploaded documents.

Rules:
- Look for any email address belonging to the portfolio company (not SparkLabs).
- Return the email exactly as it appears. Do not invent or guess.
- Return an empty string "" if you cannot find an email address.`;

export async function POST(
  _request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await context.params;

  if (!(await auth())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deal = await getDeal(dealId);
  if (!deal) {
    return Response.json({ error: `Unknown deal: ${dealId}` }, { status: 404 });
  }

  try {
    const allFiles = await listUploadedFiles(dealId);
    const filenames = allFiles.map((f) => f.filename).slice(0, 8);

    if (filenames.length === 0) {
      return Response.json({ email: null });
    }

    const MAX_BYTES = 10 * 1024 * 1024;
    let budget = MAX_BYTES;
    const parts: unknown[] = [
      {
        type: "text",
        text: `Company: ${deal.companyKo} (${deal.companyEn})\n\nFind the company's contact email address in these documents.`,
      },
    ];

    for (const name of filenames) {
      const file = await readFileAsDataUrl(dealId, name);
      if (!file || !READABLE.has(file.contentType)) continue;
      if (file.dataUrl.length > budget) break;
      budget -= file.dataUrl.length;
      parts.push({ type: "file", file: { filename: name, file_data: file.dataUrl } });
    }

    if (parts.length === 1) {
      return Response.json({ email: null });
    }

    const result = await callOpenRouter({
      system: SYSTEM,
      content: parts,
      schema: SCHEMA,
      schemaName: "suggest-email",
      maxTokens: 100,
      readsFiles: true,
    });

    const email = typeof result.email === "string" && result.email.trim()
      ? result.email.trim()
      : null;

    return Response.json({ email });
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}
