import { leadFromDoc } from "../../../lib/cloud";
import data from "./agents.json";

/** Made-up agents in the Realtor Call Tracker's document format, read through the app's own importer. */
export function agents() {
  return Object.entries(data as Record<string, Record<string, unknown>>).map(([id, d]) => leadFromDoc(id, d));
}
