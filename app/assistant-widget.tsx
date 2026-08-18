"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { describe } from "@/lib/errors";
import { useLang } from "./lang-provider";

/**
 * The process assistant as a floating popup, pinned to the bottom-right and
 * available on every page (like Zoom's assistant). A launcher button opens a
 * compact chat panel; answers are grounded in the internal process document
 * (see /api/assistant).
 *
 * Rendered from the root layout, so it hides itself on the login page and when
 * printing the agreement.
 */

type Msg = { role: "user" | "model"; text: string };

export default function AssistantWidget() {
  const { lang } = useLang();
  const ko = lang === "ko";
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy, open]);

  // Not on the login page - the assistant needs a signed-in session anyway.
  if (pathname === "/login") return null;

  const suggestions = ko
    ? [
        "국내 투자 전 제출 서류 알려줘",
        "실사에서 정관은 뭘 확인해?",
        "투자납입 후 서류 회신 기한은?",
        "SAFE 지분 전환 절차 알려줘",
      ]
    : [
        "Documents needed before a domestic investment?",
        "What do we check in the articles during DD?",
        "Deadline for post-payment documents?",
        "Walk me through the SAFE conversion",
      ];

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;

    const next: Msg[] = [...messages, { role: "user", text: question }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const parsed = await response.json().catch(() => null);
      if (!response.ok) throw new Error(parsed?.error ?? `${response.status}`);
      setMessages((current) => [...current, { role: "model", text: parsed.answer }]);
    } catch (problem) {
      setError(describe(problem));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 print:hidden">
      {/* Chat panel */}
      {open && (
        <div className="mb-3 flex h-[min(32rem,calc(100vh-7rem))] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-neutral-200 bg-indigo-600 px-4 py-3 text-white dark:border-neutral-800">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {ko ? "프로세스 도우미" : "Process assistant"}
              </p>
              <p className="truncate text-[10px] text-indigo-200">
                {ko ? "투자 프로세스 질문에 답합니다" : "Answers about the investment process"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMessages([]);
                    setError(null);
                  }}
                  title={ko ? "대화 지우기" : "Clear"}
                  className="rounded-md px-1.5 py-1 text-[11px] text-indigo-100 transition-colors hover:bg-indigo-500"
                >
                  {ko ? "지우기" : "Clear"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={ko ? "닫기" : "Close"}
                className="rounded-md p-1 text-indigo-100 transition-colors hover:bg-indigo-500"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-neutral-50 p-3 dark:bg-neutral-950">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-2 text-center">
                <p className="text-xs text-neutral-400">
                  {ko ? "무엇이든 물어보세요. 예:" : "Ask anything. e.g."}
                </p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-full border border-neutral-300 px-2.5 py-1 text-[11px] text-neutral-600 transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => <Bubble key={i} msg={m} />)
            )}

            {busy && (
              <div className="flex items-center gap-2 px-1 text-[11px] text-neutral-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
                {ko ? "생각 중…" : "Thinking…"}
              </div>
            )}
            <div ref={endRef} />
          </div>

          {error && (
            <p className="border-t border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 border-t border-neutral-200 bg-white p-2.5 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder={ko ? "질문을 입력하세요…" : "Type your question…"}
              className="max-h-24 min-h-[2.25rem] flex-1 resize-none rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="shrink-0 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {ko ? "전송" : "Send"}
            </button>
          </form>

          <p className="bg-white pb-2 text-center text-[9px] text-neutral-400 dark:bg-neutral-900">
            {ko ? "AI 답변은 참고용입니다." : "AI answers are for reference."}
          </p>
        </div>
      )}

      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ko ? "프로세스 도우미 열기" : "Open process assistant"}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition-all hover:bg-indigo-700 hover:shadow-xl active:scale-95"
      >
        {open ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
          isUser
            ? "bg-indigo-600 text-white"
            : "bg-white text-neutral-800 shadow-sm dark:bg-neutral-800 dark:text-neutral-100"
        }`}
      >
        {msg.text}
      </div>
    </div>
  );
}
