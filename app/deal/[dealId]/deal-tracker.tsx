"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import type { Deal } from "@/lib/deals";

type FoundFile = { name: string; source: "upload" | "drive" };

type TrackedDocument = {
  id: string;
  nameKo: string;
  nameEn: string;
  note?: string;
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
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [busyWith, setBusyWith] = useState<string | null>(null);
  const [percent, setPercent] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/deals/${deal.id}/status`);
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      setData(await response.json());
      setLoadError(null);
    } catch (problem) {
      setLoadError(problem instanceof Error ? problem.message : "Unknown error");
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
        const reason = problem instanceof Error ? problem.message : "알 수 없는 오류";
        setUploadError(`${file.name} 업로드 실패 — ${reason}`);
        break;
      }
    }

    setBusyWith(null);
    setPercent(0);
    if (fileInput.current) fileInput.current.value = "";
    await refresh();
  }

  const complete = data ? data.missingCount === 0 : false;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm font-medium tracking-wide text-neutral-500 uppercase">
          SparkLabs Korea &middot; 투자 전 제출 서류
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{deal.companyKo}</h1>
        <p className="mt-1 text-neutral-500">
          {deal.companyEn} &middot; {deal.market === "overseas" ? "해외 기업" : "국내 기업"}
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
        {!data && !loadError && <p className="text-neutral-500">확인 중…</p>}

        {loadError && (
          <p className="text-red-600 dark:text-red-400">
            서류 현황을 불러오지 못했습니다 — {loadError}
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
                ? "All required documents received. Thank you."
                : `${data.missingCount} of ${data.totalRequired} required documents still missing.`}
            </p>
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
        <p className="font-medium">서류를 여기에 끌어다 놓으세요</p>
        <p className="mt-1 text-sm text-neutral-500">
          Drag files here, or choose them below. 여러 개를 한 번에 올려도 됩니다.
        </p>

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
          {busyWith ? "업로드 중…" : "파일 선택"}
        </button>

        <p className="mt-3 text-xs text-neutral-400">
          파일명에 서류 이름이 들어가야 자동으로 분류됩니다. 예: 사업자등록증_회사명.pdf
        </p>

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
                    해당 시
                  </span>
                )}
              </div>

              {document.note && (
                <p className="mt-0.5 text-xs text-neutral-400">{document.note}</p>
              )}

              {document.submitted ? (
                <ul className="mt-1.5">
                  {document.files.map((file) => (
                    <li
                      key={`${file.source}:${file.name}`}
                      className="truncate font-mono text-xs text-emerald-700 dark:text-emerald-400"
                    >
                      {file.name}
                      {file.source === "drive" && (
                        <span className="ml-1 font-sans text-neutral-400">(드라이브)</span>
                      )}
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
                  {document.optional ? "미제출 (해당 시 제출)" : "미비"}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Files we couldn't identify */}
      {data && data.unrecognized.length > 0 && (
        <section className="mt-8 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-sm font-medium">분류되지 않은 파일</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            업로드는 되었지만 어떤 서류인지 파일명으로 판별하지 못했습니다.
          </p>
          <ul className="mt-2">
            {data.unrecognized.map((file) => (
              <li
                key={`${file.source}:${file.name}`}
                className="truncate font-mono text-xs text-neutral-500"
              >
                {file.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-8 text-xs text-neutral-400">
        {data && (
          <>
            마지막 확인 {new Date(data.checkedAt).toLocaleTimeString()} &middot; 자동
            새로고침 {REFRESH_MS / 1000}초
          </>
        )}
      </footer>
    </main>
  );
}
