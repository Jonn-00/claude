import type { Channel, ChannelId, DayStat, PublishedVideo } from "./types";
import { addDays, dayKey, fromKey, shortDate } from "./time";
import { rng } from "./utils";

/*
  Sample analytics until the YouTube Analytics API is connected. Each
  channel's day is its back catalogue plus what every recent upload earned
  that day, so a video's views and the channel's views always add up.
  Data runs through yesterday, as YouTube's own reporting does.
*/

const CATALOGUE: Record<ChannelId, number> = { c1: 30000, c2: 9000, c3: 4500, c4: 2600 };
const CADENCE: Record<ChannelId, number> = { c1: 2, c2: 4, c3: 5, c4: 7 };
const PEAK: Record<ChannelId, number> = { c1: 52000, c2: 26000, c3: 15000, c4: 19000 };
const DECAY: Record<ChannelId, number> = { c1: 1.4, c2: 4, c3: 6, c4: 8 };


export type ChannelStats = { channelId: ChannelId; days: DayStat[]; videos: PublishedVideo[] };

export function buildStats(channels: Channel[], today: string, span = 90): ChannelStats[] {
  const end = addDays(today, -1);
  const start = addDays(end, -(span - 1));
  const dates = Array.from({ length: span }, (_, i) => addDays(start, i));

  return channels.map((ch, ci) => {
    const r = rng(1009 * (ci + 1));
    const videos: PublishedVideo[] = [];
    let n = 0;
    for (let i = span - 1; i >= 0; i -= CADENCE[ch.id]) {
      const publishedOn = dates[i];
      const peak = PEAK[ch.id] * (0.45 + r() * 1.25);
      const daily: Record<string, number> = {};
      for (let k = 0; i + k < span; k++) {
        const v = Math.round(peak * Math.exp(-k / DECAY[ch.id]) * (0.9 + r() * 0.2));
        if (v < 15) break;
        daily[dates[i + k]] = v;
      }
      videos.push({
        id: `${ch.id}-p${n}`,
        channelId: ch.id,
        // Estimated history has no real titles; name each upload by its date.
        title: `Upload of ${shortDate(fromKey(publishedOn))}`,
        publishedOn,
        daily,
        ctr: 0.035 + r() * 0.07,
        avdPct: 0.28 + r() * 0.34,
      });
      n++;
    }
    videos.reverse();

    const days: DayStat[] = dates.map((date) => {
      const dow = new Date(date + "T12:00:00").getDay();
      const weekend = dow === 0 || dow === 6 ? 1.12 : 1;
      const catalogue = CATALOGUE[ch.id] * weekend * (0.92 + r() * 0.16);
      const fromUploads = videos.reduce((s, v) => s + (v.daily[date] ?? 0), 0);
      const views = Math.round(catalogue + fromUploads);
      return {
        date,
        views,
        subs: Math.round(views * ch.subRate * (0.85 + r() * 0.3)),
        watchHours: Math.round((views * ch.avd) / 60),
        revenue: Math.round((views / 1000) * ch.rpm * 100) / 100,
      };
    });

    // Your own figures win: scale the estimate so its last 30 days match them.
    const own = ch.real;
    if (own) {
      const last = days.slice(-30);
      const scale = (key: "views" | "subs" | "revenue", target?: number) => {
        const sum = last.reduce((a, d) => a + d[key], 0);
        return target && sum ? target / sum : 1;
      };
      const fv = scale("views", own.views30);
      const fs = own.subs30 !== undefined ? scale("subs", own.subs30) : fv;
      const fr = own.earnings30 !== undefined ? scale("revenue", own.earnings30) : fv;
      if (fv !== 1 || fs !== 1 || fr !== 1) {
        for (const d of days) {
          d.views = Math.round(d.views * fv);
          d.watchHours = Math.round(d.watchHours * fv);
          d.subs = Math.round(d.subs * fs);
          d.revenue = Math.round(d.revenue * fr * 100) / 100;
        }
        for (const v of videos) for (const k of Object.keys(v.daily)) v.daily[k] = Math.round(v.daily[k] * fv);
      }
    }

    return { channelId: ch.id, days, videos };
  });
}

/** Views a video earned inside [from, to] (inclusive date keys). */
export const viewsIn = (v: PublishedVideo, from: string, to: string) =>
  Object.entries(v.daily).reduce((s, [d, n]) => (d >= from && d <= to ? s + n : s), 0);

export const sumDays = (days: DayStat[], key: keyof Omit<DayStat, "date">) =>
  days.reduce((s, d) => s + d[key], 0);

export const todayKey = () => dayKey(Date.now());
