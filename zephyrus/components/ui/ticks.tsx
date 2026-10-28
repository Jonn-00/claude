"use client";

import { useId } from "react";

/* The Finance Bento's runway: a row of tick marks, every sixth one taller,
   lit up to the ratio. They draw in left to right the first time. */
export function Ticks({ ratio, n = 36, height = 22, major = 6, lit = "var(--ember)", off = "rgb(255 255 255 / 0.28)", label, delay = 0 }: { ratio: number; n?: number; height?: number; major?: number; lit?: string; off?: string; label: string; delay?: number }) {
  const id = useId();
  const r = Math.max(0, Math.min(1, ratio));
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${n * 10} ${height}`} preserveAspectRatio="none" role="img" aria-label={`${label}: ${Math.round(r * 100)}%`} key={id}>
      {Array.from({ length: n }, (_, i) => {
        const on = i / (n - 1) <= r && r > 0;
        return (
          <line
            key={i}
            x1={i * 10 + 5}
            x2={i * 10 + 5}
            y1={i % major === 0 ? 1 : 7}
            y2={height - 1}
            stroke={on ? lit : off}
            strokeWidth={1.7}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ opacity: 0, animation: `tick-in .3s ${delay + i * 12}ms forwards`, transition: `stroke .25s ${i * 10}ms` }}
          />
        );
      })}
    </svg>
  );
}

/* The allocation gauge: ticks round a half circle, coloured by each part's
   share, with the headline figure in the middle. */
export function TickGauge({ parts, value, unit, caption, size = 280 }: { parts: { label: string; value: number; color: string }[]; value: string; unit?: string; caption: string; size?: number }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const n = 56;
  const R = size / 2 - 14;
  const P = (r: number, deg: number) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)];
  const edges: number[] = [];
  parts.reduce((a, p) => (edges.push(a + p.value / total), a + p.value / total), 0);
  return (
    <svg width="100%" viewBox={`${-size / 2} ${-size / 2} ${size} ${size / 2 + 18}`} role="img" aria-label={`${caption}: ${parts.map((p) => `${p.label} ${p.value}`).join(", ")}`} className="block max-w-[320px]">
      {Array.from({ length: n + 1 }, (_, i) => {
        const f = i / n;
        const k = edges.findIndex((e) => f <= e + 1e-9);
        const part = parts[k === -1 ? parts.length - 1 : k];
        const deg = 180 + f * 180;
        const [x1, y1] = P(R, deg);
        const [x2, y2] = P(i % 7 === 0 ? R - 24 : R - 18, deg);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={part.color} strokeWidth={3.2} strokeLinecap="round" style={{ opacity: 0, animation: `tick-in .4s ${i * 12}ms forwards` }} />;
      })}
      <text y={-22} textAnchor="middle" fontSize={50} fontWeight={300} fill="#fff" letterSpacing={-2} className="num" style={{ fontFamily: "var(--font-display)" }}>
        {value}
        {unit && (
          <tspan fontSize={17} dy={-22} fill="rgb(255 255 255 / .6)">
            {unit}
          </tspan>
        )}
      </text>
      <text y={0} textAnchor="middle" fontSize={12} fill="rgb(255 255 255 / .62)">
        {caption}
      </text>
    </svg>
  );
}
