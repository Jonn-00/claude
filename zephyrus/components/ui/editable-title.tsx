"use client";

import { actions } from "@/lib/store";
import { label } from "@/lib/stages";
import type { State } from "@/lib/types";
import { Editable } from "./editable";

/** A panel title you can rename; clearing it brings the default back. */
export function EditableTitle({ state, k, fallback }: { state: State; k: string; fallback: string }) {
  return <Editable value={label(state, k, fallback)} label={`${fallback} title`} allowEmpty onSave={(v) => actions.setLabel(k, v)} inputClassName="h-7" />;
}
