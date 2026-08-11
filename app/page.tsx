"use client";

import { useEffect, useState } from "react";

type TrackedDocument = {
  id: string;
  nameKo: string;
  nameEn: string;
  purpose: string;
  optional?: boolean;
  files: string[];
  submitted: boolean;
};

type TrackerResponse = {
  documents: TrackedDocument[];
  unrecognized: string[];
  totalRequired: number;
  missingCount: number;
  source: "drive" | "local";
  warning: string | null;
  checkedAt: string;
};

// How often to re-check for new uploads. The brief says every few seconds is fine.
const REFRESH_MS = 5000;

export default function Home() {
  const [data, setData] = useState<TrackerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const response = await fetch("/api/documents");
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        const json: TrackerResponse = await response.json();
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (problem) {
        if (!cancelled) {
          setError(problem instanceof Error ? problem.message : "Unknown error");
        }
      }
    }

    check();
    const timer = setInterval(check, REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const complete = data ? data.missingCount === 0 : false;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm font-medium tracking-wide text-neutral-500 uppercase">
          SparkLabs Korea
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">서류 취합 트래커</h1>
        <p className="mt-1 text-neutral-500">
          Document Collection Tracker &middot; 샘플주식회사
        </p>
      </header>

      {/* Headline status - the number a reviewer actually cares about */}
      <section
        className={`rounded-xl border p-6 ${
          complete
            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
            : "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
        }`}
      >
        {!data && !error && <p className="text-neutral-500">확인 중…</p>}

        {error && (
          <p className="text-red-600 dark:text-red-400">
            서류 목록을 불러오지 못했습니다 — {error}
          </p>
        )}

        {data && (
          <>
            <p className="text-2xl font-semibold">
              {complete
                ? "필수 서류 모두 제출 완료"
                : `${data.totalRequired}건 중 ${data.missingCount}건 미비`}
            </p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {complete
                ? "All required documents received."
                : `${data.missingCount} of ${data.totalRequired} required documents still missing.`}
            </p>
          </>
        )}
      </section>

      {data?.warning && (
        <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {data.warning}
        </p>
      )}

      {/* The checklist itself */}
      <ul className="mt-8 divide-y divide-neutral-200 dark:divide-neutral-800">
        {data?.documents.map((document) => (
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
                <span className="font-medium">{document.nameKo}</span>
                <span className="text-sm text-neutral-500">{document.nameEn}</span>
                {document.optional && (
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800">
                    선택
                  </span>
                )}
              </div>

              <p className="mt-0.5 text-sm text-neutral-500">{document.purpose}</p>

              {document.submitted ? (
                <ul className="mt-1.5">
                  {document.files.map((file) => (
                    <li
                      key={file}
                      className="truncate font-mono text-xs text-emerald-700 dark:text-emerald-400"
                    >
                      {file}
                    </li>
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
                  {document.optional ? "미제출 (선택 서류)" : "미비"}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Files we found but couldn't identify - catches naming mistakes */}
      {data && data.unrecognized.length > 0 && (
        <section className="mt-8 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-sm font-medium">분류되지 않은 파일</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Uploaded, but the filename didn&apos;t match any required document.
          </p>
          <ul className="mt-2">
            {data.unrecognized.map((file) => (
              <li key={file} className="truncate font-mono text-xs text-neutral-500">
                {file}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-8 text-xs text-neutral-400">
        {data && (
          <>
            출처 {data.source === "drive" ? "Google Drive" : "로컬 폴더 (sample-drive)"}{" "}
            &middot; 마지막 확인 {new Date(data.checkedAt).toLocaleTimeString()} &middot; 자동
            새로고침 {REFRESH_MS / 1000}초
          </>
        )}
      </footer>
    </main>
  );
}
