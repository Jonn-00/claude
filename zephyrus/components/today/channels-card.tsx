"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { ChannelId, State } from "@/lib/types";
import type { ChannelStats } from "@/lib/stats";
import { fromKey, shortDate } from "@/lib/time";
import { cn, compact, fmt } from "@/lib/utils";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { LineChart } from "@/components/charts/line-chart";
import { CountUp } from "@/components/ui/count-up";
import { TONE } from "@/lib/tones";

type Range = "7" | "28" | "90";

/** The four channels as tabs: each tab is its own number; the chart follows the pick. */
export function ChannelsCard({ state, stats, className }: { state: State; stats: ChannelStats[]; className?: string }) {
  const [sel, setSel] = useState<ChannelId>("c1");
  const [range, setRange] = useState<Range>("28");
  const tabRefs = useRef<Partial<Record<ChannelId, HTMLButtonElement | null>>>({});
  const [bar, setBar] = useState({ x: 0, y: 0, w: 0, h: 0 });
  useLayoutEffect(() => {
    const measure = () => {
      const b = tabRefs.current[sel];
      if (b) setBar({ x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [sel]);
  const n = Number(range);

  const tabs = state.channels.map((c) => {
    const st = stats.find((s) => s.channelId === c.id)!;
    const d = st.days;
    const cur = d.slice(-7).reduce((a, x) => a + x.views, 0);
    const prev = d.slice(-14, -7).reduce((a, x) => a + x.views, 0);
    return { c, cur, change: prev ? (cur - prev) / prev : 0 };
  });

  const st = stats.find((s) => s.channelId === sel)!;
  const days = st.days.slice(-n);
  const points = days.map((d) => ({ key: d.date, label: shortDate(fromKey(d.date)), value: d.views }));
  const marks = st.videos
    .filter((v) => v.publishedOn >= days[0].date)
    .map((v) => ({ index: days.findIndex((d) => d.date === v.publishedOn), label: v.title }))
    .filter((m) => m.index >= 0);
  const total = days.reduce((a, d) => a + d.views, 0);
  const channel = state.channels.find((c) => c.id === sel)!;

  return (
    <Panel
      framed
      title="Channels"
      aside={
        <Segmented
          label="Range"
          value={range}
          onChange={setRange}
          items={[
            { value: "7", label: "7 d" },
            { value: "28", label: "28 d" },
            { value: "90", label: "90 d" },
          ]}
        />
      }
      className={className}
    >
      <div role="tablist" aria-label="Channel" className="relative -mx-1 grid grid-cols-2 gap-1">
        {/* One selection that travels between tabs, instead of four that blink. */}
        <span
          aria-hidden
          className="absolute top-0 left-0 rounded-[12px] bg-raised transition-[transform,width,height] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none"
          style={{ width: bar.w, height: bar.h, transform: `translate(${bar.x}px, ${bar.y}px)` }}
        >
          <span className="absolute inset-x-2.5 bottom-0 h-[2px] rounded-full bg-ember" />
        </span>
        {tabs.map(({ c, cur, change }) => {
          const on = c.id === sel;
          return (
            <button
              key={c.id}
              ref={(el) => {
                tabRefs.current[c.id] = el;
              }}
              role="tab"
              aria-selected={on}
              onClick={() => setSel(c.id)}
              className={cn("press relative min-w-0 rounded-[12px] px-2.5 pt-1.5 pb-2 text-left transition-colors", !on && "hover:bg-raised/40")}
            >
              <span className={cn("flex items-center gap-1.5 text-[12px]", on ? "text-text" : "text-muted")}>
                <i className="size-1.5 shrink-0 rounded-full" style={{ background: TONE[c.id].bg }} />
                <span className="truncate">{c.name}</span>
              </span>
              <span className="mt-1 flex items-baseline gap-2">
                <span className="num font-display text-[19px] leading-6 font-medium tracking-[-0.01em]">{compact(cur)}</span>
                <span className={cn("num text-[12px]", change > 0.005 ? "text-positive" : change < -0.005 ? "text-negative" : "text-faint")}>
                  {change > 0 ? "+" : change < 0 ? "−" : ""}
                  {Math.abs(change * 100).toFixed(1)}%
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-[12px] text-faint">Views in the last 7 days, vs the 7 days before</p>
      <div className="mt-4 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <span className="truncate text-[13px] text-muted">
            {channel.name} · views, last {n} days
          </span>
        </div>
        <span className="font-display text-[20px] font-medium tracking-[-0.01em]">
          <CountUp value={total} />
        </span>
      </div>
      <div className="mt-2 flex flex-1 flex-col">
        <LineChart points={points} marks={marks} height="fill" unit="Views" format={(v) => fmt(v)} ariaLabel={`${channel.name} daily views, last ${n} days`} />
      </div>
      <p className="mt-2 text-[12px] text-faint">Ticks under the line are upload days. Sample data through yesterday, until YouTube is connected.</p>
    </Panel>
  );
}
