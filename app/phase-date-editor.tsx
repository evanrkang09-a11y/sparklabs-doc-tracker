"use client";

import { useEffect, useState } from "react";
import type { PhaseKey, DealTimeline } from "@/lib/deal-timeline";
import { useLang } from "./lang-provider";

export default function PhaseDateEditor({
  dealId,
  phase,
  large = false,
}: {
  dealId: string;
  phase: PhaseKey;
  large?: boolean;
}) {
  const { lang } = useLang();
  const ko = lang === "ko";

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/deals/${dealId}/timeline`)
      .then((r) => r.json())
      .then((data: DealTimeline) => {
        setStart(data[phase]?.start ?? "");
        setEnd(data[phase]?.end ?? "");
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [dealId, phase]);

  async function save(field: "start" | "end", val: string) {
    if (field === "start") setStart(val);
    else setEnd(val);
    await fetch(`/api/deals/${dealId}/timeline`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase, [field]: val || null }),
    });
  }

  const days =
    start && end
      ? Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000)
      : null;

  if (!loaded) return null;

  if (large) {
    return (
      <section className="rounded-xl border border-neutral-200 bg-white px-6 py-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
              {ko ? "단계 일정" : "Phase dates"}
            </h2>
            <p className="mt-0.5 text-xs text-neutral-400">
              {ko ? "이 단계의 시작일과 종료일" : "Start and end date for this phase"}
            </p>
          </div>
          {days !== null && (
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${
              days < 0
                ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400"
            }`}>
              {days === 0
                ? (ko ? "당일" : "Same day")
                : days > 0
                  ? (ko ? `${days}일 소요` : `${days} days`)
                  : (ko ? "종료일 오류" : "End before start")}
            </span>
          )}
          {start && !end && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              {ko ? "진행 중" : "In progress"}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="space-y-1.5">
            <p className="text-xs font-medium text-neutral-500">{ko ? "시작일" : "Start date"}</p>
            <input
              type="date"
              value={start}
              onChange={(e) => save("start", e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-indigo-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            />
          </label>
          <label className="space-y-1.5">
            <p className="text-xs font-medium text-neutral-500">{ko ? "종료일" : "End date"}</p>
            <input
              type="date"
              value={end}
              onChange={(e) => save("end", e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-indigo-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            />
          </label>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-xs dark:border-neutral-800 dark:bg-neutral-900/60">
      <span className="font-medium text-neutral-500">{ko ? "단계 일정" : "Phase dates"}</span>
      <label className="flex items-center gap-1.5 text-neutral-500">
        {ko ? "시작" : "Start"}
        <input
          type="date"
          value={start}
          onChange={(e) => save("start", e.target.value)}
          className="rounded border border-neutral-200 bg-white px-2 py-0.5 text-xs focus:border-indigo-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950"
        />
      </label>
      <label className="flex items-center gap-1.5 text-neutral-500">
        {ko ? "종료" : "End"}
        <input
          type="date"
          value={end}
          onChange={(e) => save("end", e.target.value)}
          className="rounded border border-neutral-200 bg-white px-2 py-0.5 text-xs focus:border-indigo-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950"
        />
      </label>
      {days !== null && (
        <span className={`font-medium ${days < 0 ? "text-red-500" : "text-indigo-600 dark:text-indigo-400"}`}>
          {days === 0
            ? (ko ? "당일" : "Same day")
            : days > 0
              ? (ko ? `${days}일 소요` : `${days}d`)
              : (ko ? `종료일이 시작일보다 앞섬` : `End before start`)}
        </span>
      )}
      {start && !end && (
        <span className="text-amber-500">{ko ? "진행 중" : "In progress"}</span>
      )}
    </div>
  );
}
