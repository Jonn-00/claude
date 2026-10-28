import type { ChannelId } from "./types";
import data from "./youtube-snapshot.json";

/*
  Public numbers read from YouTube itself (channel pages and each channel's
  RSS feed) on the date in the snapshot. Subscriber counts are YouTube's
  rounded figures; views are each upload's lifetime count. Uploads marked
  approx had their date placed between their neighbours and their views read
  from the rounded Shorts-tab count. Watch time, CTR and revenue are not
  public, so those stay estimates.
*/

export type SnapshotUpload = { id: string; title: string; views: number; publishedAt: string; seconds?: number; approx?: boolean };
export type ChannelSnapshot = { handle: string; subscribers: number; videoCount: number; uploads: SnapshotUpload[] };

export const SNAPSHOT_AT: string = data.at;
export const YOUTUBE = data.channels as Partial<Record<ChannelId, ChannelSnapshot>>;
