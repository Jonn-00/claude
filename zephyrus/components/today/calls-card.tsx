"use client";

import { useState } from "react";
import { Phone, Undo2 } from "lucide-react";
import { actions } from "@/lib/store";
import { callbacks, countCalls } from "@/lib/derive";
import type { Niche, Outcome, State } from "@/lib/types";
import { NICHE_LABEL, OUTCOME_LABEL } from "@/lib/types";
import { dayKey, timeOf } from "@/lib/time";
import { cn, fmt } from "@/lib/utils";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { CountUp } from "@/components/ui/count-up";

const OUTCOMES: Outcome[] = ["noanswer", "talked", "interested", "demo", "won"];

/** Logging a dial is the agency's most frequent job, so it's one tap from Today. */
export function CallsCard({ state, now, className }: { state: State; now: number; className?: string }) {
  const today = dayKey(now);
  const [niche, setNiche] = useState<Niche>("realestate");
  const [last, setLast] = useState<{ id: string; label: string } | null>(null);
  const c = countCalls(state.calls, today, today);
  const target = state.settings.dialTarget;
  const left = Math.max(0, target - c.dials);
  const cbs = callbacks(state.leads, now).slice(0, 3);
  const ratio = Math.min(1, c.dials / target);

  const log = (o: Outcome) => {
    const id = actions.logCall({ niche, outcome: o });
    setLast({ id, label: `${OUTCOME_LABEL[o]} · ${NICHE_LABEL[niche].toLowerCase()}` });
  };

  return (
    <Panel framed title="Calls today" aside={<span className="num">target {target}</span>} className={className}>
      <div className="flex items-end justify-between gap-3">
        <div className="font-display text-[34px] leading-none font-medium tracking-[-0.02em]">
          <CountUp value={c.dials} />
          <span className="ml-1.5 text-[16px] font-normal tracking-normal text-faint">/ {target} dials</span>
        </div>
        <span className={cn("num pb-1 text-[13px]", left === 0 ? "text-positive" : "text-muted")}>{left === 0 ? "Target hit" : `${left} to go`}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={c.dials} aria-label="Dials against target">
        <div className="h-full rounded-full bg-ember transition-[width] duration-500 ease-[var(--ease-out)]" style={{ width: `${ratio * 100}%` }} />
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
        <div className="mt-2.5 grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-1.5">
          {OUTCOMES.map((o) => (
            <button
              key={o}
              onClick={() => log(o)}
              className={cn(
                "press h-8 rounded-full border px-2.5 text-[13px] whitespace-nowrap",
                o === "noanswer" ? "border-control text-muted hover:text-text" : "border-control text-text hover:border-sand",
              )}
            >
              {OUTCOME_LABEL[o]}
            </button>
          ))}
        </div>
        <div className="mt-2 flex h-5 items-center gap-2 text-[12px] text-faint" aria-live="polite">
          {last && (
            <>
              <span className="truncate">Logged: {last.label}</span>
              <button
                className="inline-flex items-center gap-1 text-muted underline-offset-2 hover:text-text hover:underline"
                onClick={() => {
                  actions.undoCall(last.id);
                  setLast(null);
                }}
              >
                <Undo2 size={12} /> Undo
              </button>
            </>
          )}
        </div>
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
