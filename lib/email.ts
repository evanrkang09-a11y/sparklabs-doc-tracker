/**
 * Email notifications via Resend.
 *
 * Requires RESEND_API_KEY in environment. All functions silently no-op when
 * the key is absent so the app works in dev without an account configured.
 *
 * RESEND_FROM_EMAIL defaults to "SparkLabs Korea <noreply@sparklabs.co.kr>".
 * ADMIN_NOTIFY_EMAIL is the address that receives upload alerts (falls back
 * to ADMIN_EMAIL).
 */

import { Resend } from "resend";

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const FROM = process.env.RESEND_FROM_EMAIL ?? "SparkLabs Korea <noreply@sparklabs.co.kr>";

export async function notifyAdminOfUpload({
  companyName,
  filename,
  dealId,
}: {
  companyName: string;
  filename: string;
  dealId: string;
}): Promise<void> {
  const client = getClient();
  if (!client) return;

  const to = process.env.ADMIN_NOTIFY_EMAIL ?? process.env.ADMIN_EMAIL;
  if (!to) return;

  await client.emails.send({
    from: FROM,
    to,
    subject: `[SparkLabs] ${companyName} uploaded a document`,
    html: `
      <p><strong>${companyName}</strong> just uploaded a new file to the SparkLabs portal.</p>
      <p><strong>File:</strong> ${filename}</p>
      <p><a href="${process.env.NEXTAUTH_URL ?? "https://sparklabs-doc-tracker.vercel.app"}/deal/${dealId}">View in portal →</a></p>
    `,
  });
}

export async function notifyStartupOfMessage({
  startupEmail,
  companyName,
  senderName,
  messageText,
  dealId,
}: {
  startupEmail: string;
  companyName: string;
  senderName: string;
  messageText: string;
  dealId: string;
}): Promise<void> {
  const client = getClient();
  if (!client) return;

  await client.emails.send({
    from: FROM,
    to: startupEmail,
    subject: `[SparkLabs] New message from ${senderName}`,
    html: `
      <p>You have a new message from the SparkLabs team.</p>
      <blockquote style="border-left:3px solid #6366f1;padding:8px 16px;margin:12px 0;color:#374151;">
        ${messageText.replace(/\n/g, "<br>")}
      </blockquote>
      <p><a href="${process.env.NEXTAUTH_URL ?? "https://sparklabs-doc-tracker.vercel.app"}/startup/${dealId}">Open your portal to reply →</a></p>
      <p style="color:#9ca3af;font-size:12px;">SparkLabs Korea Investment Portal · ${companyName}</p>
    `,
  });
}
