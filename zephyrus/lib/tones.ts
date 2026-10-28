import type { ChannelId } from "./types";

/*
  Channel identity tones: one warm family stepping from peach to umber, so
  four channels read apart without breaking the one-hue rule. Ember itself
  stays reserved for "needs you" and the main data line.
*/
export const TONE: Record<ChannelId, { bg: string; ink: string }> = {
  c1: { bg: "#f2b183", ink: "#24150b" },
  c2: { bg: "#c98a62", ink: "#1d120b" },
  c3: { bg: "#9c8573", ink: "#160f0a" },
  c4: { bg: "#665445", ink: "#f7f0e8" },
};
