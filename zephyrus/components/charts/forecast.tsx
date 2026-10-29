"use client";

import { useState } from "react";
import { compact, niceTicks } from "@/lib/utils";
import { useSize } from "./use-size";

/**
 * The Ink Orbit insights chart, made honest: the solid line is what has
 * happened, the dashed line after "Today" is the current pace carried to the
 * end of the period, and its end value is labelled. Scrub to read any day.
 */
export function Forecast({
  points,
  todayIndex,
  height = 190,
  format,
  ariaLabel,
}: {
  points: { label: string; value: number }[];
  todayIndex: number;
  height?: number | "fill";
  format: (n: number) => string;
  ariaLabel: string;
}) {
  const [ref, { w: W, h: measured }] = useSize();
  const [hover, setHover] = useState<number | null>(null);
  const H = height === "fill" ? measured : height;
  const padL = 4;
  const padR = 44;
  const top = 22;
  const bot = 24;
  const n = points.length;
  const ticks = niceTicks(Math.max(...points.map((p) => p.value), 1), 3, true);
  const max = ticks[ticks.length - 1];
  const X = (i: number) => padL + (i / Math.max(1, n - 1)) * (W - padL - padR);
  const Y = (v: number) => top + (1 - v / max) * (H - top - bot);
  // Cumulative totals step up on the day a deal closes.
  const step = (from: number, to: number) => {
    let d = `M${X(from)},${Y(points[from].value)}`;
    for (let i = from + 1; i <= to; i++) d += `H${X(i)}V${Y(points[i].value)}`;
    return d;
  };
  const t = Math.max(0, Math.min(n - 1, todayIndex));
  const past = step(0, t);
  const future = `M${X(t)},${Y(points[t].value)}L${X(n - 1)},${Y(points[n - 1].value)}`;
  const area = `${past}V${H - bot}H${X(0)}Z`;
  const i = hover ?? t;
  const end = points[n - 1];

  return (
    <div ref={ref} className={height === "fill" ? "relative min-h-[200px] w-full flex-1 select-none" : "relative w-full select-none"} style={height === "fill" ? undefined : { height }}>
      {W > 0 && H > 0 && (
        <svg
          width={W}
          height={H}
          className="block cursor-crosshair touch-none"
          role="img"
          aria-label={ariaLabel}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left - padL) / (W - padL - padR)) * (n - 1)))));
          }}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={padL} x2={W - padR + 6} y1={Y(v)} y2={Y(v)} stroke="var(--grid)" />
              <text x={W} y={Y(v) + 4} fontSize={11} textAnchor="end" fill="var(--faint)" className="num">
                {compact(v)}
              </text>
            </g>
          ))}
          <path d={area} fill="var(--ember)" opacity={0.1} />
          <path d={past} fill="none" stroke="var(--ember)" strokeWidth={2} strokeLinejoin="round" />
          <path d={future} fill="none" stroke="var(--sand)" strokeWidth={1.5} strokeDasharray="4 4" />
          <line x1={X(t)} x2={X(t)} y1={top - 8} y2={H - bot} stroke="var(--control)" strokeDasharray="2 3" />
          <text x={X(t) - 6} y={top - 10} fontSize={11} fill="var(--muted)" textAnchor="end">
            Today
          </text>
          <text x={X(n - 1)} y={Y(end.value) + 18} fontSize={11} fill="var(--muted)" textAnchor="end" className="num" opacity={hover === null && X(n - 1) - X(t) > 70 ? 1 : 0}>
            ~{format(end.value)}
          </text>
          <text x={X(0)} y={H - 6} fontSize={11} fill="var(--faint)">
            {points[0].label}
          </text>
          <text x={X(n - 1)} y={H - 6} fontSize={11} fill="var(--faint)" textAnchor="end">
            {end.label}
          </text>
          {hover !== null && <line x1={X(i)} x2={X(i)} y1={top} y2={H - bot} stroke="var(--sand)" strokeOpacity={0.5} />}
          <circle cx={X(i)} cy={Y(points[i].value)} r={4.5} fill="var(--text)" stroke={i > t ? "var(--sand)" : "var(--ember)"} strokeWidth={2.5} />
          {hover !== null && (
          <g transform={`translate(${Math.max(56, Math.min(W - padR - 56, X(i)))},${Math.max(30, Y(points[i].value) - 22)})`} pointerEvents="none">
            <rect x={-54} y={-12} width={108} height={20} rx={10} fill="var(--text)" />
            <text x={0} y={2} fontSize={11} fontWeight={600} textAnchor="middle" fill="var(--ground)" className="num">
              {(i > t ? "pace " : points[i].label + " ") + format(points[i].value)}
            </text>
          </g>
          )}
        </svg>
      )}
    </div>
  );
}
