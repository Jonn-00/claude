"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { State } from "@/lib/types";
import { countCalls, lastNDays } from "@/lib/derive";
import { dayKey, minutesOf } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/panel";

/**
 * The Ink Orbit flow card, made from your day: what you did today runs
 * through Zephyrus into a stack of daily reports, and writing tonight's
 * report prints a new sheet onto the stack.
 */
export function ReportFlow({ state, now }: { state: State; now: number }) {
  const uid = useId().replace(/:/g, "");
  const box = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [reduce, setReduce] = useState(false);
  const [side, setSide] = useState<"" | "left" | "right">("");
  useEffect(() => {
    setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const today = dayKey(now);
  const dials = countCalls(state.calls, today, today).dials;
  const done = state.reminders.filter((r) => r.done && dayKey(new Date(r.due)) === today).length;
  const notes = state.notes.filter((n) => dayKey(new Date(n.createdAt)) === today).length;
  const blocksDone = state.blocks.filter((b) => b.date === today && b.end <= minutesOf(now)).length;
  const live = state.videos.filter((v) => v.stage === "live" && v.liveAt && dayKey(new Date(v.liveAt)) === today).length;
  const inputs = [
    { x: 58, y: 40, n: dials, label: `${dials} dials logged` },
    { x: 108, y: 22, n: live, label: `${live} uploads went live` },
    { x: 152, y: 44, n: done, label: `${done} reminders done` },
    { x: 48, y: 98, n: blocksDone, label: `${blocksDone} planner blocks finished` },
    { x: 146, y: 116, n: notes, label: `${notes} notes written` },
  ];

  const written = Object.entries(state.agenda).filter(([, e]) => e.shipped || e.stuck || e.tomorrow);
  const reports = written.length;
  const todayEntry = state.agenda[today];
  const hasToday = !!(todayEntry && (todayEntry.shipped || todayEntry.stuck || todayEntry.tomorrow));
  const week = lastNDays(today, 6).map((d) => countCalls(state.calls, d, d).dials);
  const wmax = Math.max(1, ...week);

  const L1 = "M117,68 C196,68 210,100 262,100";
  const L2 = "M117,74 C186,74 206,120 262,120";
  const R1 = "M378,100 C412,100 418,86 450,86";
  const R2 = "M378,120 C412,120 418,134 450,134";
  const animate = inView && !reduce;

  return (
    <Panel tone="graphite" index={0} className="overflow-hidden" bodyClassName="px-0 pb-5 pt-0">
      <div ref={box}>
        <svg className="mx-auto hidden h-auto w-full max-w-[860px] sm:block" viewBox="0 0 640 178" role="img" aria-label={`Today's work flows into your daily reports. ${reports} written so far.`}>
          <defs>
            <radialGradient id={`${uid}g`} cx="320" cy="110" r="200" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#ff6a1a" stopOpacity="0.12" />
              <stop offset="1" stopColor="#ff6a1a" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="640" height="178" fill={`url(#${uid}g)`} />

          <g onMouseEnter={() => setSide("left")} onMouseLeave={() => setSide("")}>
            <rect x="20" y="6" width="170" height="134" fill="transparent" />
            {inputs.map((m, i) => (
              <line key={"l" + i} x1={m.x} y1={m.y} x2="104" y2="71" stroke="var(--control)" strokeDasharray="2 3" />
            ))}
            <rect x="91" y="58" width="26" height="26" rx="6" fill="var(--raised)" stroke="var(--control)" />
            <circle cx="104" cy="71" r="4" fill={hasToday ? "var(--positive)" : "var(--ember)"} />
            {inputs.map((m, i) => (
              <g key={i} className="group/in" tabIndex={0} role="img" aria-label={m.label}>
                <circle cx={m.x} cy={m.y} r="12" fill="var(--raised)" stroke={m.n ? "var(--sand)" : "var(--control)"} className="transition-[r] duration-200 group-hover/in:[r:14]" />
                <text x={m.x} y={m.y + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill={m.n ? "var(--text)" : "var(--faint)"} className="num">
                  {m.n > 99 ? "99+" : m.n}
                </text>
                <g className="pointer-events-none opacity-0 transition-opacity duration-150 group-hover/in:opacity-100 group-focus/in:opacity-100">
                  <rect x={m.x - m.label.length * 3.1 - 7} y={m.y - 34} width={m.label.length * 6.2 + 14} height="18" rx="9" fill="var(--text)" />
                  <text x={m.x} y={m.y - 21} textAnchor="middle" fontSize="11" fill="var(--ground)">
                    {m.label}
                  </text>
                </g>
              </g>
            ))}
          </g>

          {[L1, L2].map((d, i) => (
            <path key={d} d={d} fill="none" stroke={side === "left" ? "var(--sand)" : "var(--control)"} strokeWidth="1.2" strokeDasharray={i ? "3 4" : undefined} className={cn(i && animate && "[animation:dash_1.2s_linear_infinite]")} style={{ transition: "stroke .3s" }} />
          ))}
          {[R1, R2].map((d, i) => (
            <path key={d} d={d} fill="none" stroke={side === "right" ? "var(--sand)" : "var(--control)"} strokeWidth="1.2" strokeDasharray={i ? "3 4" : undefined} className={cn(i && animate && "[animation:dash_1.2s_linear_infinite]")} style={{ transition: "stroke .3s" }} />
          ))}
          {animate &&
            [L1, L2, R1, R2].map((d, i) => (
              <circle key={"p" + i} r="2.2" fill="var(--ember)">
                <animateMotion dur={2.2 + (i % 2) * 0.6 + "s"} begin={i * 0.35 + "s"} repeatCount="indefinite" path={d} />
              </circle>
            ))}

          {/* The hub: Zephyrus itself. */}
          <g transform="translate(262,88)">
            <rect x="-4" y="-4" width="124" height="52" rx="10" fill="none" stroke="var(--border)" />
            <rect width="116" height="44" rx="8" fill="var(--raised)" stroke="var(--control)" />
            <g transform="translate(12,12)" fill="none" strokeLinecap="round" strokeWidth="1.8">
              <path d="M2 4.5h7.5a2 2 0 1 0-1.9-2.6" stroke="var(--sand)" />
              <path d="M2 9.5h11a2 2 0 1 1-1.9 2.6" stroke="var(--muted)" />
              <path d="M2 14.5h5" stroke="var(--ember)" />
            </g>
            <text x="38" y="20" fontSize="11" fontWeight="600" fill="var(--text)">
              Zephyrus
            </text>
            <text x="38" y="34" fontSize="11" fill="var(--faint)">
              {hasToday ? "filed" : "due tonight"}
            </text>
          </g>

          {/* The stack: one sheet per daily report; a new one prints when today's is written. */}
          <g onMouseEnter={() => setSide("right")} onMouseLeave={() => setSide("")}>
            {[2, 1, 0].map((k) => (
              <g key={`${reports}-${k}`} transform={`translate(${450 + k * 12},${40 - k * 10})`} opacity={1 - k * 0.28}>
                <g className={k === 0 && animate ? "[animation:sheet-in_.7s_cubic-bezier(.2,.8,.2,1)_both]" : undefined}>
                  <rect width="138" height="102" rx="4" fill="var(--raised)" stroke="var(--control)" />
                  {k === 0 && (
                    <>
                      <text x="10" y="18" fontSize="11" fill="var(--faint)" className="num">
                        Report #{Math.max(1, reports + (hasToday ? 0 : 1))}
                      </text>
                      <text x="128" y="18" fontSize="11" textAnchor="end" fill={hasToday ? "var(--positive)" : "var(--ember-soft)"}>
                        {hasToday ? "filed" : "tonight"}
                      </text>
                      <rect x="10" y="25" width={hasToday ? 72 : 44} height="5" rx="1.5" fill="var(--text)" opacity={hasToday ? 0.75 : 0.25} />
                      <rect x="10" y="35" width="96" height="3" rx="1" fill="var(--control)" />
                      <rect x="10" y="42" width={hasToday ? 84 : 30} height="3" rx="1" fill="var(--control)" />
                      {week.map((v, j) => {
                        const h = Math.max(2, (v / wmax) * 34);
                        return <rect key={j} x={12 + j * 13} y={92 - h} width="8" height={h} fill={j === week.length - 1 ? "var(--ember)" : "var(--sand)"} opacity={j === week.length - 1 ? 1 : 0.35 + j * 0.1} />;
                      })}
                      <path d="M96 64h30M96 72h24M96 80h28" stroke="var(--control)" strokeWidth="2.5" />
                    </>
                  )}
                </g>
              </g>
            ))}
          </g>
        </svg>
        <div className="grid gap-4 px-5 pt-5 sm:grid-cols-2 sm:pt-0">
          <div>
            <h2 className="font-display text-[15px] font-semibold">Your day flows in</h2>
            <p className="mt-1 max-w-[46ch] text-[13px] leading-5 text-muted">Dials, uploads that went live, finished reminders and planner blocks, and notes from today. Hover the circles for the counts.</p>
          </div>
          <div className="sm:text-right">
            <h2 className="font-display text-[15px] font-semibold">Tonight&apos;s report</h2>
            <p className="mt-1 text-[13px] leading-5 text-muted sm:ml-auto sm:max-w-[46ch]">
              {reports} {reports === 1 ? "report" : "reports"} on the stack. {hasToday ? "Today's is filed." : "Write Shipped, Stuck and Tomorrow and today's prints onto it."}
            </p>
          </div>
        </div>
      </div>
    </Panel>
  );
}
