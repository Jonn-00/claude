"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { actions, useAppState, useStats } from "@/lib/store";
import { sumDays, viewsIn } from "@/lib/stats";
import type { ChannelId, DayStat } from "@/lib/types";
import { stageLabel } from "@/lib/stages";
import { videoUrgency } from "@/lib/derive";
import { fromKey, relDay, shortDate, useNow } from "@/lib/time";
import { TONE } from "@/lib/tones";
import { cn, compact, fmt } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { KpiStrip } from "@/components/ui/kpi-strip";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { LineChart } from "@/components/charts/line-chart";
import { Treemap } from "@/components/charts/treemap";
import { Radar } from "@/components/charts/radar";
import { Editable } from "@/components/ui/editable";
import { ProductionLine } from "@/components/today/production-line";
import { field } from "@/components/shell/quick-add";

type Range = "7" | "28" | "90";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
type Metric = "views" | "subs" | "watchHours" | "revenue";
const METRIC: Record<Metric, { label: string; unit: string; fmt: (n: number) => string }> = {
  views: { label: "Views", unit: "Views", fmt: (n) => fmt(n) },
  subs: { label: "Subscribers", unit: "New subscribers", fmt: (n) => "+" + fmt(n) },
  watchHours: { label: "Watch time", unit: "Watch hours", fmt: (n) => fmt(n) + " h" },
  revenue: { label: "Revenue", unit: "Est. revenue", fmt: (n) => "$" + fmt(n, 2) },
};

const change = (cur: number, prev: number) => {
  if (!prev) return { text: cur ? "new" : "—", tone: "neutral" as const };
  const c = (cur - prev) / prev;
  return {
    text: `${c > 0 ? "+" : c < 0 ? "−" : ""}${Math.abs(c * 100).toFixed(1)}% vs prior period`,
    tone: c > 0.005 ? ("positive" as const) : c < -0.005 ? ("negative" as const) : ("neutral" as const),
  };
};

