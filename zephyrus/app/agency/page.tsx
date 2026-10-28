"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Phone, Search, Trash2 } from "lucide-react";
import { actions, useAppState } from "@/lib/store";
import { countCalls, lastNDays, monthStart } from "@/lib/derive";
import type { Lead, LeadStatus, Niche, Outcome } from "@/lib/types";
import { LEAD_STATUS_LABEL, NICHE_LABEL, OUTCOME_LABEL } from "@/lib/types";
import { addDays, dayKey, fromKey, relDay, shortDate, useNow, weekday } from "@/lib/time";
import { cn, fmt } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { KpiStrip } from "@/components/ui/kpi-strip";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { Bars } from "@/components/charts/bars";
import { Waves } from "@/components/charts/waves";
import { Forecast } from "@/components/charts/forecast";
import { CountUp } from "@/components/ui/count-up";
import { notify, removeWithUndo } from "@/components/ui/notify";
import { OutcomeButtons } from "@/components/ui/outcome-buttons";
import { Editable } from "@/components/ui/editable";

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16];
const STATUS_ORDER: LeadStatus[] = ["callback", "interested", "demo", "new", "won", "lost"];

const pill: Record<LeadStatus, string> = {
  new: "bg-raised text-muted",
  callback: "bg-ember-tint text-ember-soft",
  interested: "bg-[#2a2016] text-[#e8c49a]",
  demo: "bg-[#2a2016] text-[#e8c49a]",
  won: "bg-positive-bg text-positive",
  lost: "bg-raised text-faint",
};

export default function AgencyPage() {
  return (
    <Suspense>
      <Agency />
    </Suspense>
  );
}

