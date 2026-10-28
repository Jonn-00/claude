"use client";

import { useEffect, useRef } from "react";
import { fmt } from "@/lib/utils";

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/** Counts from the last shown value to the new one; instant with reduced motion. */
export function CountUp({ value, digits = 0, prefix = "", suffix = "", duration = 900 }: { value: number; digits?: number; prefix?: string; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      el.textContent = prefix + fmt(value, digits) + suffix;
      from.current = value;
      return;
    }
    const a = from.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const v = a + (value - a) * ease(t);
      el.textContent = prefix + fmt(v, digits) + suffix;
      from.current = v;
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, digits, prefix, suffix, duration]);
  return (
    <span ref={ref} className="num">
      {prefix + fmt(value, digits) + suffix}
    </span>
  );
}
