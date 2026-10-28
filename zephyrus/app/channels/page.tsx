"use client";

import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { actions, useAppState, useStats } from "@/lib/store";
import { sumDays, viewsIn } from "@/lib/stats";
import type { ChannelId, DayStat } from "@/lib/types";
import { STAGE_LABEL } from "@/lib/types";
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
import { ProductionLine } from "@/components/today/production-line";
import { Button } from "@/components/ui/button";
import { field } from "@/components/shell/quick-add";

type Range = "7" | "28" | "90";
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
  const [editing, setEditing] = useState(false);
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

  const kpis = (["views", "watchHours", "subs", "revenue"] as Metric[]).map((m) => {
    const a = sumDays(cur, m);
    const b = sumDays(prev, m);
    const ch = change(a, b);
    return { label: METRIC[m].unit + (m === "revenue" ? " (USD)" : ""), value: METRIC[m].fmt(a), sub: ch.text, tone: ch.tone };
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

  const recent = [...st.videos].reverse().slice(0, 7);
  const upcoming = s.videos.filter((v) => v.channelId === sel && v.stage !== "live").sort((a, b) => a.publishAt.localeCompare(b.publishAt));

  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        title="Channels"
        line={
          <>
            {topName} brings in {Math.round(top.rShare * 100)}% of revenue from {Math.round(top.vShare * 100)}% of views, last 28 days
          </>
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
              setEditing(false);
            }}
            className={cn("press flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[14px]", c.id === sel ? "bg-raised text-text" : "text-muted hover:bg-raised/50 hover:text-text")}
          >
            <i className="size-2 rounded-full" style={{ background: TONE[c.id].bg }} />
            {c.name}
          </button>
        ))}
      </div>

      <KpiStrip items={kpis} />

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel
          framed
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
          <p className="mt-2 text-[12px] text-faint">Ticks under the line are upload days. Sample data through yesterday, until YouTube is connected.</p>
        </Panel>

        <Panel
          title="About this channel"
          aside={
            !editing && (
              <Button variant="quiet" size="sm" onClick={() => setEditing(true)}>
                <Pencil size={13} /> Rename
              </Button>
            )
          }
        >
          {editing ? (
            <RenameForm key={sel} id={sel} name={channel.name} niche={channel.niche} onDone={() => setEditing(false)} />
          ) : (
            <dl className="divide-y divide-rule text-[13px]">
              {[
                ["Name", channel.name],
                ["Niche", channel.niche],
                ["Uploads, last 90 days", fmt(st.videos.length)],
                ["Avg. view duration", `${channel.avd >= 1 ? channel.avd.toFixed(1) + " min" : Math.round(channel.avd * 60) + " s"}`],
                ["RPM", `$${channel.rpm.toFixed(2)}`],
              ].map(([k, v]) => (
                <div key={k} className="flex h-10 items-center justify-between gap-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="num truncate text-right">{v}</dd>
                </div>
              ))}
            </dl>
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
                    <span className="shrink-0 text-[12px] text-faint">{STAGE_LABEL[v.stage]}</span>
                    <span className={cn("num shrink-0 text-right text-[12px] whitespace-nowrap", u === "ok" ? "text-muted" : "text-ember-soft")}>{relDay(v.publishAt, now)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
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

        <Panel title={`Recent uploads · ${channel.name}`}>
          <div className="relative -mx-1 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-[13px]">
              <thead>
                <tr className="text-[12px] text-faint">
                  <th className="pb-2 pl-1 text-left font-normal">Video</th>
                  <th className="pb-2 text-right font-normal">Views</th>
                  <th className="pb-2 text-right font-normal">CTR</th>
                  <th className="pr-1 pb-2 text-right font-normal">Viewed</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((v) => {
                  const views = Object.values(v.daily).reduce((a, b) => a + b, 0);
                  return (
                    <tr key={v.id} className="border-t border-rule">
                      <td className="max-w-0 py-2.5 pl-1">
                        <div className="truncate">{v.title}</div>
                        <div className="text-[12px] text-faint">{shortDate(fromKey(v.publishedOn))}</div>
                      </td>
                      <td className="num py-2.5 text-right">{compact(views)}</td>
                      <td className="num py-2.5 text-right">{(v.ctr * 100).toFixed(1)}%</td>
                      <td className="num py-2.5 pr-1 text-right">{Math.round(v.avdPct * 100)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div id="production" className="mt-5 scroll-mt-20">
        <ProductionLine state={s} now={now} maxPerStage={99} />
      </div>
    </div>
  );
}

function RenameForm({ id, name, niche, onDone }: { id: string; name: string; niche: string; onDone: () => void }) {
  const [a, setA] = useState(name);
  const [b, setB] = useState(niche);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (a.trim()) actions.renameChannel(id, a.trim(), b.trim());
        onDone();
      }}
      onKeyDown={(e) => e.key === "Escape" && onDone()}
      className="grid gap-2"
    >
      <label className="text-[12px] text-faint">
        Channel name
        <input autoFocus value={a} onChange={(e) => setA(e.target.value)} className={field + " mt-1"} />
      </label>
      <label className="text-[12px] text-faint">
        Niche
        <input value={b} onChange={(e) => setB(e.target.value)} className={field + " mt-1"} />
      </label>
      <div className="mt-1 flex justify-end gap-2">
        <Button variant="quiet" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm">
          Save
        </Button>
      </div>
    </form>
  );
}
