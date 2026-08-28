/**
 * Returns a ZIP archive containing all agreement files for this deal.
 *
 * Currently that's just the filled .docx. The ZIP wrapping makes it easy to
 * add more files later (signed PDF, appendices) without changing the client.
 */

import { auth } from "@/auth";
import { describe } from "@/lib/errors";
import { getDeal } from "@/lib/deals-store";
import { readAgreement } from "@/lib/agreement-store";
import { fillAgreement } from "@/lib/agreement-docx";
import { zipSync } from "fflate";

export async function GET(
  _request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await context.params;
  const deal = await getDeal(dealId);

  if (!deal) {
    return Response.json({ error: `Unknown deal: ${dealId}` }, { status: 404 });
  }

  if (!(await auth())) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const record = await readAgreement(dealId);
    const { bytes } = await fillAgreement(record.contractType, record.values);

    const stem = `투자계약서_${deal.companyKo || deal.companyEn || dealId}`;
    const docxName = `${stem}.docx`;

    const zipped = zipSync({ [docxName]: new Uint8Array(bytes) });
    const zipName = `agreements_${deal.companyKo || deal.companyEn || dealId}`;

    return new Response(zipped, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition":
          `attachment; filename="agreements-${dealId}.zip"; ` +
          `filename*=UTF-8''${encodeURIComponent(zipName)}.zip`,
        "Cache-Control": "no-store",
      },
    });
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}
