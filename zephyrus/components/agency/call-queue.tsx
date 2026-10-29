"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Copy, ExternalLink, Phone, Search, Trash2 } from "lucide-react";
import { actions, useCloudStatus } from "@/lib/store";
import type { Lead, LeadScore, LeadStatus, Niche, State } from "@/lib/types";
import { LEAD_OUTCOMES, LEAD_STATUS_LABEL, NICHE_LABEL, OPEN_STATUSES } from "@/lib/types";
import { addDays, dayKey, fromKey, shortDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { Editable } from "@/components/ui/editable";
import { notify, removeWithUndo } from "@/components/ui/notify";

/*
  The call queue, rebuilt from the Realtor Call Tracker: who to call next,
  each agent's research on one sheet, one tap to log the call. Logging an
  outcome records a dial, sets the status and proposes the follow-up.
*/

const STATUSES = Object.keys(LEAD_STATUS_LABEL) as LeadStatus[];
const SCORE_RANK: Record<LeadScore, number> = { Hot: 0, Warm: 1, Cold: 2 };

const pill: Record<LeadStatus, string> = {
  new: "bg-ember-tint text-ember-soft",
  noanswer: "border border-control text-muted",
  voicemail: "border border-control text-muted",
  callback: "bg-[#2a2016] text-[#e8c49a]",
  sample: "bg-[#2a2016] text-[#e8c49a]",
  interested: "bg-positive-bg text-positive",
  demo: "bg-positive-bg text-positive",
  won: "bg-positive text-ground",
  lost: "bg-raised text-faint line-through",
};
const scoreTone: Record<LeadScore, string> = {
  Hot: "bg-ember-tint text-ember-soft",
  Warm: "bg-[#2a2016] text-[#e8c49a]",
  Cold: "bg-raised text-muted",
};

const followUpDay = (l: Lead) => (l.nextAt ? dayKey(new Date(l.nextAt)) : "");
const isOpen = (l: Lead) => OPEN_STATUSES.includes(l.status);
const isDue = (l: Lead, today: string) => isOpen(l) && !!l.nextAt && followUpDay(l) <= today;
function rank(l: Lead, today: string) {
  if (!isOpen(l)) return 5;
  const f = followUpDay(l);
  if (f && f < today) return 0;
  if (f === today) return 1;
  if (l.status === "new") return 2;
  return 3;
}
function followUpText(l: Lead, today: string) {
  const f = followUpDay(l);
  if (!f || !isOpen(l)) return l.lastContact ? `Last call ${shortDate(fromKey(l.lastContact))}` : "Not called yet";
  if (f < today) return `Overdue · ${shortDate(fromKey(f))}`;
  if (f === today) return "Follow up today";
  return `Follow up ${shortDate(fromKey(f))}`;
}

// Toronto time decides whether it's a good moment to dial.
function callWindow(now: number) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", weekday: "short", hour: "numeric", minute: "2-digit", hour12: false }).formatToParts(new Date(now));
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const m = (Number(get("hour")) % 24) * 60 + Number(get("minute"));
    const weekend = get("weekday") === "Sat" || get("weekday") === "Sun";
    const good = !weekend && ((m >= 570 && m < 690) || (m >= 960 && m < 1080));
    return { good, text: good ? "Good time to call" : weekend ? "Weekend: agents are at showings" : "Outside best call hours" };
  } catch {
    return null;
  }
}

const NAME_KEY = "zephyrus:my-name";
function useMyName() {
  const [name, setName] = useState("");
  useEffect(() => {
    try {
      setName(localStorage.getItem(NAME_KEY) ?? "");
    } catch {
      /* storage blocked: the scripts show [you] */
    }
  }, []);
  const save = (v: string) => {
    setName(v);
    try {
      localStorage.setItem(NAME_KEY, v);
    } catch {
      /* ignore */
    }
  };
  return [name, save] as const;
}

