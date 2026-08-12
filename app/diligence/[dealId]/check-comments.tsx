"use client";

import { useState } from "react";
import type { Comment } from "@/lib/comments-store";
import { T } from "@/lib/i18n";
import { describe } from "@/lib/errors";
import { useLang } from "@/app/lang-provider";

/**
 * The comment thread under one due-diligence check.
 *
 * Separate from the memo above it: the memo is one analyst's working note and
 * gets overwritten, a comment is addressed to colleagues, keeps its author and
 * stays. This is where "this company doesn't satisfy X" gets recorded so the
 * rest of the team sees it.
 */
export default function CheckComments({
  dealId,
  checkId,
  initial,
  viewerEmail,
}: {
  dealId: string;
  checkId: string;
  initial: Comment[];
  viewerEmail: string | null;
}) {
  const { t } = useLang();

  const [comments, setComments] = useState<Comment[]>(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post() {
    const body = draft.trim();
    if (!body) return;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/deals/${dealId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkId, body }),
      });

      const parsed = await response.json().catch(() => null);
      if (!response.ok) throw new Error(parsed?.error ?? `${response.status}`);

      setComments((current) => [...current, parsed as Comment]);
      setDraft("");
    } catch (problem) {
      setError(describe(problem));
    } finally {
      setBusy(false);
    }
  }

  async function remove(comment: Comment) {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/deals/${dealId}/comments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkId, commentId: comment.id }),
      });

      const parsed = await response.json().catch(() => null);
      if (!response.ok) throw new Error(parsed?.error ?? `${response.status}`);

      setComments((current) => current.filter((item) => item.id !== comment.id));
    } catch (problem) {
      setError(describe(problem));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 ml-8 border-t border-neutral-200 pt-3 dark:border-neutral-800">
      <p className="text-xs font-medium text-neutral-500">
        {t(T.comments)}
        {comments.length > 0 && ` (${comments.length})`}
      </p>

      {comments.length === 0 ? (
        <p className="mt-1.5 text-xs text-neutral-400">{t(T.noComments)}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-900"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-medium">{comment.author}</span>
                <span className="shrink-0 text-[11px] text-neutral-400">
                  {new Date(comment.createdAt).toLocaleString()}
                </span>
              </div>

              <p className="mt-1 text-sm whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
                {comment.body}
              </p>

              {/* Only your own - a colleague's warning isn't yours to remove.
                  The server enforces this too; this just hides a button that
                  would always fail. */}
              {comment.author === viewerEmail && (
                <button
                  type="button"
                  onClick={() => remove(comment)}
                  disabled={busy}
                  className="mt-1 text-[11px] text-neutral-400 transition-colors hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
                >
                  {t(T.deleteComment)}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={2}
          placeholder={t(T.commentPlaceholder)}
          className="block w-full resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-950"
        />

        <div className="mt-1.5 flex items-center gap-2">
          <button
            type="button"
            onClick={post}
            disabled={busy || !draft.trim()}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {busy ? t(T.posting) : t(T.postComment)}
          </button>

          {error && (
            <span className="text-xs text-red-600 dark:text-red-400">
              {t(T.commentFailed)} — {error}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
