import type { Channel, ChannelId, DayStat, PublishedVideo } from "./types";
import { addDays, dayKey } from "./time";
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

const TITLES: Record<ChannelId, string[]> = {
  c1: [
    "Seneca on anger, in 50 seconds",
    "Why Marcus Aurelius wrote to himself",
    "Epictetus: what is up to you",
    "The Stoic morning question",
    "Zeno lost everything at sea",
    "Cato never raised his voice",
    "Memento mori is not morbid",
    "The dichotomy of control, drawn",
    "Seneca on borrowed time",
    "Amor fati in one minute",
    "Stoics on praise and blame",
    "Why the Stoics journaled at night",
  ],
  c2: [
    "The whale fall that fed a village",
    "Sounds recorded 11 km down",
    "The ghost net drifting since 1998",
    "Why the deep sea glows blue",
    "A submarine cable cut by a shark?",
    "The lake under the ocean",
    "Giant isopods don't need to eat",
    "The wreck no one is allowed to visit",
  ],
  c3: [
    "Your bank account is a loan to the bank",
    "Why groceries cost more on a Sunday",
    "The 50/30/20 rule, stress-tested",
    "Index funds explained with a pizza",
    "Lease or buy: the real numbers",
    "Where a $40 sweater's money goes",
  ],
  c4: [
    "The village that vanished in one night",
    "Rome's fire brigade was a scam",
    "The longest siege in history",
    "Medieval cities had parking rules",
    "The map that invented an island",
  ],
};

export type ChannelStats = { channelId: ChannelId; days: DayStat[]; videos: PublishedVideo[] };

export function buildStats(channels: Channel[], today: string, span = 90): ChannelStats[] {
  const end = addDays(today, -1);
  const start = addDays(end, -(span - 1));
  const dates = Array.from({ length: span }, (_, i) => addDays(start, i));

  return channels.map((ch, ci) => {
    const r = rng(1009 * (ci + 1));
    const videos: PublishedVideo[] = [];
    const titles = TITLES[ch.id];
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
        title: titles[n % titles.length] + (n >= titles.length ? ` (part ${Math.floor(n / titles.length) + 1})` : ""),
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

    return { channelId: ch.id, days, videos };
  });
}

/** Views a video earned inside [from, to] (inclusive date keys). */
export const viewsIn = (v: PublishedVideo, from: string, to: string) =>
  Object.entries(v.daily).reduce((s, [d, n]) => (d >= from && d <= to ? s + n : s), 0);

export const sumDays = (days: DayStat[], key: keyof Omit<DayStat, "date">) =>
  days.reduce((s, d) => s + d[key], 0);

export const todayKey = () => dayKey(Date.now());
