"use client";

import { useEffect, useState } from "react";
import { fmt } from "@/lib/utils";
import { tip } from "@/components/ui/tooltip";
import { CountUp } from "@/components/ui/count-up";
import { useSize } from "./use-size";

type Item = { id: string; name: string; group: string; value: number };
type Rect = Item & { x: number; y: number; w: number; h: number };

function squarify(items: Item[], x: number, y: number, w: number, h: number): Rect[] {
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  const scale = (w * h) / total;
  const out: Rect[] = [];
  let rest = items.map((i) => ({ ...i, a: i.value * scale }));
  const worst = (row: typeof rest, len: number) => {
    const s = row.reduce((a, b) => a + b.a, 0);
    const mx = Math.max(...row.map((r) => r.a));
    const mn = Math.min(...row.map((r) => r.a));
    return Math.max((len * len * mx) / (s * s), (s * s) / (len * len * mn));
  };
  while (rest.length) {
    const len = Math.min(w, h);
    const row = [rest[0]];
    let i = 1;
    while (i < rest.length && worst([...row, rest[i]], len) <= worst(row, len)) row.push(rest[i++]);
    rest = rest.slice(i);
    const s = row.reduce((a, b) => a + b.a, 0);
    if (w >= h) {
      const cw = s / h;
      let cy = y;
      for (const r of row) {
        const rh = r.a / cw;
        out.push({ ...r, x, y: cy, w: cw, h: rh });
        cy += rh;
      }
      x += cw;
      w -= cw;
    } else {
      const rh = s / w;
      let cx = x;
      for (const r of row) {
        const rw = r.a / rh;
        out.push({ ...r, x: cx, y, w: rw, h: rh });
        cx += rw;
      }
      y += rh;
      h -= rh;
    }
  }
  return out;
}

/**
 * The Analytics Bento treemap: tiles grow into place and re-flow when the
 * period changes. Groups are channels, toned from one warm family.
 */
export function Treemap({
  items,
  groups,
  height = 320,
  unit,
  ariaLabel,
}: {
  items: Item[];
  groups: { id: string; name: string; color: string; ink: string }[];
  height?: number;
  unit: string;
  ariaLabel: string;
}) {
  const [ref, { w: W }] = useSize();
  const [placed, setPlaced] = useState(false);
  useEffect(() => {
    if (!W) return;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setPlaced(true)));
    return () => cancelAnimationFrame(r);
  }, [W]);
  const G = 4;
  const H = height;
  const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = sorted.reduce((a, b) => a + b.value, 0) || 1;
  const rects = W ? squarify(sorted, 0, 0, W + G, H + G) : [];
  return (
    <div ref={ref} className="relative w-full" style={{ height: H }} role="img" aria-label={ariaLabel}>
      {rects.map((r) => {
        const g = groups.find((x) => x.id === r.group)!;
        const w = r.w - G;
        const h = r.h - G;
        const share = ((r.value / total) * 100).toFixed(1) + "%";
        const chars = fmt(r.value).length;
        const fs = Math.min(22, (w - 20) / (chars * 0.6));
        const showValue = fs >= 12 && h >= 34;
        const showName = showValue && h >= 70 && w >= 96;
        const radius = Math.max(2, Math.min(10, w / 4, h / 4));
        return (
          <div
            key={r.id}
            className="absolute flex flex-col justify-between overflow-hidden p-2.5 transition-[left,top,width,height,filter] duration-700 ease-[var(--ease-out)] hover:brightness-110 motion-reduce:transition-none"
            style={{
              left: placed ? r.x : W / 2,
              top: placed ? r.y : H / 2,
              width: placed ? Math.max(0, w) : 0,
              height: placed ? Math.max(0, h) : 0,
              background: g.color,
              color: g.ink,
              borderRadius: radius,
              padding: w < 40 || h < 40 ? 0 : undefined,
            }}
            onPointerMove={(e) =>
              tip.show(e.clientX, e.clientY, {
                title: `${g.name}`,
                rows: [
                  { label: r.name, value: fmt(r.value), swatch: g.color },
                  { label: "Share of " + unit, value: share },
                ],
              })
            }
            onPointerLeave={() => tip.hide()}
          >
            {showName && <div className="line-clamp-2 text-[12px] leading-[16px] font-medium">{r.name}</div>}
            {showValue && (
              <div className="font-display leading-none font-medium tracking-[-0.02em]" style={{ fontSize: fs }}>
                <CountUp value={r.value} duration={700} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
