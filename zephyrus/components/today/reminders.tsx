"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { actions } from "@/lib/store";
import type { BlockKind, State } from "@/lib/types";
import { KIND_LABEL } from "@/lib/types";
import { dayKey, fromKey, hhmm, minutesOf, relDay } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/panel";
import { removeWithUndo } from "@/components/ui/notify";
import { Editable } from "@/components/ui/editable";
import { EditableTitle } from "@/components/ui/editable-title";

/** Due today or overdue, plus anything ticked off today. Overdue is lit. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function Reminders({ state, now }: { state: State; now: number }) {
  const today = dayKey(now);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState(hhmm(Math.min(23 * 60 + 45, Math.ceil((minutesOf(now) + 60) / 15) * 15)));
  const list = state.reminders
    .filter((r) => dayKey(new Date(r.due)) <= today || !r.done)
    .filter((r) => !r.done || dayKey(new Date(r.due)) === today)
    .sort((a, b) => Number(a.done) - Number(b.done) || a.due.localeCompare(b.due));
  const open = list.filter((r) => !r.done && dayKey(new Date(r.due)) <= today).length;
  const doneToday = list.filter((r) => r.done).length;
  const [all, setAll] = useState(false);
  const pending = list.filter((r) => !r.done);
  const shown = all ? list : pending.slice(0, 4);
  const hidden = list.length - shown.length;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const d = fromKey(today);
    d.setHours(0, Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)), 0, 0);
    actions.addReminder({ title: title.trim(), due: d.toISOString(), kind: "personal" });
    setTitle("");
    setAdding(false);
  };

  return (
    <Panel
      tone="glass"
      index={4}
      title={<EditableTitle state={state} k="reminders" fallback="Reminders" />}
      aside={
        <span className="num">
          {open} open{doneToday ? ` · ${doneToday} done` : ""}
        </span>
      }
    >
      <ul className="-mx-2">
        {shown.map((r) => {
          const overdue = !r.done && new Date(r.due).getTime() < now;
          return (
            <li key={r.id} className={cn("enter group flex min-h-11 items-start gap-2.5 rounded-[10px] px-2 py-2", overdue && "lit border border-transparent")}>
              <button
                onClick={() => actions.toggleReminder(r.id)}
                role="checkbox"
                aria-checked={r.done}
                aria-label={r.done ? `Mark “${r.title}” not done` : `Mark “${r.title}” done`}
                className={cn(
                  "press mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-[6px] border transition-colors duration-200",
                  r.done ? "border-sand bg-sand text-ground" : "border-control hover:border-sand",
                )}
              >
                <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
                  <path
                    d="M2.5 6.4 5 8.8 9.6 3.6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pathLength={1}
                    style={{ strokeDasharray: 1, strokeDashoffset: r.done ? 0 : 1, transition: "stroke-dashoffset 260ms var(--ease-out) 60ms" }}
                  />
                </svg>
              </button>
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    "text-[13px] leading-[18px] line-through transition-[color,text-decoration-color] duration-300",
                    r.done ? "text-faint decoration-faint" : "decoration-transparent",
                  )}
                >
                  <Editable value={r.title} label="Reminder" onSave={(v) => actions.updateReminder(r.id, { title: v })} inputClassName="text-[13px] leading-[18px]" />
                </div>
                <div className={cn("num flex items-center gap-1 text-[12px] leading-4", overdue ? "text-ember-soft" : "text-faint")}>
                  <label className="relative -mx-1 cursor-pointer rounded-[6px] px-1 hover:bg-active/60" title="Change the time">
                    {relDay(r.due, now)}
                    <input
                      type="datetime-local"
                      aria-label={`When: ${r.title}`}
                      value={toLocalInput(r.due)}
                      onChange={(e) => e.target.value && actions.updateReminder(r.id, { due: new Date(e.target.value).toISOString() })}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </label>
                  ·
                  <select
                    value={r.kind}
                    aria-label={`Area: ${r.title}`}
                    onChange={(e) => actions.updateReminder(r.id, { kind: e.target.value as BlockKind })}
                    className="-mx-1 cursor-pointer appearance-none rounded-[6px] bg-transparent px-1 text-inherit outline-none hover:bg-active/60"
                  >
                    {(Object.keys(KIND_LABEL) as BlockKind[]).map((k) => (
                      <option key={k} value={k} className="bg-raised text-text">
                        {KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={() => removeWithUndo("reminders", r.id, "reminder", actions.removeReminder)}
                aria-label={`Delete “${r.title}”`}
                className="press grid size-7 shrink-0 place-items-center rounded-full text-faint opacity-0 group-hover:opacity-100 hover:bg-raised hover:text-text focus-visible:opacity-100"
              >
                <X size={13} />
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className="mx-2 rounded-[10px] border border-dashed border-border px-3 py-2.5 text-[13px] text-faint">Nothing due. Add one below.</li>}
      </ul>
      {hidden > 0 && !all && (
        <button onClick={() => setAll(true)} className="press mt-1 h-7 self-start rounded-full px-2 text-[12px] text-muted hover:bg-raised hover:text-text">
          Show {hidden} more
        </button>
      )}
      {adding ? (
        <form onSubmit={save} onKeyDown={(e) => e.key === "Escape" && setAdding(false)} className="enter mt-2 flex gap-1.5">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Remind me to…"
            aria-label="Reminder"
            className="h-8 min-w-0 flex-1 rounded-[8px] border border-control bg-raised px-2.5 text-[13px] outline-none focus:border-sand"
          />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time today" className="num h-8 w-[84px] rounded-[8px] border border-control bg-raised px-1.5 text-[13px]" />
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="press mt-2 inline-flex h-8 items-center gap-1.5 self-start rounded-full px-2 text-[13px] text-muted hover:bg-raised hover:text-text">
          <Plus size={14} /> Add reminder
        </button>
      )}
    </Panel>
  );
}
