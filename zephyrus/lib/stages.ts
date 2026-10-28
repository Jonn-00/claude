import type { State, Stage } from "./types";
import { DEFAULT_STAGES } from "./types";

export const stagesOf = (s: State) => (s.stages?.length ? s.stages : DEFAULT_STAGES);
export const stageLabel = (s: State, id: Stage) => stagesOf(s).find((x) => x.id === id)?.label ?? id;
/** A panel or section title: yours if you renamed it, otherwise the default. */
export const label = (s: State, key: string, fallback: string) => s.labels?.[key]?.trim() || fallback;
