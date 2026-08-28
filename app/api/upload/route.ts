/**
 * Issues the short-lived token the browser needs to upload straight to Blob.
 *
 * The file never passes through this server, which is what lets a 17MB IR deck
 * through - serverless request bodies are capped at 4.5MB.
 */

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/auth";
import { describe } from "@/lib/errors";
import { getDeal } from "@/lib/deals-store";
import { prefixForDeal } from "@/lib/storage";
import { uploadFileToDriveFolder } from "@/lib/drive";
import { notifyAdminOfUpload } from "@/lib/email";
import { readExecution, saveExecution } from "@/lib/execution-store";
import { postPaymentDocs, matchExecDoc } from "@/lib/execution";

// 50MB. IR decks are routinely 15-20MB.
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // This route is exempt from the proxy so Blob's completion callback can
        // reach it, which means the token branch has to check the session
        // itself. Without this, anyone could ask for an upload token.
        const session = await auth();
        if (!session?.user) {
          throw new Error("Authentication required");
        }

        // Only allow uploads into a folder belonging to a deal we know about,
        // so nobody can use this endpoint as free file hosting.
        const dealId = pathname.split("/")[1] ?? "";
        const deal = await getDeal(dealId);

        // Startup users may only upload into their own deal's folder.
        if (session.user.role === "startup" && session.user.dealId !== dealId) {
          throw new Error("Upload path does not belong to your deal");
        }

        const allowed =
          pathname.startsWith(prefixForDeal(dealId)) ||
          pathname.startsWith(`execution-oi/${dealId}/`) ||
          pathname.startsWith(`execution-post/${dealId}/`);
        if (!deal || !allowed) {
          throw new Error("Upload path does not belong to a known deal");
        }

        const isStartup = session.user.role === "startup";
        const companyName = deal ? (deal.companyKo || deal.companyEn) : "";

        return {
          addRandomSuffix: false,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          tokenPayload: JSON.stringify({ dealId, isStartup, companyName }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        try {
          const { dealId, isStartup, companyName } = JSON.parse(tokenPayload ?? "{}") as {
            dealId?: string;
            isStartup?: boolean;
            companyName?: string;
          };

          const isExecStartup = blob.pathname.includes("/execution/startup/");
          const filename = blob.pathname.split("/").pop() ?? blob.pathname;

          // Notify admin when a startup uploads a file.
          if (dealId && isStartup && companyName) {
            notifyAdminOfUpload({ companyName, filename, dealId }).catch(() => {});
          }

          if (!dealId) return;

          const deal = await getDeal(dealId);

          // Auto-check the matching postChecks item when a startup uploads an execution file.
          if (isExecStartup && deal) {
            const exec = await readExecution(dealId).catch(() => null);
            if (exec?.structure) {
              const docs = postPaymentDocs(deal.market, exec.structure);
              const docId = matchExecDoc(filename, docs);
              if (docId && !exec.postChecks?.[docId]) {
                await saveExecution(
                  dealId,
                  { postChecks: { ...exec.postChecks, [docId]: true } },
                  "startup-auto",
                ).catch(() => {});
              }
            }
          }

          // Mirror the uploaded file into the deal's Drive folder if one exists.
          if (!deal?.driveFolderId) return;

          // blob.downloadUrl is a pre-signed URL that works without additional
          // auth headers — safer than get() whose .stream availability varies.
          const response = await fetch(blob.downloadUrl);
          if (!response.ok || !response.body) return;

          // Route to the correct subfolder: execution uploads → Execution Documents,
          // everything else → Initial Documents. Falls back to root folder if not yet set up.
          const targetFolderId = isExecStartup
            ? (deal.execDocsFolderId ?? deal.driveFolderId)
            : (deal.initialDocsFolderId ?? deal.driveFolderId);

          await uploadFileToDriveFolder(
            targetFolderId,
            filename,
            blob.contentType ?? "application/octet-stream",
            response.body,
          );
        } catch {
          // Drive sync is best-effort — never fail the upload itself.
        }
      },
    });

    return Response.json(result);
  } catch (problem) {
    return Response.json({ error: describe(problem, "Upload failed") }, { status: 400 });
  }
}
