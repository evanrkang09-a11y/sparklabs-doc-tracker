/**
 * Comments left on a due-diligence check, so the team can raise problems where
 * everyone will see them.
 *
 * Distinct from the memo already attached to each check: the memo is one
 * analyst's working note and gets overwritten, a comment is addressed to
 * colleagues, keeps its author, and stays.
 *
 * Stored one blob per comment:
 *
 *   comments/<dealId>/<checkId>/<timestamp>-<random>.json
 *
 * Deliberately NOT one JSON file per deal like the other stores. Those do
 * read-modify-write, where the later of two simultaneous saves wins. That's
 * tolerable for a checkbox someone re-ticks; it is not tolerable for comments,
 * where losing one means a colleague's warning silently disappears. A file per
 * comment means writers never touch each other's data.
 */

import { del, get, list, put } from "@vercel/blob";

export type Comment = {
  id: string;
  checkId: string;
  /** Who wrote it - the signed-in email, so notes are attributable. */
  author: string;
  body: string;
  createdAt: string;
};

/** Comments are for a paragraph of context, not an essay. */
const MAX_BODY_LENGTH = 4000;

function prefixFor(dealId: string, checkId?: string): string {
  return checkId ? `comments/${dealId}/${checkId}/` : `comments/${dealId}/`;
}

/** Fetching one page in its own function keeps TypeScript out of a loop. */
function listPage(prefix: string, cursor: string | undefined) {
  return list({ prefix, cursor, limit: 1000 });
}

/**
 * Every comment on a deal, grouped by which check it belongs to.
 *
 * One listing plus one fetch per comment. At the volume a checklist attracts
 * that's fine; if a deal ever collects hundreds, this is the thing to change.
 */
export async function readComments(
  dealId: string,
): Promise<Record<string, Comment[]>> {
  const prefix = prefixFor(dealId);
  const paths: string[] = [];
  let cursor: string | undefined = undefined;

  do {
    const page = await listPage(prefix, cursor);
    for (const blob of page.blobs) {
      if (blob.pathname !== prefix) paths.push(blob.pathname);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  const loaded = await Promise.all(paths.map(readOne));

  const byCheck: Record<string, Comment[]> = {};
  for (const comment of loaded) {
    if (!comment) continue;
    (byCheck[comment.checkId] ??= []).push(comment);
  }

  // Oldest first, so a thread reads top to bottom.
  for (const comments of Object.values(byCheck)) {
    comments.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  return byCheck;
}

export async function addComment(
  dealId: string,
  checkId: string,
  author: string,
  body: string,
): Promise<Comment> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Comment is empty");

  const createdAt = new Date().toISOString();
  // Timestamp sorts, random suffix keeps two comments in the same millisecond
  // from landing on the same path.
  const id = `${createdAt.replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 8)}`;

  const comment: Comment = {
    id,
    checkId,
    author,
    body: trimmed.slice(0, MAX_BODY_LENGTH),
    createdAt,
  };

  await put(`${prefixFor(dealId, checkId)}${id}.json`, JSON.stringify(comment), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: "application/json",
  });

  return comment;
}

/**
 * Removes a comment, but only if `requiredAuthor` actually wrote it.
 *
 * The author is read back off the stored comment rather than taken from the
 * caller. Trusting a caller-supplied author would make the check meaningless:
 * anyone could send their own address and delete a colleague's warning.
 */
export async function deleteComment(
  dealId: string,
  checkId: string,
  commentId: string,
  requiredAuthor: string,
): Promise<void> {
  // Rebuild the path from the ids rather than trusting a caller-supplied one,
  // so nothing outside this deal's comments can be reached.
  if (commentId.includes("/") || checkId.includes("/")) {
    throw new Error("Invalid comment reference");
  }

  const pathname = `${prefixFor(dealId, checkId)}${commentId}.json`;
  const existing = await readOne(pathname);

  if (!existing) throw new Error("Comment not found");
  if (existing.author !== requiredAuthor) {
    throw new Error("You can only delete your own comments");
  }

  await del(pathname);
}

/** Removes every comment on a deal. Used when a company is deleted outright. */
export async function deleteAllComments(dealId: string): Promise<void> {
  const prefix = prefixFor(dealId);
  let cursor: string | undefined = undefined;
  const paths: string[] = [];

  do {
    const page = await listPage(prefix, cursor);
    for (const blob of page.blobs) paths.push(blob.pathname);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  if (paths.length > 0) await del(paths);
}

async function readOne(pathname: string): Promise<Comment | null> {
  try {
    const found = await get(pathname, { access: "private", useCache: false });
    if (!found?.stream) return null;

    const raw: unknown = JSON.parse(await new Response(found.stream).text());
    if (typeof raw !== "object" || raw === null) return null;

    const { id, checkId, author, body, createdAt } = raw as Partial<Comment>;
    if (typeof id !== "string" || typeof checkId !== "string") return null;

    return {
      id,
      checkId,
      author: typeof author === "string" ? author : "",
      body: typeof body === "string" ? body : "",
      createdAt: typeof createdAt === "string" ? createdAt : "",
    };
  } catch {
    // One unreadable comment shouldn't blank the whole thread.
    return null;
  }
}
