"use client";

import { useState } from "react";
import { compact, niceTicks } from "@/lib/utils";
import { useSize } from "./use-size";

/** Square-cornered columns; the current period in ember, the rest in sand. */
export function Bars({
  data,
  height = 180,
  unit,
  format,
  highlight,
  reference,
  ariaLabel,
}: {
  data: { label: string; value: number; sub?: string }[];
  height?: number | "fill";
  unit: string;
  format: (n: number) => string;
  highlight: number;
  reference?: { value: number; label: string };
  ariaLabel: string;
}) {
  const [ref, { w: W, h: measured }] = useSize();
  const [hover, setHover] = useState<number | null>(null);
  const H = height === "fill" ? measured : height;
  const top = 8;
  const bot = 24;
  const padR = 40;
  const ticks = niceTicks(Math.max(...data.map((d) => d.value), reference?.value ?? 0, 1) * 1.12, 3, true);
  const max = ticks[ticks.length - 1];
  const slot = (W - padR) / Math.max(1, data.length);
  const bw = Math.min(44, slot * 0.62);
  const Y = (v: number) => top + (1 - v / max) * (H - top - bot);
  return (
    <div ref={ref} className={height === "fill" ? "min-h-[200px] w-full flex-1" : "w-full"} style={height === "fill" ? undefined : { height }}>
      {W > 0 && H > 0 && (
        <svg width={W} height={H} role="img" aria-label={ariaLabel} className="block">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={W - padR + 6} y1={Y(t)} y2={Y(t)} stroke="var(--grid)" />
              <text x={W} y={Y(t) + 4} textAnchor="end" fontSize={11} fill="var(--faint)" className="num">
                {compact(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = i * slot + (slot - bw) / 2;
            const y = Y(d.value);
            const on = i === highlight;
            const h = Math.max(0, H - bot - y);
            const r = Math.min(4, bw / 4, h);
            const label = hover === i || (hover === null && on);
            return (
              <g key={i}>
                <path
                  d={`M${x},${H - bot}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${H - bot}Z`}
                  fill={on ? "var(--ember)" : hover === i ? "var(--sand)" : "var(--dune)"}
                  opacity={hover === null || hover === i || on ? 1 : 0.6}
                  style={{ transition: "opacity 160ms ease, fill 160ms ease" }}
                />
                {label && h > 0 && (
                  <g pointerEvents="none">
                    <rect x={x + bw / 2 - 18} y={y - 24} width={36} height={18} rx={9} fill={on ? "var(--ember)" : "var(--text)"} />
                    <text x={x + bw / 2} y={y - 11} fontSize={11} fontWeight={600} textAnchor="middle" fill="var(--ground)" className="num">
                      {format(d.value)}
                    </text>
                  </g>
                )}
                {(slot >= 30 || (data.length - 1 - i) % 2 === 0) && (
                  <text x={x + bw / 2} y={H - 6} fontSize={11} textAnchor={i === data.length - 1 && slot < 40 ? "end" : "middle"} fill={on ? "var(--text)" : "var(--faint)"}>
                    {d.label}
                  </text>
                )}
                <rect
                  x={i * slot}
                  y={0}
                  width={slot}
                  height={H}
                  fill="transparent"
                  onPointerMove={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                />
              </g>
            );
          })}
          <line x1={0} x2={W - padR + 6} y1={H - bot} y2={H - bot} stroke="var(--control)" />
          {reference && (
            <g pointerEvents="none">
              <line x1={0} x2={W - padR + 6} y1={Y(reference.value)} y2={Y(reference.value)} stroke="var(--sand)" strokeDasharray="4 4" />
              <text x={4} y={Y(reference.value) - 5} fontSize={11} fill="var(--muted)">
                {reference.label}
              </text>
            </g>
          )}
        </svg>
      )}
    </div>
  );
}
