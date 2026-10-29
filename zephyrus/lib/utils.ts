import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export const fmt = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** 12,400 → 12.4k; used only where space is tight (axis ticks, chips). */
export const compact = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return (n / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (a >= 1000) return (n / 1000).toFixed(a >= 10_000 ? 0 : 1).replace(/\.0$/, "") + "k";
  return String(Math.round(n));
};

export const signed = (n: number, digits = 0) => (n > 0 ? "+" : n < 0 ? "−" : "") + fmt(Math.abs(n), digits);

export const pct = (n: number, digits = 1) => signed(n * 100, digits) + "%";

export const uid = () => Math.random().toString(36).slice(2, 10);

/** Deterministic PRNG so estimates are stable between loads. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Round, even axis steps: the top tick sits above the maximum. */
/** Round axis ticks. Counts and money in whole units pass integer, so a tiny max never repeats "1". */
export function niceTicks(max: number, count = 4, integer = false) {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const step = integer ? Math.max(1, Math.round(nice)) : nice;
  const top = Math.ceil((max * 1.0001) / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  if (ticks[ticks.length - 1] <= max) ticks.push(top + step);
  return ticks;
}
