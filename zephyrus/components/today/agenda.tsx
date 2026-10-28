"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { actions } from "@/lib/store";
import type { AgendaEntry, State } from "@/lib/types";
import { addDays, dayKey, fromKey, longDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/button";

const PROMPTS: { key: keyof AgendaEntry; label: string; placeholder: string }[] = [
  { key: "shipped", label: "Shipped", placeholder: "What got done" },
  { key: "stuck", label: "Stuck", placeholder: "What slowed you down" },
  { key: "tomorrow", label: "Tomorrow", placeholder: "First thing tomorrow" },
];

const OPEN_KEY = "zephyrus:agenda-open";

/** A small daily report, folded away by default. A toggles it. */
export function Agenda({ state, now }: { state: State; now: number }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(dayKey(now));
  // Folded content can't be tabbed into. Set directly so it works on React 18 and 19 alike.
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bodyRef.current?.toggleAttribute("inert", !open);
  }, [open]);
  useEffect(() => {
    try {
      setOpen(localStorage.getItem(OPEN_KEY) === "1");
    } catch {}
  }, []);
  const toggle = (o: boolean) => {
    setOpen(o);
    try {
      localStorage.setItem(OPEN_KEY, o ? "1" : "0");
    } catch {}
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input,textarea,select,[contenteditable=true]");
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setOpen((o) => {
          try {
            localStorage.setItem(OPEN_KEY, o ? "0" : "1");
          } catch {}
          return !o;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const entry = state.agenda[date] ?? { shipped: "", stuck: "", tomorrow: "" };
  const filled = PROMPTS.filter((p) => entry[p.key].trim()).length;
  const isToday = date === dayKey(now);

  return (
    <section className="rounded-[18px] border border-border bg-surface">
      <button
        onClick={() => toggle(!open)}
        aria-expanded={open}
        aria-controls="agenda-body"
        aria-keyshortcuts="A"
        className="press flex h-[52px] w-full items-center gap-2 rounded-[18px] px-5 text-left"
      >
        <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em]">Agenda</h2>
        <span className="num text-[13px] text-faint">{isToday ? (filled ? `${filled} of 3 written` : "today's report") : longDate(fromKey(date))}</span>
        <Kbd className="ml-auto">A</Kbd>
        <ChevronDown size={16} className={cn("text-muted transition-transform duration-200 ease-[var(--ease-out)]", open && "rotate-180")} />
      </button>
      <div id="agenda-body" className={cn("grid transition-[grid-template-rows] duration-250 ease-[var(--ease-out)] motion-reduce:transition-none", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div ref={bodyRef} className="px-5 pb-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] text-muted">{longDate(fromKey(date))}</span>
              <div className="flex items-center gap-0.5">
                <button className="press grid size-7 place-items-center rounded-full hover:bg-raised" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>
                  <ChevronLeft size={15} />
                </button>
                <button
                  className="press grid size-7 place-items-center rounded-full hover:bg-raised disabled:opacity-30"
                  aria-label="Next day"
                  disabled={isToday}
                  onClick={() => setDate(addDays(date, 1))}
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
            <div className="grid gap-2">
              {PROMPTS.map((p) => (
                <label key={p.key} className="block">
                  <span className="mb-1 block text-[12px] text-faint">{p.label}</span>
                  <textarea
                    value={entry[p.key]}
                    onChange={(e) => actions.setAgenda(date, { [p.key]: e.target.value })}
                    placeholder={p.placeholder}
                    rows={2}
                    className="w-full resize-none rounded-[10px] border border-border bg-raised px-2.5 py-1.5 text-[13px] leading-[18px] outline-none transition-colors focus:border-sand"
                  />
                </label>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-faint">Saves as you type. Past reports live in Notes.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
