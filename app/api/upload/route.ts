/**
 * Issues the short-lived token the browser needs to upload straight to Blob.
 *
 * The file never passes through this server, which is what lets a 17MB IR deck
 * through - serverless request bodies are capped at 4.5MB.
 */

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getDeal } from "@/lib/deals";
import { prefixForDeal } from "@/lib/storage";

// 50MB. IR decks are routinely 15-20MB.
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Only allow uploads into a folder belonging to a deal we know about,
        // so nobody can use this endpoint as free file hosting.
        const dealId = pathname.split("/")[1] ?? "";
        const deal = getDeal(dealId);

        if (!deal || !pathname.startsWith(prefixForDeal(dealId))) {
          throw new Error("Upload path does not belong to a known deal");
        }

        return {
          addRandomSuffix: false,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
        };
      },
      onUploadCompleted: async () => {
        // Nothing to do yet. Week 2 could record the upload in a database here.
      },
    });

    return Response.json(result);
  } catch (problem) {
    const message = problem instanceof Error ? problem.message : "Upload failed";
    return Response.json({ error: message }, { status: 400 });
  }
}
