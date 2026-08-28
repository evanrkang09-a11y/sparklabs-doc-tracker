"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import { signOut } from "next-auth/react";
import type { Message } from "@/lib/message-store";
import type { ContractType } from "@/lib/contracts";
import type { TrackedDocument } from "@/lib/deal-status";
import type { ExecutionDoc } from "@/lib/execution";

type UploadedFile = { filename: string; pathname: string; size: number; uploadedAt: string };

type ExecSuggestion = {
  filename: string;
  documentId: string | null;
  documentNameKo: string;
  documentNameEn: string;
  confidence: number;
  reason: string;
};

function guessExecDocId(filename: string, docs: ExecutionDoc[]): string | null {
  const lower = filename.toLowerCase().replace(/[._\-()[\]0-9]/g, " ");
  for (const doc of docs) {
    const enWords = doc.nameEn.toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
    if (enWords.length > 0 && enWords.some((w) => lower.includes(w))) return doc.id;
    const koWords = doc.nameKo.split(/[\s·]+/).filter((w) => w.length >= 2);
    if (koWords.some((w) => filename.includes(w))) return doc.id;
  }
  return null;
}

export default function StartupPortal({
  deal,
  messages: initialMessages,
  files: initialFiles,
  agreementType,
  hasAgreement,
  userEmail,
  userName,
  startupPermissions,
  trackedDocs,
  missingCount,
  totalRequired,
  execDocs,
  initialExecFiles,
}: {
  deal: { id: string; companyKo: string; companyEn: string };
  messages: Message[];
  files: UploadedFile[];
  agreementType: ContractType;
  hasAgreement: boolean;
  userEmail: string;
  userName: string;
  startupPermissions: string[];
  trackedDocs: TrackedDocument[];
  missingCount: number;
  totalRequired: number;
  execDocs: ExecutionDoc[];
  initialExecFiles: UploadedFile[];
}) {
  const [lang, setLang] = useState<"ko" | "en">("ko");
  const ko = lang === "ko";
  const t = (k: string, e: string) => (ko ? k : e);

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [files, setFiles] = useState<UploadedFile[]>(initialFiles);
  const [msgDraft, setMsgDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [execFiles, setExecFiles] = useState<UploadedFile[]>(initialExecFiles);
  const [execUploading, setExecUploading] = useState(false);
  const [execUploadError, setExecUploadError] = useState<string | null>(null);
  const [execSuggestions, setExecSuggestions] = useState<Map<string, ExecSuggestion>>(new Map());
  const [execClassifying, setExecClassifying] = useState(false);
  const [execClassifyError, setExecClassifyError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"home" | "documents" | "execution" | "messages">("home");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const execFileInputRef = useRef<HTMLInputElement>(null);

  const companyName = ko ? (deal.companyKo || deal.companyEn) : (deal.companyEn || deal.companyKo);
  const firstName = userName.split(" ")[0];
  const unreadFromSpark = messages.filter((m) => m.sender === "sparklabs").length;

  // Which exec doc IDs are covered by uploaded files (keyword match or AI suggestion)
  const coveredExecDocIds = new Set<string>();
  for (const f of execFiles) {
    const keyMatch = guessExecDocId(f.filename, execDocs);
    if (keyMatch) coveredExecDocIds.add(keyMatch);
    const suggestion = execSuggestions.get(f.filename);
    if (suggestion?.documentId) coveredExecDocIds.add(suggestion.documentId);
  }
  const execMissingCount = execDocs.filter((d) => !coveredExecDocIds.has(d.id)).length;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeSection]);

  useEffect(() => {
    if (activeSection !== "messages") return;
    fetch(`/api/messages/${deal.id}/read`, { method: "POST" }).catch(() => {});
    const id = setInterval(() => {
      fetch(`/api/messages/${deal.id}`)
        .then((r) => r.json())
        .then((data: unknown) => { if (Array.isArray(data)) setMessages(data as Message[]); })
        .catch(() => {});
    }, 30_000);
    return () => clearInterval(id);
  }, [activeSection, deal.id]);

  async function sendMessage() {
    if (!msgDraft.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/messages/${deal.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msgDraft.trim() }),
      });
      const msg: Message = await res.json();
      setMessages((prev) => [...prev, msg]);
      setMsgDraft("");
    } finally {
      setSending(false);
    }
  }

  async function handleFileUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      await upload(`deals/${deal.id}/${file.name}`, file, {
        access: "private",
        handleUploadUrl: "/api/upload",
      });
      const now = new Date().toISOString();
      setFiles((prev) => [
        ...prev,
        { filename: file.name, pathname: `deals/${deal.id}/${file.name}`, size: file.size, uploadedAt: now },
      ]);
    } catch {
      setUploadError(t("업로드 실패. 다시 시도해 주세요.", "Upload failed. Please try again."));
    } finally {
      setUploading(false);
    }
  }

  async function handleExecUpload(file: File) {
    setExecUploading(true);
    setExecUploadError(null);
    try {
      await upload(`deals/${deal.id}/execution/startup/${file.name}`, file, {
        access: "private",
        handleUploadUrl: "/api/upload",
      });
      const now = new Date().toISOString();
      setExecFiles((prev) => [
        ...prev,
        { filename: file.name, pathname: `deals/${deal.id}/execution/startup/${file.name}`, size: file.size, uploadedAt: now },
      ]);
    } catch {
      setExecUploadError(t("업로드 실패. 다시 시도해 주세요.", "Upload failed. Please try again."));
    } finally {
      setExecUploading(false);
    }
  }

  async function classifyExecFiles() {
    const unmatched = execFiles
      .filter((f) => !guessExecDocId(f.filename, execDocs) && !execSuggestions.has(f.filename))
      .map((f) => f.filename);
    if (unmatched.length === 0) return;

    setExecClassifying(true);
    setExecClassifyError(null);
    try {
      const res = await fetch(`/api/deals/${deal.id}/classify-exec`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filenames: unmatched }),
      });
      const data = await res.json();
      if (!res.ok) {
        setExecClassifyError(data.error ?? t("AI 분류 실패", "AI classification failed"));
        return;
      }
      const suggestions: ExecSuggestion[] = data.suggestions ?? [];
      setExecSuggestions((prev) => {
        const next = new Map(prev);
        for (const s of suggestions) next.set(s.filename, s);
        return next;
      });
    } catch {
      setExecClassifyError(t("AI 분류 중 오류 발생", "Error during AI classification"));
    } finally {
      setExecClassifying(false);
    }
  }

  function formatBytes(b: number) {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  }

  const unmatchedExecCount = execFiles.filter(
    (f) => !guessExecDocId(f.filename, execDocs) && !execSuggestions.has(f.filename)
  ).length;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-neutral-50 dark:bg-neutral-950">

      {/* Top nav */}
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">▲</div>
            <div>
              <p className="text-[11px] font-medium text-neutral-400 leading-none">SparkLabs Korea</p>
              <p className="text-sm font-semibold text-neutral-900 dark:text-white leading-tight">{companyName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLang(lang === "ko" ? "en" : "ko")}
              className="flex min-h-[44px] items-center rounded-lg border border-neutral-200 px-3 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              {ko ? "ENG" : "한국어"}
            </button>
            <span className="hidden text-xs text-neutral-400 sm:block">{userEmail}</span>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex min-h-[44px] items-center rounded-lg border border-neutral-200 px-3 text-xs font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              {t("로그아웃", "Sign out")}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 flex flex-col px-4 py-6">

        {/* Home section */}
        {activeSection === "home" && (
          <div className="space-y-6">
            {/* Welcome */}
            <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 px-6 py-7 text-white shadow-lg">
              <p className="text-sm font-medium text-indigo-200">{t("다시 오셨군요", "Welcome back")}</p>
              <h1 className="mt-0.5 text-2xl font-bold">{firstName} · {companyName}</h1>
              <p className="mt-2 text-sm text-indigo-200">
                {t("SparkLabs 투자 포털입니다. 필요한 모든 것이 여기 있습니다.", "Your SparkLabs investment portal. Everything you need in one place.")}
              </p>
              {totalRequired > 0 && (
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-xs text-indigo-200">
                    <span>{t("필수 서류", "Required documents")}</span>
                    <span className="font-semibold">
                      {totalRequired - missingCount}/{totalRequired} {t("제출", "submitted")}
                      {missingCount > 0 ? ` · ${missingCount} ${t("미제출", "missing")}` : ` · ${t("완료!", "All done!")}`}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/20">
                    <div
                      className={`h-full rounded-full transition-all ${missingCount === 0 ? "bg-emerald-400" : "bg-white"}`}
                      style={{ width: `${Math.round(((totalRequired - missingCount) / totalRequired) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                  {agreementType.toUpperCase()} {t("계약", "Agreement")}
                </span>
                {messages.length > 0 && (
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                    {messages.length} {t("메시지", "message")}{lang === "en" && messages.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Action cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Agreement */}
              <Link
                href={`/agreement/${deal.id}`}
                className="group flex flex-col rounded-2xl border border-violet-200 bg-white p-5 shadow-sm transition-all hover:border-violet-400 hover:shadow-md dark:border-violet-900 dark:bg-neutral-900"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-xl dark:bg-violet-950/50">📝</div>
                  <span className="text-xs text-neutral-400 group-hover:text-violet-600">{t("열기", "Open")} →</span>
                </div>
                <h2 className="mt-4 font-semibold text-neutral-900 dark:text-white">{t("투자 계약서", "Investment Agreement")}</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {hasAgreement
                    ? t("계약서를 검토하고 필드를 입력하세요.", "Review and fill in your agreement fields.")
                    : t("아직 계약서가 준비되지 않았습니다.", "Your agreement hasn't been started yet.")}
                </p>
                {hasAgreement && (
                  <span className="mt-3 self-start rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                    {t("편집 가능", "Ready to edit")}
                  </span>
                )}
              </Link>

              {/* Document tracker */}
              <Link
                href={`/deal/${deal.id}`}
                className="group flex flex-col rounded-2xl border border-sky-200 bg-white p-5 shadow-sm transition-all hover:border-sky-400 hover:shadow-md dark:border-sky-900 dark:bg-neutral-900"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-xl dark:bg-sky-950/50">📁</div>
                  <span className="text-xs text-neutral-400 group-hover:text-sky-600">{t("열기", "Open")} →</span>
                </div>
                <h2 className="mt-4 font-semibold text-neutral-900 dark:text-white">{t("서류 현황", "Document Tracker")}</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {t("SparkLabs에 필요한 서류와 제출 현황을 확인하세요.", "See which documents SparkLabs needs and their current status.")}
                </p>
                <span className="mt-3 self-start rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                  {files.length} {t("업로드됨", "uploaded")}
                </span>
              </Link>

              {/* Upload */}
              <button
                type="button"
                onClick={() => setActiveSection("documents")}
                className="group flex flex-col rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm transition-all hover:border-emerald-400 hover:shadow-md dark:border-emerald-900 dark:bg-neutral-900 text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-xl dark:bg-emerald-950/50">↑</div>
                  <span className="text-xs text-neutral-400 group-hover:text-emerald-600">{t("업로드", "Upload")} →</span>
                </div>
                <h2 className="mt-4 font-semibold text-neutral-900 dark:text-white">{t("파일 업로드", "Upload Files")}</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {t("IR 자료, 재무제표, 지분 구조표 등 요청된 서류를 공유하세요.", "Share IR decks, financials, cap tables, or anything SparkLabs requested.")}
                </p>
              </button>

              {/* Execution docs */}
              <button
                type="button"
                onClick={() => setActiveSection("execution")}
                className="group flex flex-col rounded-2xl border border-violet-200 bg-white p-5 shadow-sm transition-all hover:border-violet-400 hover:shadow-md dark:border-violet-900 dark:bg-neutral-900 text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-xl dark:bg-violet-950/50">💳</div>
                  <div className="flex items-center gap-1.5">
                    {execDocs.length > 0 && execMissingCount > 0 && (
                      <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {execMissingCount}
                      </span>
                    )}
                    <span className="text-xs text-neutral-400 group-hover:text-violet-600">{t("업로드", "Upload")} →</span>
                  </div>
                </div>
                <h2 className="mt-4 font-semibold text-neutral-900 dark:text-white">{t("집행 서류", "Execution Documents")}</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {t("투자납입 후 제출해야 할 서류를 업로드하세요.", "Upload post-signing execution documents requested by SparkLabs.")}
                </p>
                {execFiles.length > 0 && (
                  <span className="mt-3 self-start rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                    {execFiles.length} {t("업로드됨", "uploaded")}
                  </span>
                )}
              </button>

              {/* Messages */}
              <button
                type="button"
                onClick={() => setActiveSection("messages")}
                className="group flex flex-col rounded-2xl border border-amber-200 bg-white p-5 shadow-sm transition-all hover:border-amber-400 hover:shadow-md dark:border-amber-900 dark:bg-neutral-900 text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-xl dark:bg-amber-950/50">💬</div>
                  <div className="flex items-center gap-1.5">
                    {unreadFromSpark > 0 && (
                      <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {unreadFromSpark}
                      </span>
                    )}
                    <span className="text-xs text-neutral-400 group-hover:text-amber-600">{t("열기", "Open")} →</span>
                  </div>
                </div>
                <h2 className="mt-4 font-semibold text-neutral-900 dark:text-white">{t("메시지", "Messages")}</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {t("SparkLabs 팀과 직접 소통하세요.", "Direct line to the SparkLabs team. Ask questions, share updates.")}
                </p>
                {messages.length > 0 && (
                  <span className="mt-3 self-start rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                    {messages.length} {t("메시지", "message")}{lang === "en" && messages.length !== 1 ? "s" : ""}
                  </span>
                )}
              </button>
            </div>

            {/* Required document checklist */}
            {trackedDocs.length > 0 && (
              <div className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3.5 dark:border-neutral-800">
                  <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">{t("필수 서류", "Required documents")}</h2>
                  {missingCount === 0 ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                      {t("전부 제출", "All submitted")}
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                      {missingCount} {t("건 미제출", "missing")}
                    </span>
                  )}
                </div>
                <ul className="divide-y divide-neutral-50 dark:divide-neutral-800/60">
                  {trackedDocs.map((doc) => (
                    <li key={doc.id} className="flex items-start gap-3 px-5 py-3">
                      <span className={`mt-0.5 shrink-0 text-base leading-none ${doc.submitted ? "text-emerald-500" : "text-neutral-300 dark:text-neutral-600"}`}>
                        {doc.submitted ? "✓" : "○"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${doc.submitted ? "text-neutral-900 dark:text-white" : "text-neutral-700 dark:text-neutral-300"}`}>
                          {ko ? (doc.nameKo || doc.nameEn) : (doc.nameEn || doc.nameKo)}
                          {doc.optional && <span className="ml-1.5 text-xs font-normal text-neutral-400">({t("선택", "optional")})</span>}
                        </p>
                        {doc.submitted && doc.files[0] && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400">
                            {doc.files[0].name} · {doc.files[0].uploadedAt?.slice(0, 10)}
                          </p>
                        )}
                      </div>
                      {!doc.submitted && !doc.optional && (
                        <button
                          type="button"
                          onClick={() => setActiveSection("documents")}
                          className="flex min-h-[44px] shrink-0 items-center rounded-lg bg-indigo-50 px-3 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400"
                        >
                          {t("업로드", "Upload")}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Agreement download if ready */}
            {hasAgreement && (
              <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
                <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">{t("계약서 다운로드", "Agreement download")}</h2>
                <AgreementDownload dealId={deal.id} companyName={companyName} ko={ko} />
              </div>
            )}
          </div>
        )}

        {/* Documents / upload section */}
        {activeSection === "documents" && (
          <div className="space-y-4">
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveSection("home")}
                className="flex min-h-[44px] items-center pr-2 text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              >
                ← {t("뒤로", "Back")}
              </button>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-white">{t("서류 업로드", "Upload documents")}</h2>
            </div>

            {trackedDocs.filter((d) => !d.submitted && !d.optional).length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-900 dark:bg-amber-950/20">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  {t("아직 필요한 서류", "Still needed")}
                </p>
                <ul className="space-y-1.5">
                  {trackedDocs.filter((d) => !d.submitted && !d.optional).map((doc) => (
                    <li key={doc.id} className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-200">
                      <span className="mt-0.5 shrink-0 text-amber-400">○</span>
                      <span>
                        <span className="font-medium">{ko ? (doc.nameKo || doc.nameEn) : (doc.nameEn || doc.nameKo)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleFileUpload(file);
              }}
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-emerald-300 bg-white p-10 text-center transition-colors hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-neutral-900 dark:hover:border-emerald-700"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl dark:bg-emerald-900/40">↑</div>
              <div>
                <p className="font-semibold text-neutral-900 dark:text-white">
                  {uploading ? t("업로드 중…", "Uploading…") : t("파일을 끌어다 놓거나 클릭하세요", "Drop files here or click to browse")}
                </p>
                <p className="mt-1 text-sm text-neutral-500">
                  {missingCount > 0
                    ? `${missingCount}${t("건의 필수 서류가 아직 없습니다", " required document(s) still missing — see the list above")}`
                    : t("필수 서류 모두 제출! 추가 자료도 여기에 업로드하세요.", "All required docs submitted! Upload any additional materials here.")}
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
              />
            </div>

            {uploadError && (
              <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {uploadError}
              </p>
            )}

            {files.length > 0 && (
              <div className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                <div className="border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
                  <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    {t("업로드됨", "Uploaded")} ({files.length})
                  </p>
                </div>
                <ul className="divide-y divide-neutral-50 dark:divide-neutral-800">
                  {files.map((f) => (
                    <li key={f.pathname} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-xs font-bold text-neutral-500 dark:bg-neutral-800">
                        {f.filename.split(".").pop()?.toUpperCase().slice(0, 3) ?? "DOC"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">{f.filename}</p>
                        <p className="text-xs text-neutral-400">{formatBytes(f.size)} · {f.uploadedAt.slice(0, 10)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Execution documents section */}
        {activeSection === "execution" && (
          <div className="space-y-4">
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveSection("home")}
                className="flex min-h-[44px] items-center pr-2 text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              >
                ← {t("뒤로", "Back")}
              </button>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-white">{t("집행 서류", "Execution Documents")}</h2>
            </div>

            {/* Info banner */}
            <div className="rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 dark:border-violet-900 dark:bg-violet-950/20">
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-400">
                {t("제출 안내", "What goes here")}
              </p>
              <p className="mt-1 text-sm text-violet-900 dark:text-violet-200">
                {t(
                  "투자납입 후 수탁은행 및 내부보관용으로 제출해야 할 서류를 업로드해 주세요.",
                  "Upload documents SparkLabs requested after the investment payment — originals for the custodian bank and internal records."
                )}
              </p>
            </div>

            {/* Required execution docs checklist */}
            {execDocs.length > 0 ? (
              <div className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3.5 dark:border-neutral-800">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                    {t("필요 서류 체크리스트", "Required documents checklist")}
                  </h3>
                  {execMissingCount === 0 ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                      {t("전부 제출", "All submitted")}
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                      {execMissingCount} {t("건 미제출", "missing")}
                    </span>
                  )}
                </div>
                <ul className="divide-y divide-neutral-50 dark:divide-neutral-800/60">
                  {execDocs.map((doc) => {
                    const covered = coveredExecDocIds.has(doc.id);
                    return (
                      <li key={doc.id} className="flex items-start gap-3 px-5 py-3">
                        <span className={`mt-0.5 shrink-0 text-base leading-none ${covered ? "text-emerald-500" : "text-neutral-300 dark:text-neutral-600"}`}>
                          {covered ? "✓" : "○"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium ${covered ? "text-neutral-900 dark:text-white" : "text-neutral-700 dark:text-neutral-300"}`}>
                            {ko ? doc.nameKo : doc.nameEn}
                          </p>
                          {(doc.noteKo || doc.noteEn) && (
                            <p className="text-xs text-neutral-400">{ko ? doc.noteKo : doc.noteEn}</p>
                          )}
                          {doc.destination && (
                            <p className="text-[10px] text-neutral-400">
                              {doc.destination === "custodian"
                                ? t("수탁은행 제출", "→ Custodian bank")
                                : t("내부보관", "→ Internal")}
                            </p>
                          )}
                          {covered && (() => {
                            const matchedFile = execFiles.find((f) => {
                              const km = guessExecDocId(f.filename, execDocs);
                              if (km === doc.id) return true;
                              const s = execSuggestions.get(f.filename);
                              return s?.documentId === doc.id;
                            });
                            return matchedFile ? (
                              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                {matchedFile.filename} · {matchedFile.uploadedAt.slice(0, 10)}
                              </p>
                            ) : null;
                          })()}
                        </div>
                        {!covered && (
                          <button
                            type="button"
                            onClick={() => execFileInputRef.current?.click()}
                            className="flex min-h-[44px] shrink-0 items-center rounded-lg bg-violet-50 px-3 text-xs font-medium text-violet-700 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-400"
                          >
                            {t("업로드", "Upload")}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-6 text-center dark:border-neutral-800 dark:bg-neutral-900">
                <p className="text-sm text-neutral-500">
                  {t(
                    "SparkLabs에서 아직 집행 설정을 완료하지 않았습니다. 필요 서류 목록은 곧 여기에 표시됩니다.",
                    "SparkLabs hasn't configured execution details yet. The required document list will appear here when ready."
                  )}
                </p>
              </div>
            )}

            {/* Upload zone */}
            <div
              onClick={() => execFileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleExecUpload(file);
              }}
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-violet-300 bg-white p-10 text-center transition-colors hover:border-violet-400 hover:bg-violet-50 dark:border-violet-800 dark:bg-neutral-900 dark:hover:border-violet-700"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-2xl dark:bg-violet-900/40">💳</div>
              <div>
                <p className="font-semibold text-neutral-900 dark:text-white">
                  {execUploading ? t("업로드 중…", "Uploading…") : t("파일을 끌어다 놓거나 클릭하세요", "Drop files here or click to browse")}
                </p>
                <p className="mt-1 text-sm text-neutral-500">
                  {t("집행 관련 서류 (원본·사본 모두 가능)", "Execution documents (originals or copies)")}
                </p>
              </div>
              <input
                ref={execFileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleExecUpload(f); }}
              />
            </div>

            {execUploadError && (
              <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {execUploadError}
              </p>
            )}

            {/* Uploaded files with match info */}
            {execFiles.length > 0 && (
              <div className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
                  <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    {t("업로드됨", "Uploaded")} ({execFiles.length})
                  </p>
                  {unmatchedExecCount > 0 && execDocs.length > 0 && (
                    <button
                      type="button"
                      disabled={execClassifying}
                      onClick={classifyExecFiles}
                      className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                    >
                      {execClassifying ? t("AI 분류 중…", "AI classifying…") : t("AI 자동 분류", "AI Guess")}
                    </button>
                  )}
                </div>
                {execClassifyError && (
                  <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
                    {execClassifyError}
                  </p>
                )}
                <ul className="divide-y divide-neutral-50 dark:divide-neutral-800">
                  {execFiles.map((f) => {
                    const keyMatch = guessExecDocId(f.filename, execDocs);
                    const matchedDoc = keyMatch ? execDocs.find((d) => d.id === keyMatch) : null;
                    const suggestion = execSuggestions.get(f.filename);
                    const suggestedDoc = suggestion?.documentId
                      ? execDocs.find((d) => d.id === suggestion.documentId)
                      : null;

                    return (
                      <li key={f.pathname} className="flex items-start gap-3 px-4 py-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-xs font-bold text-violet-600 dark:bg-violet-950/30">
                          {f.filename.split(".").pop()?.toUpperCase().slice(0, 3) ?? "DOC"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">{f.filename}</p>
                          <p className="text-xs text-neutral-400">{formatBytes(f.size)} · {f.uploadedAt.slice(0, 10)}</p>
                          {matchedDoc && (
                            <p className="mt-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              ✓ {ko ? matchedDoc.nameKo : matchedDoc.nameEn}
                            </p>
                          )}
                          {!matchedDoc && suggestedDoc && (
                            <p className="mt-0.5 text-xs text-violet-600 dark:text-violet-400">
                              AI: {ko ? suggestedDoc.nameKo : suggestedDoc.nameEn}
                              {suggestion && (
                                <span className="ml-1 text-neutral-400">({Math.round(suggestion.confidence * 100)}%)</span>
                              )}
                            </p>
                          )}
                          {!matchedDoc && !suggestedDoc && suggestion?.documentId === null && (
                            <p className="mt-0.5 text-xs text-neutral-400">{t("분류 불가", "Unclassified")}</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Messages section */}
        {activeSection === "messages" && (
          <div className="flex flex-1 flex-col gap-4 min-h-0">
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveSection("home")}
                className="flex min-h-[44px] items-center pr-2 text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              >
                ← {t("뒤로", "Back")}
              </button>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
                {t("SparkLabs 메시지", "Messages with SparkLabs")}
              </h2>
            </div>

            <div className="flex flex-1 min-h-0 flex-col rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-y-auto">
                {messages.length === 0 && (
                  <p className="py-8 text-center text-sm text-neutral-400">
                    {t("아직 메시지가 없습니다. 아래에서 SparkLabs 팀에게 메시지를 보내세요.", "No messages yet. Send a message to the SparkLabs team below.")}
                  </p>
                )}
                {messages.map((m) => {
                  const isMe = m.sender === "startup";
                  return (
                    <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      {!isMe && (
                        <div className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">▲</div>
                      )}
                      <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ${
                        isMe
                          ? "bg-indigo-600 text-white"
                          : "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white"
                      }`}>
                        {!isMe && (
                          <p className="mb-0.5 text-[10px] font-semibold text-neutral-500 dark:text-neutral-400">{m.senderName}</p>
                        )}
                        <p>{m.text}</p>
                        <p className={`mt-1 text-[10px] ${isMe ? "text-indigo-200" : "text-neutral-400"}`}>
                          {new Date(m.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="flex shrink-0 gap-2 border-t border-neutral-100 pt-3 pb-[env(safe-area-inset-bottom)] dark:border-neutral-800">
                <input
                  type="text"
                  value={msgDraft}
                  onChange={(e) => setMsgDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder={t("SparkLabs에 메시지…", "Message SparkLabs…")}
                  className="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-base sm:text-sm focus:border-indigo-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950"
                />
                <button
                  type="button"
                  disabled={sending || !msgDraft.trim()}
                  onClick={sendMessage}
                  className="min-h-[44px] rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {sending ? "…" : t("전송", "Send")}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

function AgreementDownload({ dealId, companyName, ko }: { dealId: string; companyName: string; ko: boolean }) {
  const [downloading, setDownloading] = useState(false);

  async function download() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/agreement/download`);
      if (!res.ok) { alert(ko ? "다운로드 실패" : "Download failed"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${companyName}-agreement.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={download}
        disabled={downloading}
        className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
      >
        ↓ {downloading ? (ko ? "다운로드 중…" : "Downloading…") : `${companyName} Agreement (.docx)`}
      </button>
    </div>
  );
}
