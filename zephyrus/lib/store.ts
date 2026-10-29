"use client";

import { useMemo, useSyncExternalStore } from "react";
import { migrate, seed } from "./seed";
import { buildStats } from "./stats";
import { dayKey } from "./time";
import type { State } from "./types";
import { uid } from "./utils";
import { stagesOf } from "./stages";

const KEY = "zephyrus:v1";

let state: State | null = null;
const listeners = new Set<() => void>();

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as State;
      if (parsed.version === 1) return migrate(parsed);
    }
  } catch {
    /* private window or blocked storage: run from a first-run state */
  }
  return seed();
}

function save(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore: the session still works, it just won't persist */
  }
}

function get(): State {
  if (!state) {
    state = load();
    // Write the up-to-date shape back, so removed sample items leave storage too.
    save(state);
  }
  return state;
}

export function setState(fn: (s: State) => State) {
  state = fn(get());
  save(state);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      state = load();
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

/** null until the browser has loaded saved data (avoids SSR mismatches). */
export function useAppState(): State | null {
  return useSyncExternalStore(subscribe, get, () => null);
}

export function useStats(s: State | null) {
  const today = dayKey(Date.now());
  return useMemo(() => (s ? buildStats(s.channels, today) : []), [s?.channels, today]); // eslint-disable-line react-hooks/exhaustive-deps
}

export const getState = () => get();

type Coll = "videos" | "leads" | "blocks" | "reminders" | "notes";
/** Where an item sits now, so a delete can be undone in place. */
export function locate<K extends Coll>(key: K, id: string) {
  const arr = get()[key] as { id: string }[];
  const index = arr.findIndex((x) => x.id === id);
  return index < 0 ? null : { item: arr[index] as State[K][number], index };
}

/** Back to a first run: your channels as they were, default stages and settings, nothing else. */
export function resetAll() {
  setState(() => seed());
}

/** Keep your channels, stages, names and settings; empty everything else. */
export function startFresh() {
  setState((s) => ({ ...s, videos: [], leads: [], calls: [], blocks: [], reminders: [], agenda: {}, notes: [] }));
}

/* ---------------- actions ---------------- */

export const actions = {
  moveVideo(id: string, dir: 1 | -1) {
    setState((s) => {
      const order = stagesOf(s).map((x) => x.id);
      return {
        ...s,
        videos: s.videos.map((v) => {
          if (v.id !== id) return v;
          const i = Math.max(0, Math.min(order.length - 1, order.indexOf(v.stage) + dir));
          const stage = order[i];
          return { ...v, stage, liveAt: stage === "live" ? new Date().toISOString() : undefined };
        }),
      };
    });
  },
  setStage(id: string, stage: State["videos"][number]["stage"]) {
    setState((s) => ({
      ...s,
      videos: s.videos.map((v) => (v.id === id ? { ...v, stage, liveAt: stage === "live" ? v.liveAt ?? new Date().toISOString() : undefined } : v)),
    }));
  },
  restore<K extends Coll>(key: K, item: State[K][number], index: number) {
    setState((s) => {
      const arr = [...(s[key] as State[K][number][])];
      if (arr.some((x) => (x as { id: string }).id === (item as { id: string }).id)) return s;
      arr.splice(Math.min(index, arr.length), 0, item);
      return { ...s, [key]: arr };
    });
  },
  updateVideo(id: string, patch: Partial<State["videos"][number]>) {
    setState((s) => ({ ...s, videos: s.videos.map((v) => (v.id === id ? { ...v, ...patch } : v)) }));
  },
  renameStage(id: string, label: string) {
    setState((s) => ({ ...s, stages: stagesOf(s).map((x) => (x.id === id ? { ...x, label } : x)) }));
  },
  /** A new stage right after `after` (never after Live). Returns its id. */
  addStage(after: string, label = "New stage") {
    const id = "st-" + uid();
    setState((s) => {
      const list = [...stagesOf(s)];
      let i = list.findIndex((x) => x.id === after) + 1;
      const sched = list.findIndex((x) => x.id === "scheduled");
      if (sched >= 0 && i > sched) i = sched;
      list.splice(i, 0, { id, label });
      return { ...s, stages: list };
    });
    return id;
  },
  /** Removes a stage; its videos move to the stage before it. */
  removeStage(id: string) {
    setState((s) => {
      const list = stagesOf(s);
      const i = list.findIndex((x) => x.id === id);
      if (i < 0 || id === "scheduled" || id === "live") return s;
      const fallback = (list[i - 1] ?? list[i + 1]).id;
      return { ...s, stages: list.filter((x) => x.id !== id), videos: s.videos.map((v) => (v.stage === id ? { ...v, stage: fallback } : v)) };
    });
  },
  restoreStages(stages: State["stages"], videos: State["videos"]) {
    setState((s) => ({ ...s, stages, videos }));
  },
  setLabel(key: string, value: string) {
    setState((s) => ({ ...s, labels: { ...s.labels, [key]: value } }));
  },
  updateChannel(id: string, patch: Partial<State["channels"][number]>) {
    setState((s) => ({ ...s, channels: s.channels.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  },
  updateReminder(id: string, patch: Partial<State["reminders"][number]>) {
    setState((s) => ({ ...s, reminders: s.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  },
  addVideo(v: Omit<State["videos"][number], "id">) {
    const id = uid();
    setState((s) => ({ ...s, videos: [...s.videos, { ...v, id }] }));
    return id;
  },
  removeVideo(id: string) {
    setState((s) => ({ ...s, videos: s.videos.filter((v) => v.id !== id) }));
  },
  renameChannel(id: string, name: string, niche: string) {
    setState((s) => ({ ...s, channels: s.channels.map((c) => (c.id === id ? { ...c, name, niche } : c)) }));
  },
  logCall(e: Omit<State["calls"][number], "id" | "at">) {
    const id = uid();
    setState((s) => {
      const leads = e.leadId
        ? s.leads.map((l) => {
            if (l.id !== e.leadId) return l;
            const status =
              e.outcome === "won" ? "won" : e.outcome === "demo" ? "demo" : e.outcome === "interested" ? "interested" : l.status === "new" ? "callback" : l.status;
            return { ...l, status, nextAt: e.outcome === "won" ? undefined : l.nextAt } as typeof l;
          })
        : s.leads;
      return { ...s, leads, calls: [...s.calls, { ...e, id, at: new Date().toISOString() }] };
    });
    return id;
  },
  undoCall(id: string, lead?: State["leads"][number]) {
    setState((s) => ({
      ...s,
      calls: s.calls.filter((c) => c.id !== id),
      leads: lead ? s.leads.map((l) => (l.id === lead.id ? lead : l)) : s.leads,
    }));
  },
  updateLead(id: string, patch: Partial<State["leads"][number]>) {
    setState((s) => ({ ...s, leads: s.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  },
  addLead(l: Omit<State["leads"][number], "id">) {
    setState((s) => ({ ...s, leads: [{ ...l, id: uid() }, ...s.leads] }));
  },
  removeLead(id: string) {
    setState((s) => ({ ...s, leads: s.leads.filter((l) => l.id !== id) }));
  },
  addBlock(b: Omit<State["blocks"][number], "id">) {
    setState((s) => ({ ...s, blocks: [...s.blocks, { ...b, id: uid() }] }));
  },
  updateBlock(id: string, patch: Partial<State["blocks"][number]>) {
    setState((s) => ({ ...s, blocks: s.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
  },
  removeBlock(id: string) {
    setState((s) => ({ ...s, blocks: s.blocks.filter((b) => b.id !== id) }));
  },
  addReminder(r: Omit<State["reminders"][number], "id" | "done">) {
    setState((s) => ({ ...s, reminders: [...s.reminders, { ...r, id: uid(), done: false }] }));
  },
  toggleReminder(id: string) {
    setState((s) => ({ ...s, reminders: s.reminders.map((r) => (r.id === id ? { ...r, done: !r.done } : r)) }));
  },
  removeReminder(id: string) {
    setState((s) => ({ ...s, reminders: s.reminders.filter((r) => r.id !== id) }));
  },
  setAgenda(date: string, patch: Partial<State["agenda"][string]>) {
    setState((s) => ({
      ...s,
      agenda: { ...s.agenda, [date]: { ...{ shipped: "", stuck: "", tomorrow: "" }, ...s.agenda[date], ...patch } },
    }));
  },
  addNote(text: string) {
    setState((s) => ({ ...s, notes: [{ id: uid(), createdAt: new Date().toISOString(), text }, ...s.notes] }));
  },
  updateNote(id: string, text: string) {
    setState((s) => ({ ...s, notes: s.notes.map((n) => (n.id === id ? { ...n, text } : n)) }));
  },
  removeNote(id: string) {
    setState((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }));
  },
  setSettings(patch: Partial<State["settings"]>) {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  },
};
