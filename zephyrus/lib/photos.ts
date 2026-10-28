import today from "@/assets/photos/today.webp";
import channels from "@/assets/photos/channels.webp";
import agency from "@/assets/photos/agency.webp";
import planner from "@/assets/photos/planner.webp";
import notes from "@/assets/photos/notes.webp";

/** Page header photographs, all from Unsplash, with the credit each one needs. */
export type PhotoKey = "today" | "channels" | "agency" | "planner" | "notes";
export type Photo = { src: string; alt: string; by: string; profile: string };

// Next hands back { src }, the single-file build hands back a data URL.
const url = (m: string | { src: string }) => (typeof m === "string" ? m : m.src);
const ref = "?utm_source=zephyrus&utm_medium=referral";

export const PHOTOS: Record<PhotoKey, Photo> = {
  today: { src: url(today), alt: "Low sun through a loft window over the city", by: "Olexandr Ignatov", profile: `https://unsplash.com/@olexandrignatov${ref}` },
  channels: { src: url(channels), alt: "A camera in silhouette against the setting sun", by: "Nibras Hassan Nathu", profile: `https://unsplash.com/@pop_at_nibras_hassan${ref}` },
  agency: { src: url(agency), alt: "A sedan in a wheat field at sunset", by: "Kreit", profile: `https://unsplash.com/@kreit${ref}` },
  planner: { src: url(planner), alt: "Evening light from a window falling across a wall", by: "Jay Lo", profile: `https://unsplash.com/@jaylotw${ref}` },
  notes: { src: url(notes), alt: "A laptop and lamp on a wooden desk at night", by: "Avtar Singh", profile: `https://unsplash.com/@avtar9w${ref}` },
};

export const UNSPLASH = `https://unsplash.com/${ref}`;
