"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import type { Deal } from "@/lib/deals";
import { T } from "@/lib/i18n";
import { describe } from "@/lib/errors";
import { useLang } from "@/app/lang-provider";

type FoundFile = { name: string; source: "upload" | "drive" };

type Suggestion = {
  filename: string;
  documentId: string;
  documentNameKo: string;
  documentNameEn: string;
  confidence: number;
  reason: string;
};

type TrackedDocument = {
  id: string;
  nameKo: string;
  nameEn: string;
  note?: string;
  noteEn?: string;
  optional?: boolean;
  files: FoundFile[];
  submitted: boolean;
};

type StatusResponse = {
  documents: TrackedDocument[];
  unrecognized: FoundFile[];
  totalRequired: number;
  missingCount: number;
  warnings: string[];
  checkedAt: string;
};

const REFRESH_MS = 5000;

export default function DealTracker({ deal }: { deal: Deal }) {
  const { lang, t, pick, both } = useLang();

  const [data, setData] = useState<StatusResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [busyWith, setBusyWith] = useState<string | null>(null);
  const [percent, setPercent] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [classifying, setClassifying] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [classifyError, setClassifyError] = useState<string | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/deals/${deal.id}/status`);
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      setData(await response.json());
      setLoadError(null);
    } catch (problem) {
      setLoadError(describe(problem));
    }
  }, [deal.id]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  async function sendFiles(files: File[]) {
    setUploadError(null);

    for (const file of files) {
      setBusyWith(file.name);
      setPercent(0);

      try {
        await upload(`deals/${deal.id}/${file.name}`, file, {
          access: "private",
          handleUploadUrl: "/api/upload",
          onUploadProgress: ({ percentage }) => setPercent(percentage),
        });
      } catch (problem) {
        setUploadError(`${file.name} — ${t(T.uploadFailed)}: ${describe(problem)}`);
        break;
      }
    }

    setBusyWith(null);
    setPercent(0);
    if (fileInput.current) fileInput.current.value = "";
    await refresh();
  }

  async function removeFile(name: string) {
    // Blob deletes are permanent, and the company would have to find and
    // re-upload the file. Worth one click of friction.
    if (!confirm(`"${name}"\n\n${t(T.confirmDelete)}`)) return;

    setDeleting(name);
    setUploadError(null);

    try {
      const response = await fetch(`/api/deals/${deal.id}/files`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: name }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `${response.status}`);
      }

      await refresh();
    } catch (problem) {
      setUploadError(`${name} — ${t(T.deleteFailed)}: ${describe(problem)}`);
    } finally {
      setDeleting(null);
    }
  }

  async function classifyUnknown() {
    setClassifying(true);
    setClassifyError(null);
    setSuggestions(null);

    try {
      const response = await fetch(`/api/deals/${deal.id}/classify`, { method: "POST" });
      // .catch here like the other two call sites - without it a non-JSON error
      // response surfaces to the user as a JSON parser message.
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? `${response.status}`);
      setSuggestions(body.suggestions);
    } catch (problem) {
      setClassifyError(describe(problem));
    } finally {
      setClassifying(false);
    }
  }

  const complete = data ? data.missingCount === 0 : false;
  const [companyName, otherCompanyName] = both(deal.companyKo, deal.companyEn);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-8">
        <p className="text-sm font-medium tracking-wide text-neutral-500 uppercase">
          {t(T.preInvestmentDocs)}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{companyName}</h1>
        <p className="mt-1 text-neutral-500">
          {otherCompanyName} &middot;{" "}
          {t(deal.market === "overseas" ? T.overseasCompany : T.domesticCompany)}
        </p>
      </header>

      {/* Headline status */}
      <section
        className={`rounded-xl border p-6 ${
          complete
            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
            : "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
        }`}
      >
        {!data && !loadError && <p className="text-neutral-500">{t(T.checking)}</p>}

        {loadError && (
          <p className="text-red-600 dark:text-red-400">
            {t(T.loadFailed)} — {loadError}
          </p>
        )}

        {data && (
          <>
            <p className="text-2xl font-semibold">
              {complete
                ? t(T.allSubmitted)
                : lang === "ko"
                  ? `${data.totalRequired}건 중 ${data.missingCount}건 미비`
                  : `${data.missingCount} of ${data.totalRequired} still missing`}
            </p>
            {complete && (
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {t(T.allSubmittedSub)}
              </p>
            )}
          </>
        )}
      </section>

      {data?.warnings.map((warning) => (
        <p
          key={warning}
          className="mt-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {warning}
        </p>
      ))}

      {/* Upload area */}
      <section
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          sendFiles(Array.from(event.dataTransfer.files));
        }}
        className={`mt-6 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
            : "border-neutral-300 dark:border-neutral-700"
        }`}
      >
        <p className="font-medium">{t(T.dropHere)}</p>
        <p className="mt-1 text-sm text-neutral-500">{t(T.dropHereSub)}</p>

        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) sendFiles(Array.from(event.target.files));
          }}
        />

        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busyWith !== null}
          className="mt-4 rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {busyWith ? t(T.uploading) : t(T.chooseFiles)}
        </button>

        <p className="mt-3 text-xs text-neutral-400">{t(T.namingHint)}</p>

        {busyWith && (
          <div className="mt-4">
            <p className="truncate text-sm text-neutral-500">
              {busyWith} — {percent}%
            </p>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}

        {uploadError && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">{uploadError}</p>
        )}
      </section>

      {/* The checklist */}
      <ul className="mt-8 divide-y divide-neutral-200 dark:divide-neutral-800">
        {data?.documents.map((document) => {
          const note = pick(document.note ?? "", document.noteEn ?? document.note ?? "");
          const [docName, otherDocName] = both(document.nameKo, document.nameEn);

          return (
            <li key={document.id} className="flex gap-4 py-4">
              <span
                aria-hidden
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  document.submitted
                    ? "bg-emerald-600 text-white"
                    : "bg-neutral-200 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-600"
                }`}
              >
                {document.submitted ? "✓" : "—"}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{docName}</span>
                  <span className="text-sm text-neutral-500">{otherDocName}</span>
                  {document.optional && (
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800">
                      {t(T.ifApplicable)}
                    </span>
                  )}
                </div>

                {note && <p className="mt-0.5 text-xs text-neutral-400">{note}</p>}

                {document.submitted ? (
                  <ul className="mt-1.5">
                    {document.files.map((file) => (
                      <FileLine
                        key={`${file.source}:${file.name}`}
                        file={file}
                        tone="found"
                        deleting={deleting === file.name}
                        onRemove={() => removeFile(file.name)}
                      />
                    ))}
                  </ul>
                ) : (
                  <p
                    className={`mt-1.5 text-xs font-medium ${
                      document.optional
                        ? "text-neutral-400"
                        : "text-amber-700 dark:text-amber-500"
                    }`}
                  >
                    {t(document.optional ? T.notSubmittedOptional : T.notSubmitted)}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Files we couldn't identify */}
      {data && data.unrecognized.length > 0 && (
        <section className="mt-8 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium">{t(T.unclassified)}</h2>
              <p className="mt-0.5 text-xs text-neutral-500">{t(T.unclassifiedSub)}</p>
            </div>

            <button
              type="button"
              onClick={classifyUnknown}
              disabled={classifying}
              className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              {classifying ? t(T.aiWorking) : t(T.aiGuess)}
            </button>
          </div>

          <ul className="mt-2">
            {data.unrecognized.map((file) => (
              <FileLine
                key={`${file.source}:${file.name}`}
                file={file}
                tone="unknown"
                deleting={deleting === file.name}
                onRemove={() => removeFile(file.name)}
              />
            ))}
          </ul>

          {classifyError && (
            <p className="mt-3 text-xs text-red-600 dark:text-red-400">
              {t(T.aiFailed)} — {classifyError}
            </p>
          )}

          {suggestions?.length === 0 && (
            <p className="mt-3 text-xs text-neutral-500">{t(T.aiNoIdea)}</p>
          )}

          {suggestions && suggestions.length > 0 && (
            <div className="mt-3 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900">
              <p className="text-xs text-neutral-500">{t(T.aiResultNote)}</p>
              <ul className="mt-2 space-y-1.5">
                {suggestions.map((guess) => (
                  <li key={guess.filename} className="text-xs">
                    <span className="font-mono text-neutral-500">{guess.filename}</span>
                    <span className="mx-1.5 text-neutral-400">→</span>
                    <span className="font-medium">
                      {pick(guess.documentNameKo, guess.documentNameEn)}
                    </span>
                    <span className="ml-1.5 text-neutral-400">
                      {t(T.confidence)} {Math.round(guess.confidence * 100)}%
                    </span>
                    {guess.reason && (
                      <span className="mt-0.5 block text-neutral-400">{guess.reason}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <footer className="mt-8 text-xs text-neutral-400">
        {data && (
          <>
            {t(T.lastChecked)} {new Date(data.checkedAt).toLocaleTimeString()} &middot;{" "}
            {t(T.autoRefresh)} {REFRESH_MS / 1000}
            {t(T.seconds)}
          </>
        )}
      </footer>
    </main>
  );
}

/**
 * One filename, with a remove button when we're the ones who stored it.
 * Drive files aren't ours to delete - the app only has read access there.
 */
function FileLine({
  file,
  tone,
  deleting,
  onRemove,
}: {
  file: FoundFile;
  tone: "found" | "unknown";
  deleting: boolean;
  onRemove: () => void;
}) {
  // Same client module as the provider's consumer, so it can read the language
  // itself rather than have three labels threaded in from both call sites.
  const { t } = useLang();
  const deleteLabel = t(T.deleteLabel);

  return (
    <li className="group flex items-center gap-2">
      <span
        className={`truncate font-mono text-xs ${
          tone === "found"
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-neutral-500"
        }`}
      >
        {file.name}
        {file.source === "drive" && (
          <span className="ml-1 font-sans text-neutral-400">{t(T.fromDrive)}</span>
        )}
      </span>

      {file.source === "upload" && (
        <button
          type="button"
          onClick={onRemove}
          disabled={deleting}
          aria-label={`${deleteLabel}: ${file.name}`}
          title={deleteLabel}
          className="shrink-0 text-xs text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:text-red-600 disabled:opacity-100 dark:hover:text-red-400"
        >
          {deleting ? t(T.deleting) : "✕"}
        </button>
      )}
    </li>
  );
}
