"use client";

import { useEffect, useRef, useState } from "react";

/* The Finance Bento's dot-matrix figure: a 5×7 grid per character, unlit dots
   faintly visible behind, counting up to the value. */
const F: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  "$": ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  ",": ["0", "0", "0", "0", "0", "1", "1"],
  " ": ["00", "00", "00", "00", "00", "00", "00"],
};
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export function DotNumber({ value, pitch = 6, label, format = (n: number) => Math.round(n).toLocaleString("en-US") }: { value: number; pitch?: number; label: string; format?: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(value);
      from.current = value;
      return;
    }
    const a = from.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 900);
      const v = a + (value - a) * ease(t);
      from.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const text = format(shown);
  const on = new Set<string>();
  let x = 0;
  for (const ch of text) {
    const g = F[ch] ?? F[" "];
    const w = g[0].length;
    for (let r = 0; r < 7; r++) for (let k = 0; k < w; k++) if (g[r][k] === "1") on.add(`${x + k},${r}`);
    x += w + 1;
  }
  const cols = Math.max(1, x - 1);
  return (
    <svg width={cols * pitch} height={7 * pitch} viewBox={`0 0 ${cols * pitch} ${7 * pitch}`} role="img" aria-label={`${label}: ${format(value)}`}>
      {Array.from({ length: cols * 7 }, (_, i) => {
        const c = Math.floor(i / 7);
        const r = i % 7;
        const lit = on.has(`${c},${r}`);
        return (
          <circle
            key={i}
            cx={c * pitch + pitch / 2}
            cy={r * pitch + pitch / 2}
            r={pitch * 0.36}
            fill="#fff"
            opacity={lit ? 1 : 0.1}
            style={{ transform: lit ? "none" : "scale(.55)", transformBox: "fill-box", transformOrigin: "center", transition: `opacity .26s, transform .26s`, transitionDelay: `${c * 7}ms` }}
          />
        );
      })}
    </svg>
  );
}
