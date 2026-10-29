import type { CallEvent, Lead, LeadLog, LeadStatus, State } from "./types";
import { dayKey } from "./time";

/*
  Leads and dials live in this artifact's Claude database when the page is
  opened in Claude, so they follow you across devices and Claude can add
  researched agents straight into the queue. Run anywhere else (the local
  dev server, a saved copy), everything stays in this browser as before.

  Lead documents keep the Realtor Call Tracker's shape (business, area,
  notes, followUp, status "to_call"...), so a lead list written for the
  tracker loads here unchanged. Dials are grouped one document per day
  (dials/2026-10-29 → { items: [...] }) to stay far below the database's
  document cap.
*/

type Snap = { docs: { id: string; data(): Record<string, unknown> | undefined }[]; empty: boolean };
type Ref = { set(d: Record<string, unknown>): Promise<void>; delete(): Promise<void> };
type Coll = { doc(id: string): Ref; onSnapshot(next: (s: Snap) => void, err?: (e: { code: string }) => void): () => void };
type Db = { collection(path: string): Coll };

// The tracker's status names, where they differ from ours.
const TO_DOC: Partial<Record<LeadStatus, string>> = { new: "to_call", noanswer: "no_answer", sample: "sample_sent" };
const FROM_DOC: Record<string, LeadStatus> = { to_call: "new", no_answer: "noanswer", sample_sent: "sample" };
const status = (v: unknown): LeadStatus => {
  const s = String(v ?? "new");
  return FROM_DOC[s] ?? (["new", "noanswer", "voicemail", "callback", "sample", "interested", "demo", "won", "lost"].includes(s) ? (s as LeadStatus) : "new");
};
const str = (v: unknown) => (typeof v === "string" ? v : "");
const opt = (v: unknown) => (typeof v === "string" && v ? v : undefined);

/** A follow-up date with no time is due at 10:00 that day. */
const dateToIso = (d: string) => {
  const x = new Date(d + "T10:00:00");
  return isNaN(x.getTime()) ? undefined : x.toISOString();
};

export function leadFromDoc(id: string, d: Record<string, unknown>): Lead {
  const log = Array.isArray(d.log) ? (d.log as { d: string; s: string }[]).map((e): LeadLog => ({ d: e.d, s: status(e.s) })) : [];
  return {
    id,
    business: str(d.business) || "Unnamed",
    contact: str(d.contact),
    niche: d.niche === "detailing" ? "detailing" : "realestate",
    city: str(d.city) || str(d.area),
    phone: str(d.phone),
    status: status(d.status),
    nextAt: opt(d.nextAt) ?? (opt(d.followUp) ? dateToIso(d.followUp as string) : undefined),
    note: str(d.note) || str(d.notes),
    score: d.score === "Hot" || d.score === "Warm" || d.score === "Cold" ? d.score : undefined,
    team: opt(d.team),
    brokerage: opt(d.brokerage),
    email: opt(d.email),
    website: opt(d.website),
    instagram: opt(d.instagram),
    category: opt(d.category),
    why: opt(d.why),
    researchNotes: opt(d.researchNotes),
    floorPlans: Array.isArray(d.floorPlans) ? (d.floorPlans as Lead["floorPlans"]) : undefined,
    floorPlanNote: opt(d.floorPlanNote),
    siteVideo: opt(d.siteVideo),
    confidence: opt(d.confidence),
    verified: opt(d.verified),
    source: opt(d.source),
    lastContact: opt(d.lastContact),
    log,
  };
}

export function leadToDoc(l: Lead): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    business: l.business,
    contact: l.contact,
    niche: l.niche,
    area: l.city,
    phone: l.phone,
    status: TO_DOC[l.status] ?? l.status,
    nextAt: l.nextAt ?? "",
    followUp: l.nextAt ? dayKey(new Date(l.nextAt)) : "",
    notes: l.note,
    lastContact: l.lastContact ?? "",
    log: (l.log ?? []).map((e) => ({ d: e.d, s: TO_DOC[e.s] ?? e.s })),
    score: l.score,
    team: l.team,
    brokerage: l.brokerage,
    email: l.email,
    website: l.website,
    instagram: l.instagram,
    category: l.category,
    why: l.why,
    researchNotes: l.researchNotes,
    floorPlans: l.floorPlans,
    floorPlanNote: l.floorPlanNote,
    siteVideo: l.siteVideo,
    confidence: l.confidence,
    verified: l.verified,
    source: l.source,
  };
  for (const k of Object.keys(doc)) if (doc[k] === undefined) delete doc[k];
  return doc;
}

