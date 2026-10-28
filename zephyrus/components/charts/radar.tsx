"use client";

import { useEffect, useRef, useState } from "react";
import { fmt } from "@/lib/utils";
import { tip } from "@/components/ui/tooltip";
import { useReducedMotion, useSize } from "./use-size";

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * The Analytics Bento radar: a low-order Fourier fit keeps the lobes round,
 * and switching data morphs the shape from where it was instead of
 * redrawing it. Hover the ring to read each spoke.
 */
export function Radar({ values, axis, unit, label, color = "var(--ember)" }: { values: number[]; axis: string[]; unit: string; label: string; color?: string }) {
  const [ref, { w }] = useSize();
  const reduce = useReducedMotion();
  const line = useRef<SVGPathElement>(null);
  const fill = useRef<SVGPathElement>(null);
  const cur = useRef<number[] | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const N = values.length;
  const S = Math.min(w, 340);
  const R = S / 2 - 30;
  const C = S / 2;
  const ang = (i: number) => -Math.PI / 2 + (i / N) * Math.PI * 2;

  const norm = (v: number[]) => {
    const lo = Math.min(...v);
    const hi = Math.max(...v);
    return v.map((x) => 0.42 + ((x - lo) / (hi - lo || 1)) * 0.58);
  };
  const fit = (v: number[]) => {
    const K = Math.min(3, Math.floor(N / 2));
    const co: [number, number][] = [];
    for (let k = 0; k <= K; k++) {
      let a = 0;
      let b = 0;
      v.forEach((x, i) => {
        const th = (i / N) * Math.PI * 2;
        a += x * Math.cos(k * th);
        b += x * Math.sin(k * th);
      });
      co.push([(a * (k ? 2 : 1)) / N, (b * (k ? 2 : 1)) / N]);
    }
    return (th: number) => co.reduce((r, [a, b], k) => r + a * Math.cos(k * th) + b * Math.sin(k * th), 0);
  };
  const at = (f: (t: number) => number, th: number): [number, number] => {
    const v = Math.max(0.05, f(th));
    const a = -Math.PI / 2 + th;
    return [C + Math.cos(a) * (R * 0.2 + v * R * 0.8), C + Math.sin(a) * (R * 0.2 + v * R * 0.8)];
  };
  const shape = (v: number[]) => {
    const f = fit(norm(v));
    let d = "";
    for (let j = 0; j <= 140; j++) {
      const p = at(f, (j / 140) * Math.PI * 2);
      d += (j ? "L" : "M") + p[0].toFixed(2) + "," + p[1].toFixed(2);
    }
    return d + "Z";
  };
  const point = (v: number[], i: number) => at(fit(norm(v)), (i / N) * Math.PI * 2);

  useEffect(() => {
    if (!S) return;
    const from = cur.current ?? values.map((x) => x * 0.6);
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = reduce ? 1 : ease(Math.min(1, (now - t0) / 800));
      cur.current = from.map((v, i) => v + (values[i] - v) * t);
      const d = shape(cur.current);
      line.current?.setAttribute("d", d);
      fill.current?.setAttribute("d", d);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, S, reduce]);

  const move = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const x = e.clientX - r.left - C;
    const y = e.clientY - r.top - C;
    if (Math.hypot(x, y) < R * 0.2) {
      setHover(null);
      tip.hide();
      return;
    }
    let a = Math.atan2(y, x) + Math.PI / 2;
    if (a < 0) a += Math.PI * 2;
    const i = Math.round((a / (Math.PI * 2)) * N) % N;
    const p = point(values, i);
    setHover(i);
    tip.show(r.left + p[0], r.top + p[1], { title: `${axis[i]} · ${label}`, rows: [{ label: unit, value: fmt(values[i]), swatch: color }] });
  };
  const hp = hover !== null ? point(values, hover) : null;
  const best = values.indexOf(Math.max(...values));

  return (
    <div ref={ref} className="mx-auto w-full max-w-[340px]" style={{ height: S || 300 }}>
      {S > 0 && (
        <svg width={S} height={S} className="mx-auto block" role="img" aria-label={`${unit} by weekday, ${label}; best is ${axis[best]}`}>
          {[0.36, 0.68, 1].map((k) => (
            <circle key={k} cx={C} cy={C} r={R * k} fill="none" stroke="var(--grid)" />
          ))}
          {axis.map((m, i) => (
            <g key={m}>
              <line x1={C + Math.cos(ang(i)) * R * 0.2} y1={C + Math.sin(ang(i)) * R * 0.2} x2={C + Math.cos(ang(i)) * R} y2={C + Math.sin(ang(i)) * R} stroke="var(--grid)" />
              <text
                x={C + Math.cos(ang(i)) * (R + 16)}
                y={C + Math.sin(ang(i)) * (R + 16)}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                fill={i === best ? "var(--text)" : "var(--faint)"}
                fontWeight={i === best ? 600 : 400}
              >
                {m}
              </text>
            </g>
          ))}
          <path ref={fill} fill={color} opacity={0.12} />
          <path ref={line} fill="none" strokeWidth={2.5} strokeLinejoin="round" stroke={color} />
          <circle cx={C} cy={C} r={R * 0.2} fill="var(--surface)" stroke="var(--grid)" />
          {hp && <circle cx={hp[0]} cy={hp[1]} r={4.5} fill="var(--text)" stroke={color} strokeWidth={2.5} />}
          <rect
            width={S}
            height={S}
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