export default function ChannelsPage() {
  const s = useAppState()!;
  const stats = useStats(s);
  const now = useNow();
  const [sel, setSel] = useState<ChannelId>("c1");
  const [range, setRange] = useState<Range>("28");
  const [metric, setMetric] = useState<Metric>("views");
  const n = Number(range);

  const st = stats.find((x) => x.channelId === sel)!;
  const channel = s.channels.find((c) => c.id === sel)!;
  const cur = st.days.slice(-n);
  const prev = st.days.slice(-2 * n, -n);
  const from = cur[0].date;
  const to = cur[cur.length - 1].date;

  // The finding: which channel earns out of proportion to its views.
  const shares = useMemo(() => {
    const rows = stats.map((x) => ({ id: x.channelId, views: sumDays(x.days.slice(-28), "views"), revenue: sumDays(x.days.slice(-28), "revenue") }));
    const tv = rows.reduce((a, r) => a + r.views, 0) || 1;
    const tr = rows.reduce((a, r) => a + r.revenue, 0) || 1;
    return rows.map((r) => ({ ...r, vShare: r.views / tv, rShare: r.revenue / tr })).sort((a, b) => b.rShare - b.vShare - (a.rShare - a.vShare));
  }, [stats]);
  const top = shares[0];
  const topName = s.channels.find((c) => c.id === top.id)?.name;
  // When no channel earns out of proportion, say who carries the views instead.
  const lead = [...shares].sort((a, b) => b.views - a.views)[0];
  const leadName = s.channels.find((c) => c.id === lead.id)?.name;
  const skewed = top.rShare - top.vShare >= 0.02;

  const kpis = (["views", "watchHours", "subs", "revenue"] as Metric[]).map((m) => {
    const a = sumDays(cur, m);
    const b = sumDays(prev, m);
    const ch = change(a, b);
    const subsTotal = st.youtube?.subscribers ?? channel.real?.subscribers;
    const total = m === "subs" && subsTotal !== undefined ? `${fmt(subsTotal)} total · ` : "";
    return { label: METRIC[m].unit + (m === "revenue" ? " (USD)" : ""), value: METRIC[m].fmt(a), sub: total + ch.text, tone: ch.tone };
  });

  const points = cur.map((d: DayStat) => ({ key: d.date, label: shortDate(fromKey(d.date)), value: d[metric] }));
  const marks = st.videos
    .filter((v) => v.publishedOn >= from)
    .map((v) => ({ index: cur.findIndex((d) => d.date === v.publishedOn), label: v.title }))
    .filter((m) => m.index >= 0);

  // Treemap: every video's views in the window, plus each channel's back catalogue, so tiles sum to total views.
  const tiles = stats.flatMap((x) => {
    const total = sumDays(x.days.filter((d) => d.date >= from && d.date <= to), "views");
    const vids = x.videos.map((v) => ({ id: v.id, name: v.title, group: x.channelId, value: viewsIn(v, from, to) })).filter((v) => v.value > 0);
    const fromVids = vids.reduce((a, v) => a + v.value, 0);
    return [...vids, { id: x.channelId + "-old", name: "Older videos", group: x.channelId, value: total - fromVids }];
  });
  const groups = s.channels.map((c) => ({ id: c.id, name: c.name, color: TONE[c.id].bg, ink: TONE[c.id].ink }));

  const recent = [...st.videos].reverse().slice(0, st.youtube ? 8 : 7);
  // Average views per weekday over the last 12 weeks.
  const byWeekday = useMemo(() => {
    const sums = [0, 0, 0, 0, 0, 0, 0];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const d of st.days.slice(-84)) {
      const i = (new Date(d.date + "T12:00:00").getDay() + 6) % 7;
      sums[i] += d.views;
      counts[i]++;
    }
    return sums.map((x, i) => Math.round(x / (counts[i] || 1)));
  }, [st]);
  const upcoming = s.videos.filter((v) => v.channelId === sel && v.stage !== "live").sort((a, b) => a.publishAt.localeCompare(b.publishAt));

  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        photo="channels"
        title="Channels"
        line={
          skewed
            ? `${topName} brings in ${Math.round(top.rShare * 100)}% of revenue from ${Math.round(top.vShare * 100)}% of views, last 28 days`
            : `${leadName} has ${Math.round(lead.vShare * 100)}% of your views across all four channels, last 28 days`
        }
      />

      <div role="tablist" aria-label="Channel" className="mb-4 flex gap-1 overflow-x-auto pb-1">
        {s.channels.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={c.id === sel}
            onClick={() => {
              setSel(c.id);
            }}
            className={cn("press flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[14px]", c.id === sel ? "bg-raised text-text" : "text-muted hover:bg-raised/50 hover:text-text")}
          >
            <i className="size-2 rounded-full" style={{ background: TONE[c.id].bg }} />
            {c.name}
          </button>
        ))}
      </div>

      <KpiStrip items={kpis} className="tone tone-glass" />

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel
          tone="graphite"
          index={1}
          title={`${channel.name} · ${METRIC[metric].label.toLowerCase()}`}
          aside={
            <Segmented
                label="Range"
                value={range}
                onChange={setRange}
                items={[
                  { value: "7", label: "7 d" },
                  { value: "28", label: "28 d" },
                  { value: "90", label: "90 d" },
                ]}
              />
          }
        >
          <div className="overflow-x-auto pb-1">
            <Segmented
              label="Metric"
              value={metric}
              onChange={setMetric}
              items={(Object.keys(METRIC) as Metric[]).map((m) => ({ value: m, label: METRIC[m].label }))}
            />
          </div>
          <div className="mt-3 flex flex-1 flex-col">
            <LineChart points={points} marks={marks} height="fill" unit={METRIC[metric].unit} format={METRIC[metric].fmt} ariaLabel={`${channel.name} ${METRIC[metric].label} per day`} />
          </div>
          <p className="mt-2 text-[12px] text-faint">
            Ticks under the line are upload days.{" "}
            {st.youtube
              ? `Each upload's real views from YouTube (${shortDate(fromKey(st.youtube.at))}), spread over the days after it went up; watch time and revenue are estimates.`
              : channel.real?.views30
                ? "Scaled to the numbers you entered; the day-to-day shape is still an estimate."
                : "Estimates until you add your numbers under About this channel."}
          </p>
        </Panel>

        <Panel
          tone="glass"
          index={2}
          title="About this channel"
          aside={
            channel.handle && (
              <span className="flex items-center gap-1">
                <a href={`https://www.youtube.com/${channel.handle}`} target="_blank" rel="noreferrer" className="press inline-flex h-7 items-center gap-1 rounded-full px-2 text-[12px] text-muted hover:bg-raised hover:text-text">
                  YouTube <ArrowUpRight size={12} />
                </a>
                <a
                  href={`https://socialblade.com/youtube/handle/${channel.handle.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="press inline-flex h-7 items-center gap-1 rounded-full px-2 text-[12px] text-muted hover:bg-raised hover:text-text"
                >
                  Social Blade <ArrowUpRight size={12} />
                </a>
              </span>
            )
          }
        >
          <dl key={sel} className="divide-y divide-rule text-[13px]">
            {(
              [
                ["Name", <Editable key="n" value={channel.name} label="Channel name" onSave={(v) => actions.updateChannel(sel, { name: v })} />],
                ["Handle", <Editable key="h" value={channel.handle ?? ""} label="YouTube handle" placeholder="@handle" allowEmpty onSave={(v) => actions.updateChannel(sel, { handle: v ? (v.startsWith("@") ? v : "@" + v) : undefined })} />],
                ["Niche", <Editable key="ni" value={channel.niche} label="Niche" placeholder="Add a niche" allowEmpty onSave={(v) => actions.updateChannel(sel, { niche: v })} />],
                ...(st.youtube
                  ? ([
                      ["Subscribers", fmt(st.youtube.subscribers)],
                      ["Uploads", fmt(st.youtube.videoCount)],
                      ["Lifetime views", fmt(st.youtube.totalViews)],
                      ["Average per upload", fmt(Math.round(st.youtube.totalViews / Math.max(1, st.videos.length)))],
                    ] as [string, React.ReactNode][])
                  : ([["Uploads, last 90 days", fmt(st.videos.length)]] as [string, React.ReactNode][])),
              ] as [string, React.ReactNode][]
            ).map(([k, v]) => (
              <div key={k} className="flex min-h-10 items-center justify-between gap-3">
                <dt className="shrink-0 text-muted">{k}</dt>
                <dd className="num min-w-0 truncate text-right">{v}</dd>
              </div>
            ))}
          </dl>
          {st.youtube ? (
            <p className="mt-3 text-[12px] leading-[17px] text-faint">
              Read from YouTube on {shortDate(fromKey(st.youtube.at))}: subscribers (YouTube rounds them), uploads and each upload&apos;s views. Watch time, CTR and revenue only show in YouTube Studio, so those are estimates here.
            </p>
          ) : (
            <>
            <h3 className="mt-5 mb-1 text-[13px] text-muted">Your numbers</h3>
            <p className="mb-2 text-[12px] leading-[17px] text-faint">
              Copy these from Social Blade or YouTube Studio. Until you do, every chart here is an estimate; once you do, they scale to match.
            </p>
            <div key={sel + "-real"} className="grid grid-cols-2 gap-2">
              {(
                [
                  ["subscribers", "Subscribers"],
                  ["views30", "Views, last 30 days"],
                  ["subs30", "Subs gained, 30 days"],
                  ["earnings30", "Earnings, 30 days (USD)"],
                ] as const
              ).map(([k, l]) => (
                <label key={k} className="grid gap-1 text-[11px] text-faint">
                  {l}
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    defaultValue={channel.real?.[k] ?? ""}
                    placeholder="—"
                    onBlur={(e) => {
                      const raw = e.target.value.trim();
                      const n = raw === "" ? undefined : Math.max(0, Number(raw));
                      if (n !== channel.real?.[k]) actions.updateChannel(sel, { real: { ...channel.real, [k]: n } });
                    }}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    className={field + " num h-9 text-right"}
                  />
                </label>
              ))}
            </div>
            </>
          )}
          <h3 className="mt-5 mb-1 text-[13px] text-muted">Coming up</h3>
          {upcoming.length === 0 ? (
            <p className="rounded-[10px] border border-dashed border-border px-3 py-2.5 text-[13px] text-faint">Nothing in production for this channel.</p>
          ) : (
            <ul className="divide-y divide-rule">
              {upcoming.slice(0, 5).map((v) => {
                const u = videoUrgency(v, now);
                return (
                  <li key={v.id} className="flex min-h-11 items-center gap-3 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-[13px]">{v.title}</span>
                    <span className="shrink-0 text-[12px] text-faint">{stageLabel(s, v.stage)}</span>
                    <span className={cn("num shrink-0 text-right text-[12px] whitespace-nowrap", u === "ok" ? "text-muted" : "text-ember-soft")}>{relDay(v.publishAt, now)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel
          framed
          title="Where the views came from"
          aside={<span className="num">{fmt(tiles.reduce((a, t) => a + t.value, 0))} views, all channels, last {n} days</span>}
        >
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
            {groups.map((g) => (
              <span key={g.id} className="inline-flex items-center gap-1.5">
                <i className="size-2 rounded-[2px]" style={{ background: g.color }} />
                {g.name}
              </span>
            ))}
          </div>
          <Treemap items={tiles} groups={groups} height={392} unit="views" ariaLabel={`Views by video, last ${n} days`} />
        </Panel>

        <Panel tone="dune" index={4} title="Views by weekday" aside={<span>{channel.name} · last 12 weeks</span>}>
          <p className="text-[13px] text-muted">
            Best day: <span className="text-text">{WEEKDAYS[byWeekday.indexOf(Math.max(...byWeekday))]}</span>, <span className="num text-text">{fmt(Math.max(...byWeekday))}</span> views on an average day. Quietest:{" "}
            <span className="text-text">{WEEKDAYS[byWeekday.indexOf(Math.min(...byWeekday))]}</span>.
          </p>
          <div className="flex flex-1 items-center justify-center py-2">
            <Radar values={byWeekday} axis={WEEKDAYS} unit="Avg. daily views" label={channel.name} />
          </div>
          <p className="text-[12px] text-faint">Switch channels at the top and the shape follows.</p>
        </Panel>
      </div>

      <Panel
        tone="glass"
        index={5}
        className="mt-5"
        title={`Recent uploads · ${channel.name}`}
        aside={
          <span className="num">
            {st.youtube ? `${st.youtube.videoCount} uploads · from YouTube, ${shortDate(fromKey(st.youtube.at))}` : `${st.videos.length} in the last 90 days${channel.real?.views30 ? "" : " · estimated"}`}
          </span>
        }
      >
        <div className="relative -mx-1 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <thead>
              <tr className="text-[12px] text-faint">
                <th className="w-[44%] pb-2 pl-1 text-left font-normal">Video</th>
                <th className="pb-2 text-right font-normal">Published</th>
                {st.youtube ? <th className="pb-2 text-right font-normal">Length</th> : <th className="pb-2 text-right font-normal">First 7 days</th>}
                <th className="pb-2 text-right font-normal">{st.youtube ? "Views" : "Total views"}</th>
                {!st.youtube && <th className="pb-2 text-right font-normal">CTR</th>}
                {!st.youtube && <th className="pb-2 text-right font-normal">Avg. viewed</th>}
                <th className="pr-1 pb-2 text-right font-normal">Est. revenue</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((v) => {
                const total = (x: typeof v) => x.lifetime ?? Object.values(x.daily).reduce((a, b) => a + b, 0);
                const views = total(v);
                const first = Object.entries(v.daily)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .slice(0, 7)
                  .reduce((a, [, x]) => a + x, 0);
                const max = Math.max(1, ...recent.map(total));
                const rpm = v.url && (!v.seconds || v.seconds <= 180) ? 0.05 : channel.rpm;
                return (
                  <tr key={v.id} className="group border-t border-rule transition-colors hover:bg-raised/50">
                    <td className="max-w-0 py-2.5 pl-1">
                      {v.url ? (
                        <a href={v.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-ember-soft">
                          <span className="truncate">{v.title}</span>
                          <ArrowUpRight size={12} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                        </a>
                      ) : (
                        <div className="truncate">{v.title}</div>
                      )}
                      <div className="mt-1 h-[2px] rounded-full bg-raised">
                        <div className="h-full rounded-full bg-sand transition-[width] duration-500 ease-[var(--ease-out)] group-hover:bg-ember" style={{ width: `${(views / max) * 100}%` }} />
                      </div>
                    </td>
                    <td className="num py-2.5 text-right text-muted" title={v.approx ? "Approximate: YouTube didn't show this date, so it sits between the uploads around it" : undefined}>
                      {v.approx && "~"}
                      {shortDate(fromKey(v.publishedOn))}
                    </td>
                    {st.youtube ? (
                      <td className="num py-2.5 text-right text-muted">{v.seconds ? `${Math.floor(v.seconds / 60)}:${String(v.seconds % 60).padStart(2, "0")}` : "Short"}</td>
                    ) : (
                      <td className="num py-2.5 text-right">{compact(first)}</td>
                    )}
                    <td className="num py-2.5 text-right">
                      {v.approx && "~"}
                      {compact(views)}
                    </td>
                    {!st.youtube && <td className="num py-2.5 text-right">{((v.ctr ?? 0) * 100).toFixed(1)}%</td>}
                    {!st.youtube && <td className="num py-2.5 text-right">{Math.round((v.avdPct ?? 0) * 100)}%</td>}
                    <td className="num py-2.5 pr-1 text-right">${fmt((views / 1000) * rpm, 2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {st.youtube && <p className="mt-3 text-[12px] text-faint">Revenue assumes about $0.05 per 1,000 views on Shorts and this channel&apos;s RPM on longer videos. ~ marks an approximate date or rounded count.</p>}
      </Panel>

      <div id="production" className="mt-5 scroll-mt-20">
        <ProductionLine state={s} now={now} maxPerStage={99} />
      </div>
    </div>
  );
}
