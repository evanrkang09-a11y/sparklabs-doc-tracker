"use client";

import { useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import type { Deal } from "@/lib/deals";
import {
  DESTINATION_LABEL,
  FUND_TYPES,
  INVESTMENT_STRUCTURES,
  fundTypeAllowed,
  operatingInstructionDocs,
  postPaymentDeadlines,
  postPaymentDocs,
  type ExecutionDoc,
  type FundType,
  type InvestmentStructure,
} from "@/lib/execution";
import type { ExecutionRecord, NumberSet } from "@/lib/execution-store";
import { describe } from "@/lib/errors";
import { useLang } from "@/app/lang-provider";
import StageReviewPanel from "@/app/stage-review-panel";
import PhaseDateEditor from "@/app/phase-date-editor";
import EmailDrafts from "./email-drafts";

/**
 * 투자 집행: the two stages after the contract is signed — instructing the
 * bank to pay (운용지시) and collecting the documents due back afterwards
 * (투자납입 후), against the custodian-bank deadline.
 *
 * The whole record saves on a short debounce, so ticking a box or changing a
 * date just persists — there is no save button to forget.
 */
export default function ExecutionTracker({
  deal,
  initial,
  agreementNumbers,
}: {
  deal: Deal;
  initial: ExecutionRecord;
  /** The three figures the signed contract fixes, to cross-check against. */
  agreementNumbers: NumberSet;
}) {
  const { lang, pick } = useLang();
  const ko = lang === "ko";

  const [record, setRecord] = useState<ExecutionRecord>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Upload state
  const [oiUploading, setOiUploading] = useState<string | null>(null);
  const [postUploading, setPostUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Overseas deals can only run on a private fund - never 모태.
  const effectiveFundType: FundType | null =
    deal.market === "overseas" ? "private" : record.fundType;

  function scheduleSave(next: ExecutionRecord) {
    if (timer.current) clearTimeout(timer.current);
    setStatus("saving");
    timer.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/deals/${deal.id}/execution`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        const parsed = await response.json().catch(() => null);
        if (!response.ok) throw new Error(parsed?.error ?? `${response.status}`);
        setStatus("saved");
        setError(null);
      } catch (problem) {
        setStatus("error");
        setError(describe(problem));
      }
    }, 700);
  }

  function update(patch: Partial<ExecutionRecord>) {
    setRecord((current) => {
      const next = { ...current, ...patch };
      scheduleSave(next);
      return next;
    });
  }

  const toggleOi = (id: string) =>
    update({ oiChecks: { ...record.oiChecks, [id]: !record.oiChecks[id] } });
  const togglePost = (id: string) =>
    update({ postChecks: { ...record.postChecks, [id]: !record.postChecks[id] } });

  function setOiComment(id: string, text: string) {
    const next = { ...record.oiComments };
    if (text) next[id] = text; else delete next[id];
    update({ oiComments: next });
  }
  function setPostComment(id: string, text: string) {
    const next = { ...record.postComments };
    if (text) next[id] = text; else delete next[id];
    update({ postComments: next });
  }

  const [aiNumbersBusy, setAiNumbersBusy] = useState(false);
  async function aiFillNumbers() {
    setAiNumbersBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/deals/${deal.id}/execution/ai-numbers`, {
        method: "POST",
      });
      const parsed = await response.json().catch(() => null);
      if (!response.ok) throw new Error(parsed?.error ?? `${response.status}`);
      update({
        consistency: {
          instruction: parsed.instruction ?? record.consistency.instruction,
          minutes: parsed.minutes ?? record.consistency.minutes,
        },
      });
    } catch (problem) {
      setError(describe(problem));
    } finally {
      setAiNumbersBusy(false);
    }
  }

  // --- OI upload handlers ---------------------------------------------------

  async function uploadOiFile(docId: string, file: File) {
    setOiUploading(docId);
    setUploadError(null);
    try {
      await upload(`execution-oi/${deal.id}/${docId}/${file.name}`, file, {
        access: "private",
        handleUploadUrl: "/api/upload",
      });
      update({ oiUploads: { ...record.oiUploads, [docId]: file.name } });
    } catch (problem) {
      setUploadError(describe(problem));
    } finally {
      setOiUploading(null);
    }
  }

  async function deleteOiFile(docId: string, filename: string) {
    setUploadError(null);
    try {
      const res = await fetch(`/api/deals/${deal.id}/execution/oi-files`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId, filename }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `${res.status}`);
      const { [docId]: _r, ...rest } = record.oiUploads;
      update({ oiUploads: rest });
    } catch (problem) {
      setUploadError(describe(problem));
    }
  }

  // --- Post-payment upload handlers -----------------------------------------

  async function uploadPostFile(docId: string, file: File) {
    setPostUploading(docId);
    setUploadError(null);
    try {
      await upload(`execution-post/${deal.id}/${docId}/${file.name}`, file, {
        access: "private",
        handleUploadUrl: "/api/upload",
      });
      update({ postUploads: { ...record.postUploads, [docId]: file.name } });
    } catch (problem) {
      setUploadError(describe(problem));
    } finally {
      setPostUploading(null);
    }
  }

  async function deletePostFile(docId: string, filename: string) {
    setUploadError(null);
    try {
      const res = await fetch(`/api/deals/${deal.id}/execution/post-files`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId, filename }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `${res.status}`);
      const { [docId]: _r, ...rest } = record.postUploads;
      update({ postUploads: rest });
    } catch (problem) {
      setUploadError(describe(problem));
    }
  }

  const oiDocs = effectiveFundType
    ? operatingInstructionDocs(deal.market, effectiveFundType)
    : [];
  const postDocs = record.structure
    ? postPaymentDocs(deal.market, record.structure)
    : [];

  const oiDone = oiDocs.filter((d) => record.oiChecks[d.id]).length;
  const postDone = postDocs.filter((d) => record.postChecks[d.id]).length;

  const deadlines = useMemo(
    () => postPaymentDeadlines(record.paymentDate),
    [record.paymentDate],
  );

  // 운용지시일 and 납입일 must differ by at least one day.
  const dateWarning = useMemo(() => {
    if (!record.instructionDate || !record.paymentDate) return false;
    const a = new Date(record.instructionDate);
    const b = new Date(record.paymentDate);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
    return b.getTime() <= a.getTime();
  }, [record.instructionDate, record.paymentDate]);

  return (
    <div className="w-full px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {pick(deal.companyKo, deal.companyEn)} · {ko ? "투자 집행" : "Execution"}
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            {ko
              ? "계약 체결 후 — 운용지시(투자금 납입)와 투자납입 후 서류 절차"
              : "After signing — operating instruction (payout) and post-payment documents"}
          </p>
        </div>
        <SaveStatus status={status} ko={ko} />
      </div>

      {/* Progress summary */}
      <div className="mb-4 flex flex-wrap gap-2">
        <ProgressPill
          label={ko ? "운용지시 서류" : "OI docs"}
          done={oiDone}
          total={oiDocs.length}
          empty={!effectiveFundType}
          ko={ko}
        />
        <ProgressPill
          label={ko ? "투자납입 후 서류" : "Post-payment docs"}
          done={postDone}
          total={postDocs.length}
          empty={!record.structure}
          ko={ko}
        />
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {uploadError && (
        <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          {uploadError}
        </p>
      )}

      {/* Configuration */}
      <section className="mb-5 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="mb-3 text-sm font-semibold">{ko ? "기본 설정" : "Setup"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-[11px] font-medium text-neutral-500">
              {ko ? "펀드 종류" : "Fund type"}
            </label>
            <select
              value={effectiveFundType ?? ""}
              disabled={deal.market === "overseas"}
              onChange={(e) => update({ fundType: (e.target.value || null) as FundType | null })}
              className={selectClass}
            >
              <option value="">{ko ? "선택…" : "Choose…"}</option>
              {FUND_TYPES.filter((f) => fundTypeAllowed(deal.market, f.value)).map((f) => (
                <option key={f.value} value={f.value}>
                  {ko ? f.ko : f.en}
                </option>
              ))}
            </select>
            {deal.market === "overseas" && (
              <p className="mt-0.5 text-[10px] text-neutral-400">
                {ko
                  ? "해외 기업 투자는 민간펀드로만 가능합니다."
                  : "Overseas investments can only use a private fund."}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-medium text-neutral-500">
              {ko ? "투자 구조" : "Investment structure"}
            </label>
            <select
              value={record.structure ?? ""}
              onChange={(e) =>
                update({ structure: (e.target.value || null) as InvestmentStructure | null })
              }
              className={selectClass}
            >
              <option value="">{ko ? "선택…" : "Choose…"}</option>
              {INVESTMENT_STRUCTURES.map((s) => (
                <option key={s.value} value={s.value}>
                  {ko ? s.ko : s.en}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-neutral-500">
              {ko ? "운용지시일" : "Instruction date"}
            </label>
            <input
              type="date"
              value={record.instructionDate}
              onChange={(e) => update({ instructionDate: e.target.value })}
              className={selectClass}
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-neutral-500">
              {ko ? "납입일" : "Payment date"}
            </label>
            <input
              type="date"
              value={record.paymentDate}
              onChange={(e) => update({ paymentDate: e.target.value })}
              className={selectClass}
            />
          </div>
        </div>

        {dateWarning && (
          <p className="mt-3 rounded bg-amber-100 px-2 py-1.5 text-[11px] text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
            {ko
              ? "⚠ 운용지시일과 납입일은 최소 하루 이상 차이가 나야 합니다 (은행 영업시간 고려)."
              : "⚠ The instruction date and payment date must differ by at least one day (bank hours)."}
          </p>
        )}

        <p className="mt-3 text-[11px] text-neutral-400">
          {ko
            ? "💡 민간펀드는 납입일 오전에 바로 납입됩니다. 모태펀드는 모태 승인 후 오후 3시 즈음 납입됩니다."
            : "💡 Private funds pay out on the morning of the payment date. Fund-of-funds (모태) pay around 3pm, after 모태 approval."}
        </p>
      </section>

      {/* Deadline tracker */}
      {deadlines && (
        <DeadlineBanner target={deadlines.target} hard={deadlines.hard} ko={ko} />
      )}

      {/* AI stage review */}
      <StageReviewPanel dealId={deal.id} stage="execution" />

      {/* 운용지시 서류 */}
      <ChecklistSection
        title={ko ? "운용지시 서류" : "Operating instruction documents"}
        subtitle={
          ko
            ? "투자금 납입(운용지시)을 위해 경영지원본부에 제출하는 서류"
            : "Documents submitted to management support HQ to instruct payout"
        }
        done={oiDone}
        total={oiDocs.length}
        empty={
          !effectiveFundType
            ? ko
              ? "펀드 종류를 먼저 선택하세요."
              : "Choose a fund type first."
            : null
        }
        docs={oiDocs}
        checks={record.oiChecks}
        onToggle={toggleOi}
        ko={ko}
        pick={pick}
        uploads={record.oiUploads}
        uploading={oiUploading}
        dealId={deal.id}
        fileRoute="oi-files"
        onUpload={uploadOiFile}
        onDeleteUpload={deleteOiFile}
        comments={record.oiComments}
        onComment={setOiComment}
      />

      {/* OI management-support email */}
      <OiEmailSection
        deal={deal}
        docs={oiDocs}
        uploads={record.oiUploads}
        fundType={effectiveFundType}
        instructionDate={record.instructionDate}
        paymentDate={record.paymentDate}
        ko={ko}
        pick={pick}
      />

      {/* Consistency check */}
      <ConsistencySection
        agreement={agreementNumbers}
        consistency={record.consistency}
        onChange={(which, field, value) =>
          update({
            consistency: {
              ...record.consistency,
              [which]: { ...record.consistency[which], [field]: value },
            },
          })
        }
        onAiFill={aiFillNumbers}
        aiBusy={aiNumbersBusy}
        ko={ko}
      />

      {/* 투자납입 후 서류 */}
      <ChecklistSection
        title={ko ? "투자납입 후 서류" : "Post-payment documents"}
        subtitle={
          ko
            ? "납입 후 투자기업으로부터 회신받아 수탁은행에 전달하는 서류"
            : "Documents collected from the company after payment and passed to the custodian bank"
        }
        done={postDone}
        total={postDocs.length}
        empty={
          !record.structure
            ? ko
              ? "투자 구조(신주발행/SAFE)를 먼저 선택하세요."
              : "Choose an investment structure first."
            : null
        }
        docs={postDocs}
        checks={record.postChecks}
        onToggle={togglePost}
        ko={ko}
        pick={pick}
        uploads={record.postUploads}
        uploading={postUploading}
        dealId={deal.id}
        fileRoute="post-files"
        onUpload={uploadPostFile}
        onDeleteUpload={deletePostFile}
        comments={record.postComments}
        onComment={setPostComment}
      />

      {deal.market === "overseas" && (
        <p className="mb-5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-[11px] text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
          {ko
            ? "💡 해외 투자: 납입 후 수탁은행이 보내주는 증권취득신고서와 외화송금영수증·전신문을 한국은행에 이메일로 제출해야 합니다."
            : "💡 Overseas: after payment, email the securities acquisition report and the FX remittance receipt/wire message the custodian bank returns to the Bank of Korea."}
        </p>
      )}

      {/* Post-payment email to the company, generated from the config above */}
      <EmailDrafts
        deal={deal}
        structure={record.structure}
        postDocs={postDocs}
        deadlines={deadlines}
      />

      {/* General execution file upload */}
      <MiscExecutionUpload dealId={deal.id} ko={ko} />

      <div className="mt-6">
        <PhaseDateEditor dealId={deal.id} phase="execution" large />
      </div>

    </div>
  );
}

function MiscExecutionUpload({ dealId, ko }: { dealId: string; ko: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      await upload(`deals/${dealId}/execution/misc/${file.name}`, file, {
        access: "private",
        handleUploadUrl: "/api/upload",
      });
      setUploaded((prev) => [...prev, file.name]);
    } catch {
      setError(ko ? "업로드 실패. 다시 시도하세요." : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        {ko ? "기타 집행 서류 업로드" : "Upload additional execution files"}
      </h3>
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 bg-white p-8 text-center transition-colors hover:border-indigo-400 hover:bg-indigo-50/30 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-indigo-600"
      >
        <span className="text-2xl">↑</span>
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {uploading
            ? (ko ? "업로드 중…" : "Uploading…")
            : (ko ? "파일을 드래그하거나 클릭하여 업로드" : "Drop files here or click to upload")}
        </p>
        <p className="text-xs text-neutral-400">
          {ko ? "체크리스트 외 추가 집행 관련 서류" : "Any execution-related files not covered by the checklist above"}
        </p>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>
      {error && (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      )}
      {uploaded.length > 0 && (
        <ul className="mt-2 space-y-1">
          {uploaded.map((name) => (
            <li key={name} className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
              <span>✓</span> {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const selectClass =
  "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm focus:border-neutral-500 focus:outline-none disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950";

function SaveStatus({
  status,
  ko,
}: {
  status: "idle" | "saving" | "saved" | "error";
  ko: boolean;
}) {
  const text = {
    idle: "",
    saving: ko ? "저장 중…" : "Saving…",
    saved: ko ? "저장됨" : "Saved",
    error: ko ? "저장 실패" : "Save failed",
  }[status];

  if (!text) return null;
  return (
    <span
      className={`text-xs ${
        status === "error" ? "text-red-600 dark:text-red-400" : "text-neutral-400"
      }`}
    >
      {text}
    </span>
  );
}

function DeadlineBanner({
  target,
  hard,
  ko,
}: {
  target: Date;
  hard: Date;
  ko: boolean;
}) {
  const now = new Date();
  const dayMs = 1000 * 60 * 60 * 24;
  const daysToHard = Math.ceil((hard.getTime() - now.getTime()) / dayMs);
  const daysToTarget = Math.ceil((target.getTime() - now.getTime()) / dayMs);

  const tone =
    daysToHard < 0
      ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
      : daysToHard <= 10
        ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
        : "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40";

  const numColor =
    daysToHard < 0
      ? "text-red-700 dark:text-red-300"
      : daysToHard <= 10
        ? "text-amber-700 dark:text-amber-300"
        : "text-emerald-700 dark:text-emerald-300";

  const textColor =
    daysToHard < 0
      ? "text-red-800 dark:text-red-300"
      : daysToHard <= 10
        ? "text-amber-900 dark:text-amber-200"
        : "text-emerald-900 dark:text-emerald-200";

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <section className={`mb-5 rounded-xl border px-4 py-3 ${tone}`}>
      <div className="flex items-center gap-4">
        <div className="text-center">
          <p className={`text-4xl font-bold tabular-nums leading-none ${numColor}`}>
            {Math.abs(daysToHard)}
          </p>
          <p className={`mt-0.5 text-[10px] font-medium ${textColor}`}>
            {daysToHard < 0 ? (ko ? "일 초과" : "days over") : (ko ? "일 남음" : "days left")}
          </p>
        </div>
        <div className="flex-1">
          <p className={`text-sm font-semibold ${textColor}`}>
            {ko ? "서류 회신 기한" : "Document return deadline"}
          </p>
          <p className={`mt-1 text-xs ${textColor}`}>
            {ko ? "권장 " : "Target "}
            <span className="font-medium">{fmt(target)}</span>
            {ko ? ` (20일, ${daysToTarget < 0 ? "초과" : `${daysToTarget}일 남음`})` : ` (20 days, ${daysToTarget < 0 ? "over" : `${daysToTarget} left`})`}
          </p>
          <p className={`text-xs ${textColor}`}>
            {ko ? "최종 " : "Hard "}
            <span className="font-medium">{fmt(hard)}</span>
            {ko ? " (30일, 수탁은행 원본 도착 기한)" : " (30 days, custodian bank hard limit)"}
          </p>
        </div>
      </div>
    </section>
  );
}

function ChecklistSection({
  title,
  subtitle,
  done,
  total,
  empty,
  docs,
  checks,
  onToggle,
  ko,
  pick,
  uploads,
  uploading,
  dealId,
  fileRoute,
  onUpload,
  onDeleteUpload,
  comments,
  onComment,
}: {
  title: string;
  subtitle: string;
  done: number;
  total: number;
  empty: string | null;
  docs: ExecutionDoc[];
  checks: Record<string, boolean>;
  onToggle: (id: string) => void;
  ko: boolean;
  pick: (ko: string, en: string) => string;
  uploads?: Record<string, string>;
  uploading?: string | null;
  dealId?: string;
  fileRoute?: string;
  onUpload?: (docId: string, file: File) => void;
  onDeleteUpload?: (docId: string, filename: string) => void;
  comments?: Record<string, string>;
  onComment?: (docId: string, text: string) => void;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && done === total;

  return (
    <section className="mb-5 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {total > 0 && (
          <span className={`text-xs font-medium tabular-nums ${complete ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-400"}`}>
            {done}/{total} · {pct}%
          </span>
        )}
      </div>
      <p className="mb-2 text-[11px] text-neutral-400">{subtitle}</p>

      {total > 0 && (
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${complete ? "bg-emerald-500" : "bg-indigo-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {empty ? (
        <p className="rounded-lg border border-dashed border-neutral-300 px-4 py-6 text-center text-xs text-neutral-400 dark:border-neutral-700">
          {empty}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {docs.map((doc, index) => {
            const checked = checks[doc.id] === true;
            const note = pick(doc.noteKo ?? "", doc.noteEn ?? "");
            return (
              <li
                key={doc.id}
                className={`rounded-lg border px-3 py-2 transition-colors ${
                  checked
                    ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                    : "border-neutral-200 dark:border-neutral-800"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onToggle(doc.id)}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                      checked ? "bg-emerald-500" : "bg-neutral-400 dark:bg-neutral-600"
                    }`}
                  >
                    {checked ? "✓" : String(index + 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${checked ? "text-neutral-500 line-through dark:text-neutral-400" : ""}`}>
                      {pick(doc.nameKo, doc.nameEn)}
                    </span>
                    {note && (
                      <span className="block text-[10px] text-neutral-400">{note}</span>
                    )}
                  </span>
                  {doc.destination && (
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        doc.destination === "custodian"
                          ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                          : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                      }`}
                    >
                      {pick(
                        DESTINATION_LABEL[doc.destination].ko,
                        DESTINATION_LABEL[doc.destination].en,
                      )}
                    </span>
                  )}
                </button>

                {onUpload && dealId && fileRoute && (
                  <div className="mt-1.5 flex items-center gap-2 pl-8">
                    {uploads?.[doc.id] ? (
                      <>
                        <a
                          href={`/api/deals/${dealId}/execution/${fileRoute}?docId=${doc.id}&filename=${encodeURIComponent(uploads[doc.id])}`}
                          download={uploads[doc.id]}
                          className="truncate text-[11px] text-indigo-600 underline hover:text-indigo-800 dark:text-indigo-400"
                        >
                          {uploads[doc.id]}
                        </a>
                        <button
                          type="button"
                          onClick={() => onDeleteUpload?.(doc.id, uploads![doc.id])}
                          className="shrink-0 text-[11px] text-neutral-400 hover:text-red-500"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <label
                        className={`cursor-pointer rounded border border-dashed border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-500 hover:border-indigo-400 hover:text-indigo-600 dark:border-neutral-700 ${
                          uploading === doc.id ? "pointer-events-none opacity-50" : ""
                        }`}
                      >
                        {uploading === doc.id
                          ? ko ? "업로드 중…" : "Uploading…"
                          : ko ? "파일 첨부" : "Attach file"}
                        <input
                          type="file"
                          className="hidden"
                          disabled={uploading === doc.id}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) onUpload(doc.id, file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                )}

                {onComment && (
                  <div className="mt-1 pl-8">
                    <textarea
                      value={comments?.[doc.id] ?? ""}
                      onChange={(e) => onComment(doc.id, e.target.value)}
                      placeholder={ko ? "메모 추가…" : "Add a note…"}
                      rows={1}
                      className="w-full resize-none rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
                      onInput={(e) => {
                        const t = e.currentTarget;
                        t.style.height = "auto";
                        t.style.height = `${t.scrollHeight}px`;
                      }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ConsistencySection({
  agreement,
  consistency,
  onChange,
  onAiFill,
  aiBusy,
  ko,
}: {
  agreement: NumberSet;
  consistency: { instruction: NumberSet; minutes: NumberSet };
  onChange: (
    which: "instruction" | "minutes",
    field: keyof NumberSet,
    value: string,
  ) => void;
  onAiFill: () => void;
  aiBusy: boolean;
  ko: boolean;
}) {
  const rows: { field: keyof NumberSet; ko: string; en: string }[] = [
    { field: "shares", ko: "신주 수", en: "New shares" },
    { field: "price", ko: "발행가액", en: "Issue price" },
    { field: "amount", ko: "총 인수대금", en: "Total amount" },
  ];

  // A row matches when both the entered figures equal the contract's, ignoring
  // commas and spaces. Blank entries are treated as "not yet checked".
  const norm = (s: string) => s.replace(/[,\s₩]/g, "").trim();
  const rowState = (field: keyof NumberSet): "match" | "mismatch" | "blank" => {
    const base = norm(agreement[field]);
    const oi = norm(consistency.instruction[field]);
    const mn = norm(consistency.minutes[field]);
    if (!oi && !mn) return "blank";
    if (!base) return "blank";
    return oi === base && mn === base ? "match" : "mismatch";
  };

  const input =
    "w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950";

  return (
    <section className="mb-5 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          {ko ? "숫자 일치 확인" : "Number consistency check"}
        </h2>
        <button
          type="button"
          onClick={onAiFill}
          disabled={aiBusy}
          title={ko ? "업로드된 운용지시서·의사록에서 추출" : "Extract from uploaded 운용지시서 / 의사록"}
          className="shrink-0 rounded-lg border border-indigo-300 px-2.5 py-1 text-[11px] font-medium text-indigo-700 transition-colors hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
        >
          {aiBusy ? (ko ? "추출 중…" : "Reading…") : ko ? "AI로 채우기" : "Fill with AI"}
        </button>
      </div>
      <p className="mb-3 text-[11px] text-neutral-400">
        {ko
          ? "운용지시서 · 투자계약서 · 투자심의위원회 의사록의 숫자가 일치하는지 확인합니다. 계약서 값은 자동으로 불러오며, 'AI로 채우기'는 업로드된 서류에서 나머지를 추출합니다."
          : "Confirm the figures on the operating instruction, the agreement, and the committee minutes all match. The agreement values load automatically; 'Fill with AI' extracts the rest from uploaded documents."}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-xs">
          <thead>
            <tr className="text-neutral-400">
              <th className="py-1 pr-2 font-medium"></th>
              <th className="py-1 pr-2 font-medium">{ko ? "계약서" : "Agreement"}</th>
              <th className="py-1 pr-2 font-medium">{ko ? "운용지시서" : "Instruction"}</th>
              <th className="py-1 pr-2 font-medium">{ko ? "의사록" : "Minutes"}</th>
              <th className="py-1 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const state = rowState(row.field);
              return (
                <tr key={row.field} className={`border-t border-neutral-100 dark:border-neutral-800 ${
  rowState(row.field) === "match"
    ? "bg-emerald-50 dark:bg-emerald-950/20"
    : rowState(row.field) === "mismatch"
      ? "bg-red-50 dark:bg-red-950/20"
      : ""
}`}>
                  <td className="py-1.5 pr-2 font-medium text-neutral-500">
                    {ko ? row.ko : row.en}
                  </td>
                  <td className="py-1.5 pr-2 text-neutral-500">
                    {agreement[row.field] || "—"}
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      value={consistency.instruction[row.field]}
                      onChange={(e) => onChange("instruction", row.field, e.target.value)}
                      className={input}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      value={consistency.minutes[row.field]}
                      onChange={(e) => onChange("minutes", row.field, e.target.value)}
                      className={input}
                    />
                  </td>
                  <td className="py-1.5 pl-1 text-center">
                    {state === "match" && <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">✓</span>}
                    {state === "mismatch" && <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700 dark:bg-red-900/50 dark:text-red-400">✕</span>}
                    {state === "blank" && <span className="text-neutral-300 dark:text-neutral-700">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProgressPill({
  label, done, total, empty, ko,
}: {
  label: string; done: number; total: number; empty?: boolean; ko: boolean;
}) {
  const complete = total > 0 && done === total;
  return (
    <div className={`flex items-center gap-2.5 rounded-full border px-3 py-1 text-xs ${
      complete
        ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
        : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
    }`}>
      <span className={`font-medium ${complete ? "text-emerald-700 dark:text-emerald-400" : "text-neutral-600 dark:text-neutral-300"}`}>
        {label}
      </span>
      {empty ? (
        <span className="text-neutral-400">{ko ? "미선택" : "not set"}</span>
      ) : (
        <>
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
            <div
              className={`h-full rounded-full transition-all duration-300 ${complete ? "bg-emerald-500" : "bg-indigo-500"}`}
              style={{ width: total > 0 ? `${(done / total) * 100}%` : "0%" }}
            />
          </div>
          <span className={`tabular-nums ${complete ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-500"}`}>
            {done}/{total}
          </span>
        </>
      )}
    </div>
  );
}

function OiEmailSection({
  deal,
  docs,
  uploads,
  fundType,
  instructionDate,
  paymentDate,
  ko,
  pick,
}: {
  deal: Deal;
  docs: ExecutionDoc[];
  uploads: Record<string, string>;
  fundType: FundType | null;
  instructionDate: string;
  paymentDate: string;
  ko: boolean;
  pick: (ko: string, en: string) => string;
}) {
  const [to, setTo] = useState("");
  const [copied, setCopied] = useState(false);

  const company = pick(deal.companyKo, deal.companyEn);
  const fundLabel =
    fundType === "mother"
      ? ko
        ? "모태펀드"
        : "Fund-of-funds (모태)"
      : ko
        ? "민간펀드"
        : "Private fund";

  const subject = ko
    ? `[${company}] 운용지시 서류 제출`
    : `[${company}] Operating instruction documents`;

  const docList = docs
    .map((d) => {
      const has = !!uploads[d.id];
      const note = pick(d.noteKo ?? "", d.noteEn ?? "");
      const name = `${pick(d.nameKo, d.nameEn)}${note ? ` (${note})` : ""}`;
      return `${has ? "✓" : "☐"} ${name}`;
    })
    .join("\n");

  const body = ko
    ? `경영지원본부 담당자님, 안녕하세요.

아래 운용지시 서류를 첨부하여 송부드립니다.

기업명: ${company}
펀드 종류: ${fundLabel}
운용지시일: ${instructionDate || "—"}
납입일: ${paymentDate || "—"}

[첨부 서류]
${docList}

감사합니다.`
    : `Hi Management Support team,

Please find the operating instruction documents attached below.

Company: ${company}
Fund type: ${fundLabel}
Instruction date: ${instructionDate || "—"}
Payment date: ${paymentDate || "—"}

[Attached documents]
${docList}

Thank you.`;

  function sendEmail() {
    navigator.clipboard.writeText(body).catch(() => {});
    const params = new URLSearchParams({ view: "cm", fs: "1", to, su: subject });
    window.open(`https://mail.google.com/mail/?${params.toString()}`, "_blank");
    setCopied(true);
    setTimeout(() => setCopied(false), 4000);
  }

  if (docs.length === 0) return null;

  return (
    <section className="mb-5 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-1 text-sm font-semibold">
        {ko ? "운용지시 이메일 (경영지원본부)" : "OI email to management support"}
      </h2>
      <p className="mb-3 text-[11px] text-neutral-400">
        {ko
          ? "위 첨부 파일을 다운로드하여 이메일에 직접 첨부하세요. 이메일 본문은 클립보드에 복사됩니다."
          : "Download the files above and attach them manually. The email body is copied to your clipboard."}
      </p>
      <div className="mb-2">
        <label className="block text-[11px] font-medium text-neutral-500">
          {ko ? "받는 사람" : "To"}
        </label>
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="mgmt-support@sparklabs.co.kr"
          className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950"
        />
      </div>
      <textarea
        readOnly
        value={body}
        rows={10}
        className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-700 focus:outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={sendEmail}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          {copied
            ? ko
              ? "메일 열림 — 본문 붙여넣기 ✓"
              : "Mail opened — paste body ✓"
            : ko
              ? "이메일 보내기"
              : "Send email"}
        </button>
        <span className="text-[11px] text-neutral-400">
          {ko ? "💡 파일은 직접 첨부해 주세요." : "💡 Attach the downloaded files manually."}
        </span>
      </div>
    </section>
  );
}
