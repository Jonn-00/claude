"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Hold to confirm (Emil Kowalski's hold-to-delete): a fill sweeps across
 * while you hold, slow and linear because you're deciding; letting go snaps
 * it back fast. Replaces a confirm() dialog for actions that can't be undone.
 */
export function HoldButton({ children, onConfirm, className, ms = 1600 }: { children: React.ReactNode; onConfirm: () => void; className?: string; ms?: number }) {
  const [holding, setHolding] = useState(false);
  const start = () => setHolding(true);
  const stop = () => setHolding(false);
  return (
    <button
      type="button"
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={stop}
      onBlur={stop}
      className={cn("press relative isolate overflow-hidden select-none", className)}
    >
      <span
        aria-hidden
        className="absolute inset-0 -z-10 bg-ember-tint"
        style={{
          clipPath: holding ? "inset(0 0 0 0)" : "inset(0 100% 0 0)",
          transition: holding ? `clip-path ${ms}ms linear` : "clip-path 200ms var(--ease-out)",
        }}
        onTransitionEnd={() => {
          if (holding) {
            setHolding(false);
            onConfirm();
          }
        }}
      />
      {children}
    </button>
  );
}
