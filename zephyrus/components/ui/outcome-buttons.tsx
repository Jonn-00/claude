"use client";

import { useRef, useState } from "react";
import { Check } from "lucide-react";
import type { Outcome } from "@/lib/types";
import { OUTCOME_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";

const OUTCOMES: Outcome[] = ["noanswer", "talked", "interested", "demo", "won"];

/**
 * The five results of a dial, each with today's count. A press confirms
 * itself: the label blurs into a check and back, so you can keep your eyes
 * on the phone.
 */
export function OutcomeButtons({ counts, onLog, size = "sm", className }: { counts: Record<Outcome, number>; onLog: (o: Outcome) => void; size?: "sm" | "lg"; className?: string }) {
  const [flash, setFlash] = useState<Outcome | null>(null);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  return (
    <div className={cn("grid gap-1.5", size === "lg" ? "grid-cols-2 gap-2 sm:grid-cols-3" : "grid-cols-[repeat(auto-fill,minmax(104px,1fr))]", className)}>
      {OUTCOMES.map((o) => {
        const done = flash === o;
        return (
          <button
            key={o}
            onClick={() => {
              onLog(o);
              setFlash(o);
              clearTimeout(t.current);
              t.current = setTimeout(() => setFlash(null), 700);
            }}
            className={cn(
              "press relative flex items-center justify-between gap-2 overflow-hidden border text-left whitespace-nowrap",
              size === "lg" ? "h-11 rounded-[12px] px-3.5 text-[14px]" : "h-8 rounded-full pr-2 pl-3 text-[13px]",
              o === "noanswer" ? "border-control text-muted hover:text-text" : "border-control text-text hover:border-sand hover:bg-raised",
              done && "border-ember/60 bg-ember-tint",
            )}
          >
            <span className={cn("transition-[filter,opacity] duration-200", done ? "opacity-0 blur-[3px]" : "opacity-100 blur-0")}>{OUTCOME_LABEL[o]}</span>
            <span
              aria-hidden
              className={cn(
                "absolute inset-0 grid place-items-center text-ember-soft transition-[filter,opacity,transform] duration-200 ease-[var(--ease-out)]",
                done ? "scale-100 opacity-100 blur-0" : "scale-90 opacity-0 blur-[3px]",
              )}
            >
              <Check size={16} strokeWidth={2.5} />
            </span>
            <span className={cn("num text-[12px] transition-opacity duration-200", done ? "opacity-0" : counts[o] ? "text-faint" : "text-faint/50")}>{counts[o]}</span>
          </button>
        );
      })}
    </div>
  );
}
