"use client";

import { useEffect, useState } from "react";

export const DAY = 86_400_000;

/** Local calendar key, e.g. 2026-10-28. */
export const dayKey = (d: Date | number) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

export const fromKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (k: string, n: number) => {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};

export const startOfDay = (d: Date | number) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

/** Minutes since midnight. */
export const minutesOf = (d: Date | number) => {
  const x = new Date(d);
  return x.getHours() * 60 + x.getMinutes();
};

export const hhmm = (mins: number) => {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.round(mins % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export const timeOf = (iso: string | number | Date) => hhmm(minutesOf(new Date(iso)));

export const longDate = (d: Date | number) =>
  new Date(d).toLocaleDateString("en-CA", { weekday: "long", day: "numeric", month: "long" });

export const shortDate = (d: Date | number) =>
  new Date(d).toLocaleDateString("en-CA", { day: "numeric", month: "short" });

export const weekday = (d: Date | number) => new Date(d).toLocaleDateString("en-CA", { weekday: "short" });

/** "Today 15:00", "Tomorrow 09:30", "Thu 11:00", "12 Nov". */
export function relDay(iso: string | number, now: number) {
  const d = new Date(iso);
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / DAY);
  const t = timeOf(d);
  if (diff === 0) return `Today ${t}`;
  if (diff === 1) return `Tomorrow ${t}`;
  if (diff === -1) return `Yesterday ${t}`;
  if (diff > 1 && diff < 7) return `${weekday(d)} ${t}`;
  return shortDate(d);
}

/** "in 2 h 10 m", "40 m late". */
export function until(iso: string | number, now: number) {
  const m = Math.round((new Date(iso).getTime() - now) / 60_000);
  const a = Math.abs(m);
  const s = a >= 60 ? `${Math.floor(a / 60)} h${a % 60 ? ` ${a % 60} m` : ""}` : `${a} m`;
  return m >= 0 ? `in ${s}` : `${s} late`;
}

/** Re-renders every `ms`; the dashboard's sense of "now". */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
