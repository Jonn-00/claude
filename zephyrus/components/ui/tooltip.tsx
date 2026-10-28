"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/* One floating tooltip for every chart, positioned in viewport space. */

export type Tip = { title: string; rows: { label: string; value: string; swatch?: string }[] };
type Api = { show: (x: number, y: number, t: Tip) => void; hide: () => void };

const api: { current: Api | null } = { current: null };
export const tip = {
  show: (x: number, y: number, t: Tip) => api.current?.show(x, y, t),
  hide: () => api.current?.hide(),
};

export function ChartTooltip() {
  const [state, setState] = useState<(Tip & { x: number; y: number }) | null>(null);
  const [pos, setPos] = useState({ l: 0, t: 0 });
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    api.current = { show: (x, y, t) => setState({ ...t, x, y }), hide: () => setState(null) };
    return () => {
      api.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    if (!state || !box.current) return;
    const r = box.current.getBoundingClientRect();
    let l = state.x + 14;
    let t = state.y - r.height - 12;
    if (l + r.width > window.innerWidth - 8) l = state.x - r.width - 14;
    if (t < 8) t = state.y + 16;
    setPos({ l, t });
  }, [state]);
  return (
    <div
      ref={box}
      role="tooltip"
      className={cn(
        "pointer-events-none fixed z-50 rounded-[10px] border border-control bg-raised px-2.5 py-2 text-[12px] shadow-[0_10px_30px_-12px_rgb(0_0_0/0.8)] transition-opacity duration-150",
        state ? "opacity-100" : "opacity-0",
      )}
      style={{ left: pos.l, top: pos.t }}
    >
      {state && (
        <>
          <div className="mb-1 text-muted">{state.title}</div>
          {state.rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 text-muted">
                {r.swatch && <i className="inline-block size-2 rounded-[2px]" style={{ background: r.swatch }} />}
                {r.label}
              </span>
              <b className="num font-medium text-text">{r.value}</b>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
