"use client";

import { useEffect, useId, useState } from "react";
import { compact, niceTicks } from "@/lib/utils";
import { tip } from "@/components/ui/tooltip";
import { useReducedMotion, useSize } from "./use-size";

export type LinePoint = { key: string; label: string; value: number };
export type LineMark = { index: number; label: string };

/**
 * One series, straight segments, a faint fade under the line, upload days
 * marked on the axis. Drag or hover anywhere to scrub.
 */
export function LineChart({
  points,
  marks = [],
  height = 200,
  unit,
  format = (n: number) => n.toLocaleString("en-US"),
  color = "var(--ember)",
  ariaLabel,
}: {
  points: LinePoint[];
  marks?: LineMark[];
  height?: number | "fill";
  unit: string;
  format?: (n: number) => string;
  color?: string;
  ariaLabel: string;
}) {
  const [ref, { w: W, h: measured }] = useSize();
  const reduce = useReducedMotion();
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(false);
  const sig = points.length + ":" + (points[0]?.key ?? "") + ":" + (points.at(-1)?.value ?? 0);
  useEffect(() => {
    setDrawn(false);
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    return () => cancelAnimationFrame(r);
  }, [sig]);

  const H = height === "fill" ? measured : height;
  const padL = 4;
  const padR = 40;
  const top = 10;
  const bot = 26;
  const vals = points.map((p) => p.value);
  const ticks = niceTicks(Math.max(...vals, 1), 4);
  const max = ticks[ticks.length - 1];
  const n = points.length;
  const X = (i: number) => padL + (n < 2 ? 0 : (i / (n - 1)) * (W - padL - padR));
  const Y = (v: number) => top + (1 - v / max) * (H - top - bot);
  const P = points.map((p, i) => [X(i), Y(p.value)] as const);
  const line = P.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const area = n ? `${line}L${P[n - 1][0]},${H - bot}L${P[0][0]},${H - bot}Z` : "";

  // 4–6 x labels on one even step that lands on the last point.
  const want = W < 420 ? 4 : 6;
  const step = Math.max(1, Math.ceil((n - 1) / (want - 1)));
  const xs: number[] = [];
  for (let i = n - 1; i >= 0; i -= step) xs.unshift(i);

  const move = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const i = Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left - padL) / (W - padL - padR)) * (n - 1))));
    setHover(i);
    const m = marks.find((k) => k.index === i);
    tip.show(r.left + P[i][0], r.top + P[i][1], {
      title: points[i].label,
      rows: [{ label: unit, value: format(points[i].value), swatch: color }, ...(m ? [{ label: "Uploaded", value: m.label }] : [])],
    });
  };
  const leave = () => {
    setHover(null);
    tip.hide();
  };

  return (
    <div ref={ref} className={height === "fill" ? "relative min-h-[220px] w-full flex-1 select-none" : "relative w-full select-none"} style={height === "fill" ? undefined : { height }}>
      {W > 0 && H > 0 && n > 1 && (
        <svg width={W} height={H} className="block touch-none" role="img" aria-label={ariaLabel}>
          <defs>
            <linearGradient id={`${id}f`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.32" />
              <stop offset="0.55" stopColor={color} stopOpacity="0.08" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - padR + 6} y1={Y(t)} y2={Y(t)} stroke="var(--grid)" strokeWidth={1} />
              <text x={W} y={Y(t) + 4} textAnchor="end" fontSize={11} fill="var(--faint)" className="num">
                {compact(t)}
              </text>
            </g>
          ))}
          {marks.map((m) => (
            <line key={m.index} x1={X(m.index)} x2={X(m.index)} y1={H - bot} y2={H - bot + 5} stroke="var(--sand)" strokeWidth={1.5} />
          ))}
          <path d={area} fill={`url(#${id}f)`} style={{ opacity: drawn || reduce ? 1 : 0, transition: "opacity 600ms ease 300ms" }} />
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            pathLength={1}
            style={{
              strokeDasharray: 1,
              strokeDashoffset: drawn || reduce ? 0 : 1,
              transition: reduce ? "none" : "stroke-dashoffset 900ms cubic-bezier(.3,.8,.2,1)",
            }}
          />
          {xs.map((i) => (
            <text key={i} x={X(i)} y={H - 6} fontSize={11} fill="var(--faint)" textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>
              {points[i].label}
            </text>
          ))}
          {hover !== null ? (
            <>
              <line x1={P[hover][0]} x2={P[hover][0]} y1={top} y2={H - bot} stroke="var(--sand)" strokeOpacity={0.6} strokeWidth={1} strokeDasharray="3 3" />
              <circle cx={P[hover][0]} cy={P[hover][1]} r={10} fill={color} opacity={0.18} />
              <circle cx={P[hover][0]} cy={P[hover][1]} r={4.5} fill="var(--text)" stroke={color} strokeWidth={2.5} />
            </>
          ) : (
            <circle cx={P[n - 1][0]} cy={P[n - 1][1]} r={4} fill={color} stroke="var(--surface)" strokeWidth={2} />
          )}
          <rect x={0} y={0} width={W} height={H} fill="transparent" onPointerMove={move} onPointerDown={move} onPointerLeave={leave} />
        </svg>
      )}
    </div>
  );
}
