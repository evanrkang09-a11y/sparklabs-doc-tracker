import { getDeal } from "@/lib/deals";
import { documentsFor, matchDocument } from "@/lib/documents";
import { listUploadedFiles } from "@/lib/storage";
import { isDriveConfigured, listDriveFilenames } from "@/lib/drive";

type FoundFile = { name: string; source: "upload" | "drive" };

export async function GET(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await context.params;
  const deal = getDeal(dealId);

  if (!deal) {
    return Response.json({ error: `Unknown deal: ${dealId}` }, { status: 404 });
  }

  const found: FoundFile[] = [];
  const warnings: string[] = [];

  // What the company has uploaded through the site.
  try {
    const uploaded = await listUploadedFiles(dealId);
    for (const file of uploaded) {
      found.push({ name: file.filename, source: "upload" });
    }
  } catch (problem) {
    const reason = problem instanceof Error ? problem.message : "unknown error";
    warnings.push(`업로드 파일을 불러오지 못했습니다 — ${reason}`);
  }

  // Optionally also count the mentor's sample Drive folder.
  if (deal.readsSampleDriveFolder && isDriveConfigured()) {
    try {
      for (const name of await listDriveFilenames()) {
        found.push({ name, source: "drive" });
      }
    } catch (problem) {
      const reason = problem instanceof Error ? problem.message : "unknown error";
      warnings.push(`구글 드라이브를 불러오지 못했습니다 — ${reason}`);
    }
  }

  // Group what we found by which document it satisfies.
  const filesByDocumentId = new Map<string, FoundFile[]>();
  const unrecognized: FoundFile[] = [];

  for (const file of found) {
    const document = matchDocument(file.name, deal.market);

    if (!document) {
      unrecognized.push(file);
      continue;
    }

    const existing = filesByDocumentId.get(document.id) ?? [];
    filesByDocumentId.set(document.id, [...existing, file]);
  }

  const documents = documentsFor(deal.market).map((document) => {
    const files = filesByDocumentId.get(document.id) ?? [];
    return { ...document, files, submitted: files.length > 0 };
  });

  const mandatory = documents.filter((document) => !document.optional);

  return Response.json({
    deal: {
      id: deal.id,
      companyKo: deal.companyKo,
      companyEn: deal.companyEn,
      market: deal.market,
    },
    documents,
    unrecognized,
    totalRequired: mandatory.length,
    missingCount: mandatory.filter((document) => !document.submitted).length,
    warnings,
    checkedAt: new Date().toISOString(),
  });
}
