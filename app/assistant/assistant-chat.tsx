"use client";

import { useEffect, useRef, useState } from "react";
import { describe } from "@/lib/errors";
import { useLang } from "@/app/lang-provider";

/**
 * The process assistant chat. Answers questions grounded in the SparkLabs
 * investment-operations process document, in whatever language you ask.
 *
 * The whole (short) conversation is sent each turn so follow-ups have context;
 * the model and knowledge base live on the server.
 */

type Msg = { role: "user" | "model"; text: string };

export default function AssistantChat() {
  const { lang } = useLang();
  const ko = lang === "ko";

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const suggestions = ko
    ? [
        "국내 투자 전 제출 서류 알려줘",
        "실사에서 정관은 뭘 확인해?",
        "투자납입 후 서류 회신 기한은?",
        "SAFE 지분 전환 절차 알려줘",
      ]
    : [
        "What documents are needed before a domestic investment?",
        "What do we check in the articles during DD?",
        "What's the deadline for post-payment documents?",
        "Walk me through the SAFE conversion process",
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
    <main className="mx-auto flex h-[calc(100vh-3.75rem)] w-full max-w-3xl flex-col px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {ko ? "프로세스 도우미" : "Process assistant"}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {ko
            ? "투자 프로세스(서류·실사·계약·납입·전환 등)에 대해 물어보세요. 답변은 내부 프로세스 문서를 기반으로 합니다."
            : "Ask about the investment process (documents, DD, contract, payment, conversion). Answers are grounded in the internal process document."}
        </p>
      </header>

      {/* Conversation */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <p className="text-sm text-neutral-400">
              {ko ? "무엇이든 물어보세요. 예를 들어:" : "Ask anything. For example:"}
            </p>
            <div className="flex max-w-md flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600 transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
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
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
            {ko ? "생각 중…" : "Thinking…"}
          </div>
        )}

        <div ref={endRef} />
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex items-end gap-2"
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
          className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {ko ? "보내기" : "Send"}
        </button>
      </form>

      <p className="mt-2 text-center text-[10px] text-neutral-400">
        {ko
          ? "AI 답변은 참고용입니다. 중요한 사항은 멘토님께 확인하세요."
          : "AI answers are for reference. Confirm anything important with your mentor."}
      </p>
    </main>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
          isUser
            ? "bg-indigo-600 text-white"
            : "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100"
        }`}
      >
        {msg.text}
      </div>
    </div>
  );
}