function Agency() {
  const s = useAppState()!;
  const now = useNow();
  const params = useSearchParams();
  const today = dayKey(now);
  const target = s.settings.dialTarget;
  const deal = s.settings.dealValue;

  const [niche, setNiche] = useState<Niche>("realestate");
  const [leadId, setLeadId] = useState<string>("");
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [nicheFilter, setNicheFilter] = useState<Niche | "all">("all");
  const [q, setQ] = useState("");
  const focus = params.get("lead");

  useEffect(() => {
    if (!focus) return;
    const t = setTimeout(() => {
      const row = [document.getElementById(`lead-${focus}`), document.getElementById(`lead-m-${focus}`)].find((el) => el && el.offsetParent !== null);
      row?.scrollIntoView({ block: "center" });
    }, 50);
    return () => clearTimeout(t);
  }, [focus]);

  const t = countCalls(s.calls, today, today);
  const week = countCalls(s.calls, addDays(today, -6), today);
  const month = countCalls(s.calls, monthStart(today), today);
  const prevWeek = countCalls(s.calls, addDays(today, -13), addDays(today, -7));
  const reach = week.dials ? week.reached / week.dials : 0;
  const prevReach = prevWeek.dials ? prevWeek.reached / prevWeek.dials : 0;
  const reachDiff = (reach - prevReach) * 100;

  const [waveNiche, setWaveNiche] = useState<Niche | "all">("all");
  const waves = useMemo(() => {
    const above = [0, 1, 2].map(() => HOURS.map(() => 0));
    const below = [0, 1, 2].map(() => HOURS.map(() => 0));
    for (const e of s.calls) {
      if (waveNiche !== "all" && e.niche !== waveNiche) continue;
      const d = dayKey(new Date(e.at));
      const back = Math.round((fromKey(today).getTime() - fromKey(d).getTime()) / 86_400_000);
      const k = Math.floor(back / 7);
      const hi = HOURS.indexOf(new Date(e.at).getHours());
      if (k > 2 || hi < 0) continue;
      above[k][hi]++;
      if (e.outcome !== "noanswer") below[k][hi]++;
    }
    return { above, below };
  }, [s.calls, waveNiche, today]);
  const bestHour = (() => {
    let best: { h: number; rate: number } | null = null;
    HOURS.forEach((h, i) => {
      const a = waves.above[0][i];
      if (a < 8) return;
      const rate = waves.below[0][i] / a;
      if (!best || rate > best.rate) best = { h, rate };
    });
    return best as { h: number; rate: number } | null;
  })();

  const forecast = useMemo(() => {
    const first = fromKey(monthStart(today));
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const t = fromKey(today).getDate() - 1;
    let run = 0;
    const pts = Array.from({ length: last }, (_, i) => {
      const d = dayKey(new Date(first.getFullYear(), first.getMonth(), i + 1));
      if (i <= t) run += countCalls(s.calls, d, d).won * deal;
      return { label: shortDate(fromKey(d)), value: run };
    });
    const sofar = pts[t].value;
    const pace = sofar / (t + 1);
    for (let i = t + 1; i < last; i++) pts[i].value = Math.round(sofar + pace * (i - t));
    const end = pts[last - 1].value;
    return { points: pts, t, end, deals: deal ? end / deal : 0 };
  }, [s.calls, today, deal]);

  const days = lastNDays(today, 14);
  const bars = days.map((d) => ({ label: d === today ? "Today" : weekday(fromKey(d)).slice(0, 2), sub: relDay(fromKey(d).setHours(12), now).replace(/ \d\d:\d\d$/, ""), value: countCalls(s.calls, d, d).dials }));

  const byNiche = (["realestate", "detailing"] as Niche[]).map((n) => ({ n, c: countCalls(s.calls, addDays(today, -29), today, n) }));

  const leads = useMemo(() => {
    const term = q.trim().toLowerCase();
    return s.leads
      .filter((l) => filter === "all" || l.status === filter)
      .filter((l) => nicheFilter === "all" || l.niche === nicheFilter)
      .filter((l) => !term || `${l.business} ${l.contact} ${l.city} ${l.note}`.toLowerCase().includes(term))
      .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || (a.nextAt ?? "z").localeCompare(b.nextAt ?? "z"));
  }, [s.leads, filter, nicheFilter, q]);
  const counts = Object.fromEntries(STATUS_ORDER.map((st) => [st, s.leads.filter((l) => l.status === st && (nicheFilter === "all" || l.niche === nicheFilter)).length]));

  const log = (o: Outcome) => {
    const lead = s.leads.find((l) => l.id === leadId);
    const n = lead?.niche ?? niche;
    const id = actions.logCall({ niche: n, outcome: o, leadId: lead?.id });
    notify(`Logged: ${OUTCOME_LABEL[o]}`, { detail: lead ? lead.business : `Cold call · ${NICHE_LABEL[n].toLowerCase()}`, undo: () => actions.undoCall(id, lead) });
  };
  const byOutcome = { noanswer: 0, talked: 0, interested: 0, demo: 0, won: 0 } as Record<Outcome, number>;
  for (const e of s.calls) if (dayKey(new Date(e.at)) === today) byOutcome[e.outcome]++;

  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        title="Agency"
        line={
          <>
            {month.won} {month.won === 1 ? "client" : "clients"} closed this month, {fmt(month.won * deal)} CAD · {week.demos} demo{week.demos === 1 ? "" : "s"} booked in the last 7 days
          </>
        }
      />

      <KpiStrip
        items={[
          { label: "Dials today", value: <><CountUp value={t.dials} /><span className="text-[16px] text-faint"> / {target}</span></>, sub: t.dials >= target ? "Target hit" : `${target - t.dials} to go`, tone: t.dials >= target ? "positive" : "neutral" },
          { label: "Reach rate, 7 days", value: `${(reach * 100).toFixed(1)}%`, sub: prevWeek.dials ? `${reachDiff >= 0 ? "+" : "−"}${Math.abs(reachDiff).toFixed(1)} pts vs the week before` : "—", tone: reachDiff > 0.05 ? "positive" : reachDiff < -0.05 ? "negative" : "neutral" },
          { label: "Demos, 7 days", value: fmt(week.demos), sub: `${prevWeek.demos} the week before` },
          { label: "Closed this month", value: `${fmt(month.won * deal)} CAD`, sub: `${month.won} × ${deal} CAD` },
        ]}
      />

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel framed title="Dials per day" aside={<span>last 14 days</span>}>
          <Bars data={bars} highlight={bars.length - 1} reference={{ value: target, label: `Target ${target}` }} unit="Dials" format={(n) => fmt(n)} height="fill" ariaLabel="Dials per day, last 14 days" />
          <div className="relative mt-4 -mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[480px] border-collapse text-[13px]">
            <thead>
              <tr className="text-[12px] text-faint">
                <th className="pb-2 text-left font-normal">Last 30 days</th>
                <th className="pb-2 text-right font-normal">Dials</th>
                <th className="pb-2 text-right font-normal">Reached</th>
                <th className="pb-2 text-right font-normal">Interested</th>
                <th className="pb-2 text-right font-normal">Demos</th>
                <th className="pb-2 text-right font-normal">Closed</th>
              </tr>
            </thead>
            <tbody>
              {byNiche.map(({ n, c }) => (
                <tr key={n} className="border-t border-rule">
                  <td className="py-2.5">{NICHE_LABEL[n]}</td>
                  <td className="num py-2.5 text-right">{fmt(c.dials)}</td>
                  <td className="num py-2.5 text-right">
                    {fmt(c.reached)} <span className="text-faint">{c.dials ? Math.round((c.reached / c.dials) * 100) : 0}%</span>
                  </td>
                  <td className="num py-2.5 text-right">{fmt(c.interested)}</td>
                  <td className="num py-2.5 text-right">{fmt(c.demos)}</td>
                  <td className="num py-2.5 text-right">{fmt(c.won)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Panel>

        <Panel id="log" framed title="Log a dial" className="scroll-mt-20" aside={<span className="num">{t.dials} today</span>}>
          <div className="grid gap-3">
            <label className="grid gap-1 text-[12px] text-faint">
              Who did you call?
              <select
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                className="h-9 rounded-[10px] border border-control bg-raised px-2.5 text-[14px] text-text outline-none focus:border-sand"
              >
                <option value="">Cold list (no lead yet)</option>
                {s.leads
                  .filter((l) => l.status !== "won" && l.status !== "lost")
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.business} · {l.contact}
                    </option>
                  ))}
              </select>
            </label>
            {!leadId && (
              <Segmented
                label="Niche"
                value={niche}
                onChange={setNiche}
                className="justify-self-start"
                items={[
                  { value: "realestate", label: "Real estate" },
                  { value: "detailing", label: "Car detailing" },
                ]}
              />
            )}
            <OutcomeButtons counts={byOutcome} onLog={log} size="lg" />
            <p className="text-[12px] text-faint">Picking a lead updates its status: Interested, Demo booked or Client. Numbers are today's count.</p>
          </div>
          <h3 className="mt-4 mb-1 text-[13px] text-muted">Latest dials</h3>
          <ul className="divide-y divide-rule">
            {[...s.calls]
              .reverse()
              .slice(0, 5)
              .map((c) => {
                const lead = c.leadId ? s.leads.find((l) => l.id === c.leadId) : undefined;
                return (
                  <li key={c.id} className="flex h-10 items-center gap-3 text-[13px]">
                    <span className="num w-[124px] shrink-0 whitespace-nowrap text-faint">{relDay(c.at, now)}</span>
                    <span className="min-w-0 flex-1 truncate">{lead ? lead.business : `Cold call · ${NICHE_LABEL[c.niche].toLowerCase()}`}</span>
                    <span className={cn("shrink-0", c.outcome === "won" ? "text-positive" : c.outcome === "noanswer" ? "text-faint" : "text-muted")}>{OUTCOME_LABEL[c.outcome]}</span>
                  </li>
                );
              })}
          </ul>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel
          framed
          title="When people pick up"
          aside={
            <Segmented
              label="Niche"
              value={waveNiche}
              onChange={setWaveNiche}
              items={[
                { value: "all", label: "Both" },
                { value: "realestate", label: "Real estate" },
                { value: "detailing", label: "Detailing" },
              ]}
            />
          }
        >
          <p className="mb-1 text-[13px] text-muted">
            {bestHour !== null ? (
              <>
                Best hour this week: <span className="num text-text">{String(bestHour.h).padStart(2, "0")}:00</span>, {Math.round(bestHour.rate * 100)}% picked up
              </>
            ) : (
              "Not enough dials this week to call a best hour yet."
            )}
          </p>
          <Waves hours={HOURS} above={waves.above} below={waves.below} labels={{ above: "Dials", below: "Reached", current: "last 7 days" }} />
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-faint">
            <span className="inline-flex items-center gap-1.5">
              <i className="h-0.5 w-3.5 rounded-sm bg-sand" /> Dials, above the line
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="h-0.5 w-3.5 rounded-sm bg-ember" /> Reached, below (own scale)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="h-0.5 w-3.5 rounded-sm bg-faint/50" /> The two weeks before
            </span>
          </div>
        </Panel>

        <Panel framed title="Closed this month" aside={<span className="num">{month.won} deals · {fmt(month.won * deal)} CAD</span>}>
          <Forecast points={forecast.points} todayIndex={forecast.t} format={(n) => `${fmt(n)} CAD`} height="fill" ariaLabel="Closed value this month, with the current pace carried to month end" />
          <p className="mt-3 text-[13px] text-muted">
            {month.won ? (
              <>
                At this pace: about <span className="num text-text">{forecast.deals.toFixed(1)} deals</span>, <span className="num text-text">{fmt(forecast.end)} CAD</span> by {forecast.points.at(-1)!.label}.
              </>
            ) : (
              "No deals closed this month yet. The line starts with your first one."
            )}
          </p>
        </Panel>
      </div>

      <Panel
        className="mt-5"
        title="Leads"
        aside={
          <label className="flex h-8 items-center gap-2 rounded-full border border-border bg-raised px-3">
            <Search size={14} className="text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search leads" aria-label="Search leads" className="w-[150px] bg-transparent text-[13px] text-text outline-none" />
          </label>
        }
      >
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <FilterChip on={filter === "all"} onClick={() => setFilter("all")}>
            All <span className="num text-faint">{s.leads.filter((l) => nicheFilter === "all" || l.niche === nicheFilter).length}</span>
          </FilterChip>
          {STATUS_ORDER.map((st) => (
            <FilterChip key={st} on={filter === st} onClick={() => setFilter(st)}>
              {LEAD_STATUS_LABEL[st]} <span className="num text-faint">{counts[st]}</span>
            </FilterChip>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
          <Segmented
            label="Niche"
            value={nicheFilter}
            onChange={setNicheFilter}
            items={[
              { value: "all", label: "Both" },
              { value: "realestate", label: "Real estate" },
              { value: "detailing", label: "Detailing" },
            ]}
          />
        </div>
        {/* On a phone each lead is a two-line row: who, then status, next call and the call button. */}
        <ul className="divide-y divide-rule md:hidden">
          {leads.map((l) => {
            const overdue = !!l.nextAt && new Date(l.nextAt).getTime() < now && (l.status === "callback" || l.status === "interested");
            return (
              <li key={l.id} id={`lead-m-${l.id}`} className={cn("py-3", focus === l.id && "-mx-2 rounded-[12px] bg-raised px-2")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[14px]">
                      <Editable value={l.business} label="Business" onSave={(v) => actions.updateLead(l.id, { business: v })} />
                    </div>
                    <div className="truncate text-[12px] text-faint">
                      <Editable value={l.contact} label="Contact" placeholder="Add contact" onSave={(v) => actions.updateLead(l.id, { contact: v })} allowEmpty /> · {NICHE_LABEL[l.niche]} ·{" "}
                      <Editable value={l.city} label="City" placeholder="Add city" onSave={(v) => actions.updateLead(l.id, { city: v })} allowEmpty />
                    </div>
                    <div className="num text-[12px] text-muted">
                      <Editable value={l.phone} label="Phone" placeholder="Add phone" onSave={(v) => actions.updateLead(l.id, { phone: v })} allowEmpty />
                    </div>
                  </div>
                  <a href={`tel:${l.phone.replace(/\s/g, "")}`} className="press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-control px-3 text-[13px]">
                    <Phone size={13} /> Call
                  </a>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <select
                    value={l.status}
                    onChange={(e) => actions.updateLead(l.id, { status: e.target.value as LeadStatus })}
                    aria-label={`Status for ${l.business}`}
                    className={cn("h-8 appearance-none rounded-full border-0 px-3 text-[12px] outline-none", pill[l.status])}
                  >
                    {STATUS_ORDER.map((st) => (
                      <option key={st} value={st} className="bg-raised text-text">
                        {LEAD_STATUS_LABEL[st]}
                      </option>
                    ))}
                  </select>
                  <span className={cn("num text-[12px]", overdue ? "text-ember-soft" : "text-muted")}>{l.nextAt ? relDay(l.nextAt, now) : ""}</span>
                </div>
                {l.note && <p className="mt-1.5 text-[13px] text-muted">{l.note}</p>}
              </li>
            );
          })}
          {leads.length === 0 && <li className="py-6 text-center text-[13px] text-faint">No leads match. Add one with Quick add.</li>}
        </ul>
        <div className="relative -mx-2 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[860px] border-collapse text-[13px]">
            <thead>
              <tr className="text-[12px] text-faint">
                <th className="w-[26%] pb-2 pl-2 text-left font-normal">Business</th>
                <th className="pb-2 text-left font-normal">Niche</th>
                <th className="pb-2 text-left font-normal">Status</th>
                <th className="pb-2 text-left font-normal">Next</th>
                <th className="w-[28%] pb-2 text-left font-normal">Note</th>
                <th className="pr-2 pb-2 text-right font-normal">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <LeadRow key={l.id} l={l} now={now} focused={focus === l.id} />
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-6 text-center text-[13px] text-faint">
                    No leads match. Add one with Quick add (N).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function FilterChip({ on, className, ...rest }: { on: boolean } & React.ComponentProps<"button">) {
  return (
    <button
      aria-pressed={on}
      className={cn("press inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px]", on ? "bg-active text-text" : "text-muted hover:bg-raised hover:text-text", className)}
      {...rest}
    />
  );
}

function LeadRow({ l, now, focused }: { l: Lead; now: number; focused: boolean }) {
  const overdue = !!l.nextAt && new Date(l.nextAt).getTime() < now && (l.status === "callback" || l.status === "interested");
  const local = l.nextAt ? toLocalInput(l.nextAt) : "";
  return (
    <tr id={`lead-${l.id}`} className={cn("group border-t border-rule align-middle", focused && "bg-raised")}>
      <td className="max-w-0 py-2.5 pl-2">
        <div className="truncate">
          <Editable value={l.business} label="Business" onSave={(v) => actions.updateLead(l.id, { business: v })} />
        </div>
        <div className="truncate text-[12px] text-faint">
          <Editable value={l.contact} label="Contact" placeholder="Add contact" onSave={(v) => actions.updateLead(l.id, { contact: v })} allowEmpty /> ·{" "}
          <Editable value={l.city} label="City" placeholder="Add city" onSave={(v) => actions.updateLead(l.id, { city: v })} allowEmpty /> ·{" "}
          <span className="num">
            <Editable value={l.phone} label="Phone" placeholder="Add phone" onSave={(v) => actions.updateLead(l.id, { phone: v })} allowEmpty />
          </span>
        </div>
      </td>
      <td className="py-2.5 whitespace-nowrap text-muted">
        <select
          value={l.niche}
          onChange={(e) => actions.updateLead(l.id, { niche: e.target.value as Niche })}
          aria-label={`Niche for ${l.business}`}
          className="-mx-1 cursor-pointer appearance-none rounded-[6px] bg-transparent px-1 text-inherit outline-none hover:bg-raised"
        >
          {(Object.keys(NICHE_LABEL) as Niche[]).map((n) => (
            <option key={n} value={n} className="bg-raised text-text">
              {NICHE_LABEL[n]}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2.5">
        <select
          value={l.status}
          onChange={(e) => actions.updateLead(l.id, { status: e.target.value as LeadStatus })}
          aria-label={`Status for ${l.business}`}
          className={cn("h-7 cursor-pointer appearance-none rounded-full border-0 px-2.5 text-[12px] outline-none", pill[l.status])}
        >
          {STATUS_ORDER.map((st) => (
            <option key={st} value={st} className="bg-raised text-text">
              {LEAD_STATUS_LABEL[st]}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2.5 whitespace-nowrap">
        <label className={cn("num relative inline-flex h-7 items-center rounded-[8px] px-1.5 text-[12px] hover:bg-raised", overdue ? "text-ember-soft" : l.nextAt ? "text-muted" : "text-faint")}>
          {l.nextAt ? relDay(l.nextAt, now) : "—"}
          <input
            type="datetime-local"
            value={local}
            onChange={(e) => actions.updateLead(l.id, { nextAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
            aria-label={`Next call for ${l.business}`}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </td>
      <td className="max-w-0 py-2.5">
        <input
          defaultValue={l.note}
          onBlur={(e) => e.target.value !== l.note && actions.updateLead(l.id, { note: e.target.value })}
          placeholder="Add a note"
          aria-label={`Note for ${l.business}`}
          className="h-7 w-full truncate rounded-[8px] bg-transparent px-1.5 text-[13px] text-muted outline-none hover:bg-raised focus:bg-raised focus:text-text"
        />
      </td>
      <td className="py-2.5 pr-2">
        <div className="flex items-center justify-end gap-1">
          <a href={`tel:${l.phone.replace(/\s/g, "")}`} className="press inline-flex h-7 items-center gap-1.5 rounded-full border border-control px-2.5 text-[12px] hover:border-sand">
            <Phone size={12} /> Call
          </a>
          <button
            onClick={() => removeWithUndo("leads", l.id, l.business, actions.removeLead)}
            aria-label={`Delete ${l.business}`}
            className="press grid size-7 place-items-center rounded-full text-faint opacity-0 group-hover:opacity-100 hover:bg-raised hover:text-text focus-visible:opacity-100"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
