/**
 * Downloads the completed agreement.
 *
 * Reads the saved draft rather than taking values from the request, so the file
 * always matches what's on screen and what a colleague would see - a download
 * that reflects unsaved local edits would be a different contract from the one
 * of record.
 */

import { auth } from "@/auth";
import { describe } from "@/lib/errors";
import { getDeal } from "@/lib/deals-store";
import { readAgreement } from "@/lib/agreement-store";
import { fillAgreement } from "@/lib/agreement-docx";

const DOCX_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function GET(
  request: Request,
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
    const { bytes, unfilled } = await fillAgreement(record.values);

    // Company name in the filename, so a folder of these is navigable.
    const stem = `투자계약서_${deal.companyKo || deal.companyEn || dealId}`;

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": DOCX_TYPE,
        // RFC 5987 form as well as a plain one, so Korean survives browsers
        // that ignore the encoded variant.
        "Content-Disposition":
          `attachment; filename="agreement-${dealId}.docx"; ` +
          `filename*=UTF-8''${encodeURIComponent(stem)}.docx`,
        // How many blanks remain, so the client can warn without re-deriving it.
        "X-Unfilled-Count": String(unfilled.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}
