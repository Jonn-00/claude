"use client";

import { useState } from "react";
import { Phone } from "lucide-react";
import { actions } from "@/lib/store";
import { callbacks, countCalls } from "@/lib/derive";
import type { Niche, Outcome, State } from "@/lib/types";
import { NICHE_LABEL, OUTCOME_LABEL } from "@/lib/types";
import { dayKey, timeOf } from "@/lib/time";
import { cn, fmt } from "@/lib/utils";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { DotNumber } from "@/components/ui/dot-number";
import { Ticks } from "@/components/ui/ticks";
import { OutcomeButtons } from "@/components/ui/outcome-buttons";
import { notify } from "@/components/ui/notify";
import { Editable } from "@/components/ui/editable";
import { EditableTitle } from "@/components/ui/editable-title";


/** Logging a dial is the agency's most frequent job, so it's one tap from Today. */
export function CallsCard({ state, now, className }: { state: State; now: number; className?: string }) {
  const today = dayKey(now);
  const [niche, setNiche] = useState<Niche>("realestate");
  const c = countCalls(state.calls, today, today);
  const target = state.settings.dialTarget;
  const left = Math.max(0, target - c.dials);
  const cbs = callbacks(state.leads, now).slice(0, 3);
  const ratio = Math.min(1, c.dials / target);

  const byOutcome = { noanswer: 0, talked: 0, interested: 0, demo: 0, won: 0 } as Record<Outcome, number>;
  for (const e of state.calls) if (dayKey(new Date(e.at)) === today) byOutcome[e.outcome]++;

  const log = (o: Outcome) => {
    const id = actions.logCall({ niche, outcome: o });
    notify(`Logged: ${OUTCOME_LABEL[o]}`, { detail: `${NICHE_LABEL[niche]} · dial ${c.dials + 1} of ${target}`, undo: () => actions.undoCall(id) });
  };

  return (
    <Panel
      tone="copper"
      index={2}
      title={<EditableTitle state={state} k="calls" fallback="Calls today" />}
      aside={
        <span className="num">
          target{" "}
          <Editable value={String(target)} label="Daily dial target" onSave={(v) => actions.setSettings({ dialTarget: Math.max(1, Math.round(Number(v)) || target) })} inputClassName="h-6 w-14 text-right" />
        </span>
      }
      className={className}
    >
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-end gap-2.5">
          <DotNumber value={c.dials} pitch={6} label="Dials today" />
          <span className="pb-0.5 text-[15px] text-faint">/ {target} dials</span>
        </div>
        <span className={cn("num pb-1 text-[13px]", left === 0 ? "text-positive" : "text-muted")}>{left === 0 ? "Target hit" : `${left} to go`}</span>
      </div>
      <div className="mt-3">
        <Ticks ratio={ratio} n={40} lit="#fff" label="Dials against target" />
      </div>
      <dl className="mt-3 grid grid-cols-4 gap-2 text-[12px]">
        {[
          ["Reached", c.reached],
          ["Interested", c.interested],
          ["Demos", c.demos],
          ["Closed", c.won],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-faint">{k}</dt>
            <dd className="num text-[15px] text-text">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 rounded-[14px] bg-raised p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] whitespace-nowrap text-muted">Log a dial</span>
          <Segmented
            label="Niche"
            value={niche}
            onChange={setNiche}
            items={[
              { value: "realestate", label: "Real estate" },
              { value: "detailing", label: "Detailing" },
            ]}
          />
        </div>
        <OutcomeButtons counts={byOutcome} onLog={log} className="mt-2.5" />
      </div>

      <h3 className="mt-4 mb-1 text-[13px] text-muted">Callbacks due</h3>
      {cbs.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-border px-3 py-2.5 text-[13px] text-faint">No callbacks left today.</p>
      ) : (
        <ul className="divide-y divide-rule">
          {cbs.map((l) => {
            const overdue = new Date(l.nextAt!).getTime() < now;
            return (
              <li key={l.id} className="flex h-11 items-center gap-3">
                <span className={cn("num w-11 shrink-0 text-[13px]", overdue ? "text-ember-soft" : "text-muted")}>{timeOf(l.nextAt!)}</span>
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {l.business} <span className="text-faint">· {l.contact.split(" ")[0]}</span>
                </span>
                <a href={`tel:${l.phone.replace(/\s/g, "")}`} className="press inline-flex h-7 items-center gap-1.5 rounded-full border border-control px-2.5 text-[12px] text-text hover:border-sand">
                  <Phone size={12} /> Call
                </a>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-auto pt-3 text-[12px] text-faint">
        {fmt(countCalls(state.calls, today.slice(0, 8) + "01", today).won * state.settings.dealValue)} CAD closed this month
      </p>
    </Panel>
  );
}
