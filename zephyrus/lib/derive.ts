import type { CallEvent, Lead, Niche, State, Video } from "./types";
import { STAGES } from "./types";
import { addDays, dayKey } from "./time";

export type CallCounts = { dials: number; reached: number; interested: number; demos: number; won: number };

export function countCalls(calls: CallEvent[], from: string, to: string, niche?: Niche): CallCounts {
  const c: CallCounts = { dials: 0, reached: 0, interested: 0, demos: 0, won: 0 };
  for (const e of calls) {
    const d = dayKey(new Date(e.at));
    if (d < from || d > to || (niche && e.niche !== niche)) continue;
    c.dials++;
    if (e.outcome !== "noanswer") c.reached++;
    if (e.outcome === "interested" || e.outcome === "demo" || e.outcome === "won") c.interested++;
    if (e.outcome === "demo") c.demos++;
    if (e.outcome === "won") c.won++;
  }
  return c;
}

export const monthStart = (today: string) => today.slice(0, 8) + "01";

/** The dashboard's one signal: what has slipped, or is due before the day ends. */
export type VideoUrgency = "late" | "today" | "ok" | "missed";

export function videoUrgency(v: Video, now: number): VideoUrgency {
  const idx = STAGES.indexOf(v.stage);
  const due = new Date(v.publishAt).getTime();
  if (v.stage === "live") return "ok";
  if (v.stage === "scheduled") return due < now ? "missed" : "ok";
  if (due < now) return "late";
  if (dayKey(due) === dayKey(now) && idx < STAGES.indexOf("scheduled")) return "today";
  return "ok";
}

export function callbacks(leads: Lead[], now: number) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return leads
    .filter((l) => l.nextAt && (l.status === "callback" || l.status === "interested") && new Date(l.nextAt).getTime() <= end.getTime())
    .sort((a, b) => a.nextAt!.localeCompare(b.nextAt!));
}

export function finding(s: State, now: number) {
  const today = dayKey(now);
  const due = s.videos.filter((v) => {
    const u = videoUrgency(v, now);
    return u === "today" || u === "late";
  });
  const late = due.filter((v) => videoUrgency(v, now) === "late").length;
  const cbs = callbacks(s.leads, now);
  const overdue = cbs.filter((l) => new Date(l.nextAt!).getTime() < now).length;
  const dials = countCalls(s.calls, today, today).dials;
  return { due: due.length, late, callbacks: cbs.length, overdue, dials };
}

export function lastNDays(today: string, n: number) {
  return Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
}
