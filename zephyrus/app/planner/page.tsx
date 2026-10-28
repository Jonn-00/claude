"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAppState } from "@/lib/store";
import type { BlockKind } from "@/lib/types";
import { KIND_LABEL } from "@/lib/types";
import { addDays, dayKey, fromKey, minutesOf, shortDate, useNow, weekday } from "@/lib/time";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { DayColumn, blockClass } from "@/components/today/hourly-planner";
import { Button } from "@/components/ui/button";

const PITCH = 40;
const FROM = 6 * 60;

const hours = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} m` : `${h} h`;
};

export default function PlannerPage() {
  const s = useAppState()!;
  const now = useNow();
  const today = dayKey(now);
  const [monday, setMonday] = useState(() => addDays(today, -((fromKey(today).getDay() + 6) % 7)));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const scroller = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = Math.max(0, ((Math.min(minutesOf(now), 20 * 60) - 120 - FROM) / 60) * PITCH);
    // once, on arrival
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const week = s.blocks.filter((b) => b.date >= days[0] && b.date <= days[6]);
  const totals = (Object.keys(KIND_LABEL) as BlockKind[]).map((k) => ({ k, m: week.filter((b) => b.kind === k).reduce((a, b) => a + b.end - b.start, 0) }));
  const all = totals.reduce((a, t) => a + t.m, 0) || 1;
  const isThisWeek = days.includes(today);

  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        title="Planner"
        line={
          <>
            Week of {shortDate(fromKey(days[0]))}: {totals.map((t, i) => (
              <span key={t.k}>
                {i > 0 && " · "}
                {KIND_LABEL[t.k]} {hours(t.m)}
              </span>
            ))}
          </>
        }
        actions={
          <>
            <Button size="sm" variant="ghost" aria-label="Previous week" onClick={() => setMonday(addDays(monday, -7))}>
              <ChevronLeft size={15} />
            </Button>
            <Button size="sm" variant={isThisWeek ? "quiet" : "ghost"} onClick={() => setMonday(addDays(today, -((fromKey(today).getDay() + 6) % 7)))}>
              This week
            </Button>
            <Button size="sm" variant="ghost" aria-label="Next week" onClick={() => setMonday(addDays(monday, 7))}>
              <ChevronRight size={15} />
            </Button>
          </>
        }
      />

      <Panel bodyClassName="px-0 pb-0 pt-0">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 pt-4 pb-3">
          <div className="flex h-2 min-w-[200px] flex-1 overflow-hidden rounded-full bg-raised" aria-hidden>
            {totals.map((t) => (
              <div key={t.k} className={cn("h-full border-r-2 border-surface last:border-r-0", t.k === "youtube" ? "bg-sand" : t.k === "agency" ? "bg-dune" : "relative bg-raised hatch")} style={{ width: `${(t.m / all) * 100}%` }} />
            ))}
          </div>
          <div className="flex items-center gap-4 text-[12px] text-faint">
            {(Object.keys(KIND_LABEL) as BlockKind[]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <i className={cn("inline-block h-2.5 w-3.5 rounded-[3px] border", blockClass[k])} />
                {KIND_LABEL[k]}
              </span>
            ))}
            <span className="hidden sm:inline">Drag in a day to add a block</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[860px]">
            <div className="grid grid-cols-[48px_repeat(7,minmax(0,1fr))] border-y border-rule">
              <div />
              {days.map((d) => (
                <div key={d} className={cn("px-2 py-2.5 text-[13px]", d === today ? "text-text" : "text-muted")}>
                  {weekday(fromKey(d))} <span className={cn("num", d === today && "rounded-full bg-ember px-1.5 py-0.5 text-ground")}>{fromKey(d).getDate()}</span>
                </div>
              ))}
            </div>
            <div ref={scroller} className="h-[calc(100dvh-300px)] min-h-[420px] overflow-y-auto">
              <div className="grid grid-cols-[48px_repeat(7,minmax(0,1fr))] pt-2 pb-4">
                <div className="relative">
                  {Array.from({ length: 18 }, (_, i) => 6 + i).map((h) => (
                    <span key={h} className="num absolute right-2 text-[11px] text-faint" style={{ top: (h - 6) * PITCH - 7 }}>
                      {String(h).padStart(2, "0")}:00
                    </span>
                  ))}
                </div>
                {days.map((d) => (
                  <div key={d} className={cn("border-l border-rule px-1", fromKey(d).getDay() % 6 === 0 && "bg-ground/40")}>
                    <DayColumn state={s} date={d} now={now} pitch={PITCH} showHours={false} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