const firstName = (l: Lead) => {
  const n = (l.contact || l.business || "").trim();
  if (!n || /team|group|pros|condo|realty|homes/i.test(n)) return "there";
  return n.split(/[\s&]/)[0];
};
const followUpTextFor = (l: Lead, me: string) =>
  `Hi ${firstName(l)}, it's ${me || "[your name]"}. I just tried calling. I turn builder floor plans into accurate 3D walkthrough videos for pre-construction and assignment listings. Want one free from a floor plan you're marketing now? Reply STOP to opt out.`;

async function copy(text: string, msg: string) {
  try {
    await navigator.clipboard.writeText(text);
    notify(msg);
  } catch {
    notify("Copy this", { detail: text });
  }
}

export function CallQueue({ state, now, focus }: { state: State; now: number; focus: string | null }) {
  const today = dayKey(now);
  const cloud = useCloudStatus();
  const [me, setMe] = useMyName();
  const [filter, setFilter] = useState<"queue" | "due" | "all" | LeadStatus>("queue");
  const [score, setScore] = useState<LeadScore | "all">("all");
  const [niche, setNiche] = useState<Niche | "all">("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const win = callWindow(now);

  useEffect(() => {
    if (!focus) return;
    setOpen((o) => new Set(o).add(focus));
    setFilter("all");
    const t = setTimeout(() => document.getElementById(`lead-${focus}`)?.scrollIntoView({ block: "center" }), 80);
    return () => clearTimeout(t);
  }, [focus]);

  const pool = state.leads.filter((l) => (score === "all" || l.score === score) && (niche === "all" || l.niche === niche));
  const count = (fn: (l: Lead) => boolean) => pool.filter(fn).length;
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return pool
      .filter((l) =>
        filter === "queue" ? isOpen(l) : filter === "due" ? isDue(l, today) : filter === "all" ? true : l.status === filter,
      )
      .filter((l) => !term || [l.business, l.contact, l.team, l.brokerage, l.city, l.category, l.note].join(" ").toLowerCase().includes(term))
      .sort(
        (a, b) =>
          rank(a, today) - rank(b, today) ||
          (followUpDay(a) || "9999").localeCompare(followUpDay(b) || "9999") ||
          (a.score ? SCORE_RANK[a.score] : 3) - (b.score ? SCORE_RANK[b.score] : 3) ||
          a.business.localeCompare(b.business),
      );
  }, [pool, filter, q, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const chips: [typeof filter, string, number][] = [
    ["queue", "Call queue", count(isOpen)],
    ["due", "Due", count((l) => isDue(l, today))],
    ...STATUSES.map((st): [typeof filter, string, number] => [st, LEAD_STATUS_LABEL[st], count((l) => l.status === st)]),
    ["all", "All", pool.length],
  ];

  return (
    <Panel
      tone="glass"
      index={10}
      className="mt-4"
      title="Call queue"
      aside={
        <span className="flex items-center gap-3 text-[12px]">
          {win && <span className={win.good ? "text-positive" : "text-faint"}>{win.text}</span>}
          <span className="inline-flex items-center gap-1.5 text-faint" title={cloud === "synced" ? "Leads and dials are saved to this artifact in Claude" : "Leads and dials are saved in this browser"}>
            <i className={cn("size-1.5 rounded-full", cloud === "synced" ? "bg-positive" : cloud === "error" ? "bg-negative" : "bg-faint")} />
            {cloud === "synced" ? "Saved to Claude" : cloud === "error" ? "Not saving" : cloud === "connecting" ? "Connecting" : "This browser"}
          </span>
        </span>
      }
    >
      <Script me={me} setMe={setMe} />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Filter by status">
          {chips.map(([k, label, n]) => (
            <button
              key={k}
              aria-pressed={filter === k}
              onClick={() => setFilter(k)}
              className={cn("press inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px]", filter === k ? "bg-active text-text" : "text-muted hover:bg-raised hover:text-text")}
            >
              {label} <span className="num text-faint">{n}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Niche"
            value={niche}
            onChange={setNiche}
            items={[
              { value: "all", label: "Both" },
              { value: "realestate", label: "Real estate" },
              { value: "detailing", label: "Detailing" },
            ]}
          />
          <select
            value={score}
            onChange={(e) => setScore(e.target.value as LeadScore | "all")}
            aria-label="Filter by score"
            className="h-8 cursor-pointer rounded-full border border-border bg-raised px-3 text-[13px] text-text outline-none"
          >
            <option value="all">All scores</option>
            <option value="Hot">Hot</option>
            <option value="Warm">Warm</option>
            <option value="Cold">Cold</option>
          </select>
          <label className="flex h-8 items-center gap-2 rounded-full border border-border bg-raised px-3">
            <Search size={14} className="text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search agents, brokerages, areas" aria-label="Search leads" className="w-[190px] bg-transparent text-[13px] text-text outline-none" />
          </label>
        </div>
      </div>

      <ul className="mt-3 grid gap-2">
        {rows.map((l) => {
          const expanded = open.has(l.id);
          const overdue = rank(l, today) === 0;
          const sub = [l.team && l.team !== l.business ? l.team : l.contact, l.brokerage, l.city].filter(Boolean).join(" · ");
          return (
            <li
              key={l.id}
              id={`lead-${l.id}`}
              className={cn("overflow-hidden rounded-[14px] border bg-surface/60", overdue ? "border-ember/40" : "border-border", focus === l.id && "bg-raised")}
            >
              <button
                aria-expanded={expanded}
                onClick={() => setOpen((o) => {
                  const n = new Set(o);
                  if (n.has(l.id)) n.delete(l.id);
                  else n.add(l.id);
                  return n;
                })}
                className="grid w-full grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-3 py-2.5 text-left hover:bg-raised/50 md:grid-cols-[56px_minmax(0,1.7fr)_150px_140px_150px_20px]"
              >
                <span className={cn("rounded-[6px] py-0.5 text-center text-[11px] font-medium tracking-[0.04em] uppercase", l.score ? scoreTone[l.score] : "bg-raised text-faint")}>
                  {l.score ?? NICHE_LABEL[l.niche].split(" ")[0]}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium">{l.business}</span>
                  {sub && <span className="block truncate text-[12px] text-faint">{sub}</span>}
                </span>
                <ChevronRight size={15} className={cn("justify-self-end text-faint transition-transform duration-200 md:order-last", expanded && "rotate-90")} />
                <span className="num col-span-2 col-start-2 text-[13px] text-muted md:col-span-1 md:col-start-auto">{l.phone || "No phone"}</span>
                <span className={cn("col-start-2 justify-self-start rounded-full px-2.5 py-1 text-[12px] whitespace-nowrap md:col-start-auto", pill[l.status])}>{LEAD_STATUS_LABEL[l.status]}</span>
                <span className={cn("num text-right text-[12px] md:text-left", overdue ? "font-medium text-ember-soft" : "text-faint")}>{followUpText(l, today)}</span>
              </button>
              {expanded && <Sheet l={l} me={me} today={today} />}
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="rounded-[14px] border border-dashed border-border px-4 py-7 text-center text-[13px] text-faint">
            {state.leads.length === 0 ? (
              <>
                <strong className="mb-1 block text-[15px] font-medium text-text">No agents yet</strong>
                Add one with Quick add (N), or ask Claude to load a lead list into Zephyrus.
              </>
            ) : (
              "No agents match this filter."
            )}
          </li>
        )}
      </ul>
    </Panel>
  );
}

function Script({ me, setMe }: { me: string; setMe: (v: string) => void }) {
  const you = me || "[you]";
  return (
    <details className="group rounded-[14px] border border-border bg-surface/60">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-[14px] font-medium">
        Call script
        <span className="flex items-center gap-2 text-[12px] font-normal text-faint">
          Opener, objections, voicemail
          <ChevronRight size={14} className="transition-transform duration-200 group-open:rotate-90" />
        </span>
      </summary>
      <div className="grid gap-5 px-3 pb-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          <div>
            <h3 className="mb-1.5 text-[12px] text-faint">Opener, about 30 seconds</h3>
            <p className="max-w-[62ch] rounded-[10px] bg-ember-tint/60 px-3 py-2.5 text-[14px] leading-[21px]">
              &ldquo;Hi [Name], it&apos;s {you}. Quick one. I build accurate 3D walkthrough videos straight from floor plans, made for pre-construction and assignment units where there&apos;s nothing to film yet. Can I make one free from a floor plan you&apos;re marketing right now and text it to you?&rdquo;
            </p>
          </div>
          <div>
            <h3 className="mb-1.5 text-[12px] text-faint">Voicemail, 15 seconds</h3>
            <p className="max-w-[62ch] rounded-[10px] bg-ember-tint/60 px-3 py-2.5 text-[14px] leading-[21px]">
              &ldquo;Hi [Name], {you} here. I turn floor plans into walkthrough videos for pre-con and assignment listings. I&apos;ll text you a sample. Have a good one.&rdquo;
            </p>
          </div>
          <label className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
            Your name in scripts and texts
            <input value={me} onChange={(e) => setMe(e.target.value.trimStart())} placeholder="e.g. Jonathan" className="h-8 w-44 rounded-[8px] border border-control bg-raised px-2.5 text-text outline-none focus:border-sand" />
          </label>
        </div>
        <div className="grid content-start gap-4 text-[13px] leading-[19px]">
          <div>
            <h3 className="mb-1.5 text-[12px] text-faint">Objections</h3>
            <ul className="grid gap-2">
              <li><b className="block font-medium text-text">&ldquo;I already have a videographer.&rdquo;</b><span className="text-muted">This is for units that aren&apos;t built yet, or for social posts while you wait on the shoot.</span></li>
              <li><b className="block font-medium text-text">&ldquo;Is it accurate?&rdquo;</b><span className="text-muted">It&apos;s modelled from the builder&apos;s floor plan, so the layout and dimensions match. I label it as a rendering for RECO.</span></li>
              <li><b className="block font-medium text-text">&ldquo;How much?&rdquo;</b><span className="text-muted">The first one is free. After that, [$X] per floor plan, ready in 24 hours.</span></li>
              <li><b className="block font-medium text-text">&ldquo;Send me an email.&rdquo;</b><span className="text-muted">Ask which floor plan to use, then send the sample, not a pitch.</span></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-1.5 text-[12px] text-faint">When to call</h3>
            <ul className="grid list-disc gap-1 pl-4 text-muted">
              <li>Weekdays 9:30 to 11:30 am and 4 to 6 pm. Skip weekend afternoons (open houses).</li>
              <li>No answer: leave the voicemail, then use Copy text on their sheet.</li>
              <li>If anyone says &ldquo;don&apos;t call again&rdquo;, mark them Not interested and stop.</li>
            </ul>
          </div>
        </div>
      </div>
    </details>
  );
}

const MATCH: Record<string, string> = { exact: "their listing", size: "same size", project: "same project" };

function Sheet({ l, me, today }: { l: Lead; me: string; today: string }) {
  const [note, setNote] = useState(l.note);
  const [saved, setSaved] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Take in a note changed elsewhere (another device) while this one isn't being typed in.
  useEffect(() => {
    if (!timer.current) setNote(l.note);
  }, [l.note]);
  const onNote = (v: string) => {
    setNote(v);
    setSaved("Saving…");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      actions.updateLead(l.id, { note: v });
      setSaved("Saved");
    }, 700);
  };

  const digits = l.phone.replace(/[^\d+]/g, "");
  const site = l.website ? "https://" + l.website.replace(/^https?:\/\//, "").split(" ")[0] : null;
  const ig = l.instagram ? `https://www.instagram.com/${encodeURIComponent(l.instagram)}/` : null;
  const source = l.source?.startsWith("http") ? l.source.split(" ")[0] : null;
  const sourceIsSite = source && site && source.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] === site.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  const facts: [string, React.ReactNode, boolean?][] = [
    ["Name", <Editable key="b" value={l.business} label="Business" onSave={(v) => actions.updateLead(l.id, { business: v })} />],
    ["Phone", <Editable key="p" value={l.phone} label="Phone" placeholder="Add phone" allowEmpty onSave={(v) => actions.updateLead(l.id, { phone: v })} />],
    ["Brokerage", <Editable key="br" value={l.brokerage ?? ""} label="Brokerage" placeholder="Add" allowEmpty onSave={(v) => actions.updateLead(l.id, { brokerage: v || undefined })} />],
    ["Area", <Editable key="a" value={l.city} label="Area" placeholder="Add" allowEmpty onSave={(v) => actions.updateLead(l.id, { city: v })} />],
    ["Email", l.email || "Not published"],
    ["Site shows video/3D", l.siteVideo || "–"],
    ["Confidence", l.confidence || "–"],
    ["Verified", l.verified ? shortDate(fromKey(l.verified)) : "–"],
    ["Niche", NICHE_LABEL[l.niche]],
    ["Focus", l.category || "–", true],
  ];

  const log = (o: (typeof LEAD_OUTCOMES)[number]) => {
    const { id, before } = actions.logLeadOutcome(l.id, o);
    const when = o.days == null ? "" : ` · follow up ${shortDate(fromKey(addDays(today, o.days)))}`;
    notify(`${o.label}${when}`, { detail: l.business, undo: () => actions.undoCall(id, before) });
  };

  return (
    <div className="grid gap-5 border-t border-rule bg-raised/40 px-3 pt-4 pb-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="grid min-w-0 content-start gap-4">
        <div>
          <h3 className="mb-1.5 text-[12px] text-faint">Why call them</h3>
          <p className="max-w-[60ch] text-[14px] leading-[21px]">{l.why || "No research notes yet."}</p>
          {l.researchNotes && <p className="mt-1.5 text-[13px] text-ember-soft">{l.researchNotes}</p>}
        </div>
        {(l.floorPlans?.length || l.floorPlanNote) && (
          <div>
            <h3 className="mb-1.5 text-[12px] text-faint">Floor plans</h3>
            {l.floorPlanNote && <p className="mb-1.5 max-w-[60ch] text-[13px] text-muted">{l.floorPlanNote}</p>}
            <ul className="grid gap-1.5">
              {l.floorPlans?.map((p) => (
                <li key={p.url} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px]">
                  <span className={cn("rounded-full border px-1.5 text-[11px] whitespace-nowrap", p.match === "exact" ? "border-ember/60 text-ember-soft" : "border-border text-faint")}>{MATCH[p.match ?? ""] ?? "reference"}</span>
                  <a href={p.url} target="_blank" rel="noreferrer" className="break-words hover:text-ember-soft">
                    {p.label}
                    {p.lowRes ? " (low-res)" : ""}
                  </a>
                  {p.source && (
                    <a href={p.source} target="_blank" rel="noreferrer" className="text-[12px] text-faint hover:text-text">
                      page
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
          {facts.map(([k, v, wide]) => (
            <div key={k} className={cn("min-w-0", wide && "col-span-2 sm:col-span-3")}>
              <dt className="text-[11px] text-faint">{k}</dt>
              <dd className="num text-[13px] break-words">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-1.5">
          {l.phone && (
            <a href={`tel:${digits}`} className="press inline-flex h-8 items-center gap-1.5 rounded-full bg-text px-3 text-[13px] text-ground">
              <Phone size={13} /> Call {l.phone}
            </a>
          )}
          {l.phone && <LinkButton onClick={() => copy(l.phone, `Copied ${l.phone}`)} icon={<Copy size={12} />}>Copy number</LinkButton>}
          <LinkButton onClick={() => copy(followUpTextFor(l, me), "Copied the follow-up text")} icon={<Copy size={12} />}>Copy text</LinkButton>
          {l.email && <LinkButton onClick={() => copy(l.email!, `Copied ${l.email}`)} icon={<Copy size={12} />}>Copy email</LinkButton>}
          {site && <LinkButton href={site} icon={<ExternalLink size={12} />}>Website</LinkButton>}
          {ig && <LinkButton href={ig} icon={<ExternalLink size={12} />}>Instagram</LinkButton>}
          {source && !sourceIsSite && <LinkButton href={source} icon={<ExternalLink size={12} />}>Source</LinkButton>}
        </div>
      </div>

      <div className="grid min-w-0 content-start gap-4">
        <div>
          <h3 className="mb-1.5 text-[12px] text-faint">Log this call</h3>
          <div className="flex flex-wrap gap-1.5">
            {LEAD_OUTCOMES.map((o) => (
              <button key={o.status} onClick={() => log(o)} className="press h-8 rounded-full border border-control px-3 text-[13px] hover:border-sand hover:bg-raised">
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="grid gap-1 text-[12px] text-faint">
            Status
            <select
              value={l.status}
              onChange={(e) => actions.updateLead(l.id, { status: e.target.value as LeadStatus })}
              aria-label={`Status for ${l.business}`}
              className="h-9 rounded-[8px] border border-control bg-raised px-2 text-[13px] text-text outline-none focus:border-sand"
            >
              {STATUSES.map((st) => (
                <option key={st} value={st}>
                  {LEAD_STATUS_LABEL[st]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[12px] text-faint">
            Follow-up date
            <input
              type="date"
              value={followUpDay(l)}
              onChange={(e) => {
                const v = e.target.value;
                const d = v ? fromKey(v) : null;
                d?.setHours(10, 0, 0, 0);
                actions.updateLead(l.id, { nextAt: d ? d.toISOString() : undefined });
              }}
              aria-label={`Follow-up date for ${l.business}`}
              className="num h-9 rounded-[8px] border border-control bg-raised px-2 text-[13px] text-text outline-none focus:border-sand"
            />
          </label>
        </div>
        <label className="grid gap-1 text-[12px] text-faint">
          Notes
          <textarea
            value={note}
            onChange={(e) => onNote(e.target.value)}
            aria-label={`Notes for ${l.business}`}
            placeholder="Who answered, which project or floor plan to use for the sample, their price reaction…"
            className="min-h-24 resize-y rounded-[8px] border border-control bg-raised px-2.5 py-2 text-[13px] leading-[19px] text-text outline-none focus:border-sand"
          />
          <span className="min-h-4 text-[12px]" aria-live="polite">
            {saved}
          </span>
        </label>
        {!!l.log?.length && (
          <div>
            <h3 className="mb-1.5 text-[12px] text-faint">Call history</h3>
            <ul className="grid gap-1">
              {l.log.slice(0, 8).map((e, i) => (
                <li key={i} className="grid grid-cols-[84px_1fr] text-[13px]">
                  <time className="num text-faint" dateTime={e.d}>
                    {shortDate(fromKey(e.d))}
                  </time>
                  <span>{LEAD_STATUS_LABEL[e.s]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          onClick={() => removeWithUndo("leads", l.id, l.business, actions.removeLead)}
          className="press inline-flex h-8 items-center gap-1.5 self-start justify-self-start rounded-full px-2 text-[12px] text-faint hover:bg-raised hover:text-text"
        >
          <Trash2 size={13} /> Delete this agent
        </button>
      </div>
    </div>
  );
}

function LinkButton({ href, onClick, icon, children }: { href?: string; onClick?: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  const cls = "press inline-flex h-8 items-center gap-1.5 rounded-full border border-control px-3 text-[13px] text-muted hover:border-sand hover:text-text";
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {icon}
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {icon}
      {children}
    </button>
  );
}