const callDay = (c: CallEvent) => dayKey(new Date(c.at));
function byDay(calls: CallEvent[]) {
  const m = new Map<string, CallEvent[]>();
  for (const c of calls) {
    const k = callDay(c);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(c);
  }
  return m;
}
const callToDoc = ({ id, at, niche, outcome, leadId }: CallEvent) => (leadId ? { id, at, niche, outcome, leadId } : { id, at, niche, outcome });

type Hooks = {
  get(): State;
  /** Replace leads or calls with what the database holds, without writing back. */
  applyRemote(patch: Partial<Pick<State, "leads" | "calls">>): void;
  onStatus(s: CloudStatus): void;
};
export type CloudStatus = "local" | "connecting" | "synced" | "error";

let db: Db | null = null;
const queues = new Map<string, Promise<void>>();

/** One write at a time per document, in order. */
function enqueue(key: string, op: () => Promise<void>, onError: () => void) {
  const next = (queues.get(key) ?? Promise.resolve()).then(op).catch(onError);
  queues.set(key, next);
}

export async function startCloud(h: Hooks) {
  const claude = typeof window !== "undefined" ? (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude : undefined;
  if (!claude?.use) return h.onStatus("local");
  h.onStatus("connecting");
  const found = (await claude.use("db").catch(() => null)) as Db | null;
  if (!found) return h.onStatus("local");
  db = found;
  const fail = () => h.onStatus("error");

  let firstLeads = true;
  db.collection("leads").onSnapshot((snap) => {
    if (firstLeads && snap.empty && h.get().leads.length) {
      // First time in Claude: carry over leads added in this browser.
      firstLeads = false;
      for (const l of h.get().leads) writeLead(l, fail);
      return;
    }
    firstLeads = false;
    h.applyRemote({ leads: snap.docs.map((d) => leadFromDoc(d.id, d.data() ?? {})) });
    h.onStatus("synced");
  }, fail);

  let firstDials = true;
  db.collection("dials").onSnapshot((snap) => {
    if (firstDials && snap.empty && h.get().calls.length) {
      firstDials = false;
      for (const [day, items] of byDay(h.get().calls)) writeDay(day, items, fail);
      return;
    }
    firstDials = false;
    const calls = snap.docs.flatMap((d) => ((d.data()?.items as CallEvent[]) ?? []).map((c) => ({ ...c })));
    calls.sort((a, b) => a.at.localeCompare(b.at));
    h.applyRemote({ calls });
    h.onStatus("synced");
  }, fail);
}

function writeLead(l: Lead, onError: () => void) {
  if (!db) return;
  const ref = db.collection("leads").doc(l.id);
  enqueue("leads/" + l.id, () => ref.set(leadToDoc(l)), onError);
}
function writeDay(day: string, items: CallEvent[], onError: () => void) {
  if (!db) return;
  const ref = db.collection("dials").doc(day);
  enqueue("dials/" + day, () => (items.length ? ref.set({ items: items.map(callToDoc) }) : ref.delete()), onError);
}

/** After a local change, write only the leads and days that changed. */
export function pushChanges(prev: State, next: State, onError: () => void) {
  if (!db) return;
  if (prev.leads !== next.leads) {
    const before = new Map(prev.leads.map((l) => [l.id, l]));
    for (const l of next.leads) if (before.get(l.id) !== l) writeLead(l, onError);
    const now = new Set(next.leads.map((l) => l.id));
    for (const l of prev.leads) {
      if (now.has(l.id)) continue;
      const ref = db.collection("leads").doc(l.id);
      enqueue("leads/" + l.id, () => ref.delete(), onError);
    }
  }
  if (prev.calls !== next.calls) {
    const a = byDay(prev.calls);
    const b = byDay(next.calls);
    for (const day of new Set([...a.keys(), ...b.keys()])) {
      const x = a.get(day) ?? [];
      const y = b.get(day) ?? [];
      if (x.length !== y.length || x.some((c, i) => c !== y[i])) writeDay(day, y, onError);
    }
  }
}

export const cloudOn = () => db !== null;
