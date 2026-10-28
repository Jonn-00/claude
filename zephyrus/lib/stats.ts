import type { Channel, ChannelId, DayStat, PublishedVideo } from "./types";
import { addDays, dayKey, fromKey, shortDate } from "./time";
import { rng } from "./utils";
import { SNAPSHOT_AT, YOUTUBE, type ChannelSnapshot } from "./youtube";

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


export type ChannelStats = {
  channelId: ChannelId;
  days: DayStat[];
  videos: PublishedVideo[];
  /** "youtube" when views and uploads come from the public snapshot. */
  source: "youtube" | "estimate";
  youtube?: { subscribers: number; videoCount: number; totalViews: number; at: string };
};

// Shorts earn far less per view than long videos; the channel's RPM applies to the long ones.
const SHORT_RPM = 0.05;
const isShort = (seconds?: number) => !seconds || seconds <= 180;
const daysFrom = (a: string, b: string) => Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86400000);

/**
  Real uploads and their real lifetime views. YouTube doesn't publish views per
  day, so each upload's total is spread from its publish day with a falloff
  (fast for Shorts, slower for long videos). Every total adds up to YouTube's.
*/
function fromYouTube(ch: Channel, snap: ChannelSnapshot, dates: string[], end: string) {
  const videos: (PublishedVideo & { rpm: number; minutes: number })[] = snap.uploads
    .map((u) => {
      const publishedOn = dayKey(new Date(u.publishedAt));
      const short = isShort(u.seconds);
      const tau = short ? 2.5 : 9;
      const life = daysFrom(publishedOn, end) + 1;
      // A fast falloff plus a long, low tail: old uploads keep picking up a few views.
      const weights = Array.from({ length: Math.max(0, life) }, (_, k) => Math.exp(-k / tau) + 0.03 * Math.exp(-k / 60));
      const total = weights.reduce((a, w) => a + w, 0);
      const daily: Record<string, number> = {};
      let given = 0;
      weights.forEach((w, k) => {
        const d = addDays(publishedOn, k);
        const v = Math.round((u.views * w) / total);
        if (d >= dates[0] && v > 0) daily[d] = v;
        given += v;
      });
      if (life > 0 && given !== u.views && daily[publishedOn] !== undefined) daily[publishedOn] += u.views - given;
      return {
        id: `${ch.id}-${u.id}`,
        channelId: ch.id,
        title: u.title,
        publishedOn,
        daily,
        lifetime: u.views,
        url: `https://www.youtube.com/watch?v=${u.id}`,
        seconds: u.seconds,
        approx: u.approx,
        rpm: short ? SHORT_RPM : ch.rpm,
        minutes: u.seconds ? (u.seconds / 60) * (short ? 0.75 : 0.4) : short ? 0.25 : ch.avd,
      };
    })
    .sort((a, b) => a.publishedOn.localeCompare(b.publishedOn));

  const days: DayStat[] = dates.map((date) => {
    let views = 0, revenue = 0, minutes = 0;
    for (const v of videos) {
      const n = v.daily[date] ?? 0;
      views += n;
      revenue += (n / 1000) * v.rpm;
      minutes += n * v.minutes;
    }
    return { date, views, subs: 0, watchHours: Math.round(minutes / 60), revenue: Math.round(revenue * 100) / 100 };
  });
  // The channels are younger than the window, so their subscribers arrived inside it, roughly with the views.
  const inWindow = days.reduce((a, d) => a + d.views, 0) || 1;
  let acc = 0, given = 0;
  for (const d of days) {
    acc += d.views;
    const upTo = Math.round((snap.subscribers * acc) / inWindow);
    d.subs = upTo - given;
    given = upTo;
  }
  const totalViews = snap.uploads.reduce((a, u) => a + u.views, 0);
  return { days, videos: videos.map(({ rpm: _r, minutes: _m, ...v }) => v), youtube: { subscribers: snap.subscribers, videoCount: snap.videoCount, totalViews, at: SNAPSHOT_AT } };
}

export function buildStats(channels: Channel[], today: string, span = 90): ChannelStats[] {
  const end = addDays(today, -1);
  const start = addDays(end, -(span - 1));
  const dates = Array.from({ length: span }, (_, i) => addDays(start, i));

  return channels.map((ch, ci): ChannelStats => {
    const r = rng(1009 * (ci + 1));
    const snap = YOUTUBE[ch.id];
    if (snap && ch.handle?.toLowerCase() === snap.handle.toLowerCase()) {
      const yt = fromYouTube(ch, snap, dates, end);
      return { channelId: ch.id, days: yt.days, videos: yt.videos, source: "youtube", youtube: yt.youtube };
    }
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

    return { channelId: ch.id, days, videos, source: "estimate" };
  });
}

/** Views a video earned inside [from, to] (inclusive date keys). */
export const viewsIn = (v: PublishedVideo, from: string, to: string) =>
  Object.entries(v.daily).reduce((s, [d, n]) => (d >= from && d <= to ? s + n : s), 0);

export const sumDays = (days: DayStat[], key: keyof Omit<DayStat, "date">) =>
  days.reduce((s, d) => s + d[key], 0);

export const todayKey = () => dayKey(Date.now());
