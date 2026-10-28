"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { tip } from "@/components/ui/tooltip";
import { useReducedMotion, useSize } from "./use-size";

/** Smooth path through points (Catmull-Rom as cubic Béziers), from the Analytics Bento. */
function smooth(P: [number, number][]) {
  const n = P.length;
  if (n < 2) return "";
  const g = (i: number) => P[Math.max(0, Math.min(n - 1, i))];
  let d = `M${P[0][0]},${P[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2), k = 0.18;
    d += `C${p1[0] + (p2[0] - p0[0]) * k},${p1[1] + (p2[1] - p0[1]) * k} ${p2[0] - (p3[0] - p1[0]) * k},${p2[1] - (p3[1] - p1[1]) * k} ${p2[0]},${p2[1]}`;
  }
  return d;
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * The Analytics Bento's mirrored waves: one measure rises above the midline,
 * the other hangs below it, each with fainter lines for earlier periods.
 * The lines grow in and then breathe slightly while on screen.
 */
export function Waves({
  hours,
  above,
  below,
  labels,
  height = 220,
}: {
  hours: number[];
  /** [current, prior, prior-before] */
  above: number[][];
  below: number[][];
  labels: { above: string; below: string; current: string };
  height?: number;
}) {
  const [ref, { w: W }] = useSize();
  const reduce = useReducedMotion();
  const id = useId().replace(/:/g, "");
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const [hover, setHover] = useState<number | null>(null);
  const [visible, setVisible] = useState(true);
  const H = height;
  const n = hours.length;
  // Each side has its own scale so the shape of each is readable; the tooltip carries the real counts.
  const maxA = Math.max(1, ...above.flat());
  const maxB = Math.max(1, ...below.flat());
  const pad = 30;
  const mid = (H - 18) / 2;
  const amp = mid - 10;
  const X = (i: number) => pad + (i / Math.max(1, n - 1)) * (W - 2 * pad);
  const sets = useMemo(() => [...above.map((a, k) => ({ a, dir: -1, k, g: "a" })), ...below.map((a, k) => ({ a, dir: 1, k, g: "b" }))], [above, below]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  const grown = useRef(0);
  useEffect(() => {
    if (!W) return;
    let raf = 0;
    // Growth only runs while the chart is on screen; off screen it's drawn whole.
    const g0 = grown.current;
    const t0 = performance.now() - g0 * 1200;
    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      const g = !visible || reduce ? 1 : Math.min(1, t / 1.2);
      if (visible) grown.current = g;
      const grow = ease(g);
      sets.forEach((s, j) => {
        const breathe = reduce ? 1 : 1 + Math.sin(t * 1.1 + s.k * 0.9) * 0.03;
        const max = s.g === "a" ? maxA : maxB;
        const P = s.a.map((v, i) => [X(i), mid + s.dir * (3 + (v / max) * amp * grow * breathe)] as [number, number]);
        paths.current[j]?.setAttribute("d", smooth(P));
      });
      if (!reduce && visible) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, sets, reduce, maxA, maxB, visible]);

  const move = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const i = Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left - pad) / (W - 2 * pad)) * (n - 1))));
    setHover(i);
    const a = above[0][i];
    const b = below[0][i];
    tip.show(r.left + X(i), r.top + 14, {
      title: `${String(hours[i]).padStart(2, "0")}:00 · ${labels.current}`,
      rows: [
        { label: labels.above, value: String(a), swatch: "var(--sand)" },
        { label: labels.below, value: String(b), swatch: "var(--ember)" },
        { label: "Pick-up rate", value: a ? `${Math.round((b / a) * 100)}%` : "—" },
      ],
    });
  };

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height: H }}>
      {W > 0 && (
        <svg width={W} height={H} className="block" role="img" aria-label={`${labels.above} and ${labels.below} by hour, ${labels.current}`}>
          <defs>
            <linearGradient id={`${id}a`} x1="0" x2="1">
              <stop offset="0" stopColor="var(--dune)" />
              <stop offset="1" stopColor="var(--sand)" />
            </linearGradient>
            <linearGradient id={`${id}b`} x1="0" x2="1">
              <stop offset="0" stopColor="var(--clay)" />
              <stop offset="1" stopColor="var(--ember)" />
            </linearGradient>
          </defs>
          <line x1={pad} x2={W - pad} y1={mid} y2={mid} stroke="var(--grid)" />
          {hours.map((h, i) => (
            <text key={h} x={X(i)} y={H - 4} fontSize={11} textAnchor="middle" fill={hover === i ? "var(--text)" : "var(--faint)"} className="num">
              {i % 2 === 0 || n <= 8 ? String(h).padStart(2, "0") : ""}
            </text>
          ))}
          {sets.map((s, j) => (
            <path
              key={`${s.g}${s.k}`}
              ref={(el) => {
                paths.current[j] = el;
              }}
              fill="none"
              stroke={`url(#${id}${s.g})`}
              strokeWidth={s.k === 0 ? 2.5 : 1.5}
              strokeLinecap="round"
              opacity={s.k === 0 ? 1 : s.k === 1 ? 0.45 : 0.22}
            />
          ))}
          {hover !== null && <line x1={X(hover)} x2={X(hover)} y1={6} y2={H - 6} stroke="var(--sand)" strokeOpacity={0.5} strokeDasharray="3 3" />}
          <rect
            width={W}
            height={H}
            fill="transparent"
            onPointerMove={move}
            onPointerLeave={() => {
              setHover(null);
              tip.hide();
            }}
          />
        </svg>
      )}
    </div>
  );
}
