"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { actions, useAppState } from "@/lib/store";
import { countCalls, lastNDays, monthStart } from "@/lib/derive";
import type { LeadStatus, Niche, Outcome } from "@/lib/types";
import { NICHE_LABEL, OUTCOME_LABEL, reached } from "@/lib/types";
import { CallQueue } from "@/components/agency/call-queue";
import { addDays, dayKey, fromKey, relDay, shortDate, useNow, weekday } from "@/lib/time";
import { cn, fmt } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Ticks, TickGauge } from "@/components/ui/ticks";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { Bars } from "@/components/charts/bars";
import { Waves } from "@/components/charts/waves";
import { Forecast } from "@/components/charts/forecast";
import { notify } from "@/components/ui/notify";
import { OutcomeButtons } from "@/components/ui/outcome-buttons";

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16];
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
  const focus = params.get("lead");


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
      if (reached(e.outcome)) below[k][hi]++;
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

  const pipeline = useMemo(() => {
    const count = (...st: LeadStatus[]) => s.leads.filter((l) => st.includes(l.status)).length;
    const parts = [
      { label: "Following up", value: count("noanswer", "voicemail", "callback"), color: "#ff6a1a" },
      { label: "Sample, interested or demo", value: count("sample", "interested", "demo"), color: "#f2b183" },
      { label: "Won", value: count("won"), color: "#4fd39e" },
      { label: "To call", value: count("new"), color: "rgb(255 255 255 / .38)" },
    ];
    return { parts, total: parts.reduce((a, p) => a + p.value, 0), inPlay: count("callback", "sample", "interested", "demo") };
  }, [s.leads]);

  const days = lastNDays(today, 14);
  const bars = days.map((d) => ({ label: d === today ? "Today" : weekday(fromKey(d)).slice(0, 2), sub: relDay(fromKey(d).setHours(12), now).replace(/ \d\d:\d\d$/, ""), value: countCalls(s.calls, d, d).dials }));

  const byNiche = (["realestate", "detailing"] as Niche[]).map((n) => ({ n, c: countCalls(s.calls, addDays(today, -29), today, n) }));

  const log = (o: Outcome) => {
    const lead = s.leads.find((l) => l.id === leadId);
    const n = lead?.niche ?? niche;
    const id = actions.logCall({ niche: n, outcome: o, leadId: lead?.id });
    notify(`Logged: ${OUTCOME_LABEL[o]}`, { detail: lead ? lead.business : `Cold call · ${NICHE_LABEL[n].toLowerCase()}`, undo: () => actions.undoCall(id, lead) });
  };
  const byOutcome = { noanswer: 0, voicemail: 0, talked: 0, interested: 0, demo: 0, won: 0 } as Record<Outcome, number>;
  for (const e of s.calls) if (dayKey(new Date(e.at)) === today) byOutcome[e.outcome]++;

  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        photo="agency"
        title="Agency"
        line={
          <>
            {month.won} {month.won === 1 ? "client" : "clients"} closed this month, {fmt(month.won * deal)} CAD · {week.demos} demo{week.demos === 1 ? "" : "s"} booked in the last 7 days
          </>
        }
      />

      {/* The Finance Bento grid: a wide chart beside a gauge, a row of tiles, then the working cards. */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel tone="graphite" index={0} className="min-h-[360px] xl:col-span-8" title="Dials per day" aside={<span>last 14 days</span>}>
          <Bars data={bars} highlight={bars.length - 1} reference={{ value: target, label: `Target ${target}` }} unit="Dials" format={(n) => fmt(n)} height="fill" ariaLabel="Dials per day, last 14 days" />
        </Panel>

        <Panel tone="dune" index={1} className="xl:col-span-4" title="Pipeline" aside={<span className="num">{s.leads.length} leads</span>}>
          <div className="flex justify-center pt-2">
            <TickGauge parts={pipeline.parts} value={String(pipeline.inPlay)} caption="leads in play" />
          </div>
          <ul className="mt-auto divide-y divide-rule pt-2">
            {pipeline.parts.map((p) => (
              <li key={p.label} className="flex h-8 items-center gap-2.5 text-[13px]">
                <i className="size-2 rounded-full" style={{ background: p.color }} />
                <span className="flex-1">{p.label}</span>
                <span className="num w-10 text-right text-faint">{Math.round((p.value / Math.max(1, pipeline.total)) * 100)}%</span>
                <span className="num w-6 text-right">{p.value}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:col-span-12 xl:grid-cols-4">
          <Tile tone="solid" index={2} label="Closed this month" value={`${fmt(month.won * deal)}`} unit="CAD" sub={month.won ? `${month.won} × ${deal} CAD, of ~${fmt(forecast.end)} at this pace` : "No deals yet this month"}>
            <Ticks ratio={forecast.end ? (month.won * deal) / forecast.end : 0} lit="#fff" off="rgb(0 0 0 / .25)" label="Closed so far against this month's pace" delay={200} />
          </Tile>
          <Tile tone="glass" index={3} label="Dials today" value={fmt(t.dials)} unit={`/ ${target}`} sub={t.dials >= target ? "Target hit" : `${target - t.dials} to go`} subTone={t.dials >= target ? "positive" : undefined}>
            <Ticks ratio={t.dials / target} label="Dials against target" delay={260} />
          </Tile>
          <Tile
            tone="glass"
            index={4}
            label="Reach rate, 7 days"
            value={(reach * 100).toFixed(1)}
            unit="%"
            sub={prevWeek.dials ? `${reachDiff >= 0 ? "+" : "−"}${Math.abs(reachDiff).toFixed(1)} pts vs the week before` : "—"}
            subTone={reachDiff > 0.05 ? "positive" : reachDiff < -0.05 ? "negative" : undefined}
          >
            <Ticks ratio={reach} label="Share of dials that reached someone" delay={320} />
          </Tile>
          <Tile tone="glass" index={5} label="Demos, 7 days" value={fmt(week.demos)} sub={`${prevWeek.demos} the week before`}>
            <Ticks ratio={Math.min(1, week.demos / Math.max(1, week.demos, prevWeek.demos, 5))} label="Demos this week against the best recent week" delay={380} />
          </Tile>
        </div>

        <Panel id="log" tone="glass" index={6} title="Log a dial" className="scroll-mt-20 xl:col-span-5" aside={<span className="num">{t.dials} today</span>}>
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
            <p className="text-[12px] text-faint">Picking a lead updates its status and call history. Numbers are today's count.</p>
          </div>
          <h3 className="mt-4 mb-1 text-[13px] text-muted">Latest dials</h3>
          {s.calls.length === 0 && <p className="rounded-[10px] border border-dashed border-border px-3 py-2.5 text-[13px] text-faint">No dials yet. Tap an outcome above after each call.</p>}
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

        <Panel
          tone="graphite"
          index={7}
          className="xl:col-span-7"
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
          <Waves hours={HOURS} above={waves.above} below={waves.below} labels={{ above: "Dials", below: "Reached", current: "last 7 days" }} height={410} />
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

        <Panel tone="copper" index={8} className="xl:col-span-7" title="Closed this month" aside={<span className="num">{month.won} deals · {fmt(month.won * deal)} CAD</span>}>
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

        <Panel tone="glass" index={9} className="xl:col-span-5" title="By niche" aside={<span>last 30 days</span>}>
          <ul className="flex flex-1 flex-col justify-around gap-5">
            {byNiche.map(({ n, c }, k) => {
              const rate = c.dials ? c.reached / c.dials : 0;
              return (
                <li key={n}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[14px]">{NICHE_LABEL[n]}</span>
                    <span className="num text-[13px] text-muted">
                      {fmt(c.dials)} dials · <span className="text-text">{Math.round(rate * 100)}%</span> reached
                    </span>
                  </div>
                  <div className="mt-2">
                    <Ticks ratio={rate} n={40} label={`${NICHE_LABEL[n]}: share of dials that reached someone`} delay={300 + k * 120} />
                  </div>
                  <dl className="mt-2.5 grid grid-cols-4 gap-2 text-[12px]">
                    {(
                      [
                        ["Reached", c.reached],
                        ["Interested", c.interested],
                        ["Demos", c.demos],
                        ["Closed", c.won],
                      ] as const
                    ).map(([l, v]) => (
                      <div key={l}>
                        <dt className="text-faint">{l}</dt>
                        <dd className="num mt-0.5 text-[15px]">{fmt(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <CallQueue state={s} now={now} focus={focus} />
    </div>
  );
}

/** A Finance Bento KPI tile: a quiet label, one large thin figure, and its progress as ticks. */
function Tile({
  tone,
  index,
  label,
  value,
  unit,
  sub,
  subTone,
  children,
}: {
  tone: "solid" | "glass";
  index: number;
  label: string;
  value: string;
  unit?: string;
  sub: string;
  subTone?: "positive" | "negative";
  children?: React.ReactNode;
}) {
  return (
    <Panel tone={tone} index={index} className="min-h-[168px]" bodyClassName="justify-between gap-3">
      <span className="text-[13px] text-muted">{label}</span>
      <div className="num font-display text-[40px] leading-none font-light tracking-[-0.04em]">
        {value}
        {unit && <span className="ml-1.5 text-[16px] font-normal tracking-normal text-faint">{unit}</span>}
      </div>
      <div>
        {children}
        <span className={cn("num mt-1.5 block text-[12px]", subTone === "positive" ? "text-positive" : subTone === "negative" ? "text-negative" : "text-faint")}>{sub}</span>
      </div>
    </Panel>
  );
}
