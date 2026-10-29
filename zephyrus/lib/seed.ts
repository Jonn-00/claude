import type { State } from "./types";
import { DEFAULT_STAGES } from "./types";
import { dayKey } from "./time";

/*
  First run: your four channels (their numbers come from lib/youtube.ts), the
  default production stages and your settings. Everything else starts empty
  and fills with what you add. It is saved in this browser only.
*/

/** Your four channels. */
export const CHANNELS: State["channels"] = [
  { id: "c1", name: "tikktokers", handle: "@tikktokers", niche: "", rpm: 0.09, avd: 0.5, subRate: 0.0011 },
  { id: "c2", name: "sadaqtali6528", handle: "@sadaqtali6528", niche: "", rpm: 4.2, avd: 7.8, subRate: 0.0021 },
  { id: "c3", name: "Truth Laboratory", handle: "@Truth-Laboratory-Official", niche: "", rpm: 9.5, avd: 9.4, subRate: 0.0026 },
  { id: "c4", name: "CoolioCarZ", handle: "@CoolioCarZ", niche: "", rpm: 5.1, avd: 14.2, subRate: 0.0019 },
];
const OLD_SAMPLE_NAMES = ["Stoic Minutes", "Deep Sea Files", "Money Mechanics", "Lost History"];

/** Brings data saved by an earlier version up to date without losing your edits. */
export function migrate(s: State): State {
  const channels = s.channels.map((c, i) => {
    const fresh = CHANNELS.find((x) => x.id === c.id) ?? CHANNELS[i];
    // Swap the old sample names for your channels; keep anything you renamed yourself.
    return OLD_SAMPLE_NAMES.includes(c.name) ? { ...c, name: fresh.name, handle: fresh.handle, niche: "" } : { ...fresh, ...c, handle: c.handle ?? fresh.handle };
  });
  return stripSample({ ...s, channels, stages: s.stages?.length ? s.stages : DEFAULT_STAGES.map((x) => ({ ...x })), labels: s.labels ?? {} });
}

/*
  Earlier versions opened with made-up videos, leads, dials, planner blocks,
  reminders, notes and reports. Those carry ids no item you add can have
  (yours get random ones), so they can go without touching your own work.
  Dials you logged against a sample lead stay, unlinked from it.
*/
const SAMPLE_REPORTS = [
  "Uploaded Lost History #31. Booked demo with Mirror Finish.",
  "52 dials. Closed Lakeview Property Co.",
  "Scripts for 3 Stoic shorts.",
];
const sampleId = {
  videos: /^v\d{2}$/,
  leads: /^l\d{2}$/,
  calls: /^(k\d+-\d+|m-l\d{2}-\w+)$/,
  blocks: /^b-\d{4}-\d{2}-\d{2}-\d{2}:\d{2}$/,
  reminders: /^r\d$/,
  notes: /^n\d$/,
};
function stripSample(s: State): State {
  const mine = <T extends { id: string }>(arr: T[], re: RegExp) => arr.filter((x) => !re.test(x.id));
  const agenda = Object.fromEntries(Object.entries(s.agenda).filter(([, e]) => !SAMPLE_REPORTS.includes(e.shipped)));
  return {
    ...s,
    videos: mine(s.videos, sampleId.videos),
    leads: mine(s.leads, sampleId.leads),
    calls: mine(s.calls, sampleId.calls).map((c) => (c.leadId && sampleId.leads.test(c.leadId) ? { ...c, leadId: undefined } : c)),
    blocks: mine(s.blocks, sampleId.blocks),
    reminders: mine(s.reminders, sampleId.reminders),
    notes: mine(s.notes, sampleId.notes),
    agenda,
  };
}

export function seed(now = Date.now()): State {
  return {
    version: 1,
    seededOn: dayKey(now),
    channels: CHANNELS.map((c) => ({ ...c })),
    videos: [],
    leads: [],
    calls: [],
    blocks: [],
    reminders: [],
    agenda: {},
    notes: [],
    settings: { dialTarget: 60, dealValue: 120 },
    stages: DEFAULT_STAGES.map((x) => ({ ...x })),
    labels: {},
  };
}
