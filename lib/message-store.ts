/**
 * Messages between SparkLabs and a portfolio company.
 *
 * Each deal has one thread. Messages are appended and the whole thread is
 * returned in order. Keeping it simple: no read receipts, no threading,
 * just a chronological list.
 *
 * Stored at messages/{dealId}.json in private Vercel Blob.
 */

import { get, put } from "@vercel/blob";

export type MessageSender = "sparklabs" | "startup";

export type Message = {
  id: string;
  sender: MessageSender;
  senderName: string;
  text: string;
  sentAt: string; // ISO timestamp
};

function pathFor(dealId: string): string {
  return `messages/${dealId}.json`;
}

async function readThread(dealId: string): Promise<Message[]> {
  try {
    const found = await get(pathFor(dealId), {
      access: "private",
      useCache: false,
    });
    if (!found) return [];
    return (await new Response(found.stream).json()) as Message[];
  } catch {
    return [];
  }
}

async function writeThread(dealId: string, messages: Message[]): Promise<void> {
  await put(pathFor(dealId), JSON.stringify(messages, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

export async function getThread(dealId: string): Promise<Message[]> {
  return readThread(dealId);
}

export async function postMessage(
  dealId: string,
  sender: MessageSender,
  senderName: string,
  text: string,
): Promise<Message> {
  const messages = await readThread(dealId);
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const message: Message = {
    id,
    sender,
    senderName,
    text: text.trim(),
    sentAt: new Date().toISOString(),
  };
  await writeThread(dealId, [...messages, message]);
  return message;
}
