"use client";

import { useAppState, useStats } from "@/lib/store";
import { finding } from "@/lib/derive";
import { longDate, useNow } from "@/lib/time";
import { ProductionLine } from "@/components/today/production-line";
import { ChannelsCard } from "@/components/today/channels-card";
import { CallsCard } from "@/components/today/calls-card";
import { HourlyPlanner } from "@/components/today/hourly-planner";
import { Reminders } from "@/components/today/reminders";
import { Agenda } from "@/components/today/agenda";

export default function TodayPage() {
  const s = useAppState()!;
  const stats = useStats(s);
  const now = useNow();
  const f = finding(s, now);

  const parts: React.ReactNode[] = [];
  if (f.due) parts.push(<span key="u" className="text-ember-soft">{f.due === 1 ? "1 upload" : `${f.due} uploads`} due{f.late ? `, ${f.late} late` : " today"}</span>);
  if (f.callbacks) parts.push(<span key="c" className={f.overdue ? "text-ember-soft" : undefined}>{f.callbacks} callback{f.callbacks === 1 ? "" : "s"} waiting{f.overdue ? `, ${f.overdue} overdue` : ""}</span>);
  parts.push(<span key="d">{f.dials} of {s.settings.dialTarget} dials</span>);

  return (
    <div className="mx-auto max-w-[1480px]">
      <div className="mb-5">
        <h1 className="font-display text-[28px] leading-9 font-semibold tracking-[-0.02em]">{longDate(now)}</h1>
        <p className="num mt-0.5 text-[15px] text-muted">
          {parts.map((p, i) => (
            <span key={i}>
              {i > 0 && <span className="text-faint"> · </span>}
              {p}
            </span>
          ))}
        </p>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <ProductionLine state={s} now={now} />
          <div className="grid gap-5 lg:grid-cols-2">
            <ChannelsCard state={s} stats={stats} />
            <CallsCard state={s} now={now} />
          </div>
        </div>
        <aside className="flex min-w-0 flex-col gap-5" aria-label="Your day">
          <HourlyPlanner state={s} now={now} />
          <Reminders state={s} now={now} />
          <Agenda state={s} now={now} />
        </aside>
      </div>
    </div>
  );
}
