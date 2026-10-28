"use client";

import { Toaster, toast } from "sonner";
import { Undo2, X } from "lucide-react";
import { actions, locate } from "@/lib/store";

/*
  Headless Sonner: Sonner keeps the stacking, swipe and timers, the toast
  itself is ours. Every destructive action gets an Undo here instead of a
  confirm() dialog.
*/

export function AppToaster() {
  return <Toaster position="bottom-right" theme="dark" offset={24} mobileOffset={16} visibleToasts={3} gap={8} />;
}

export function notify(message: string, opts: { undo?: () => void; detail?: string; duration?: number } = {}) {
  return toast.custom(
    (t) => (
      <div className="flex w-[min(360px,calc(100vw-32px))] items-center gap-3 rounded-[14px] border border-control bg-raised py-2.5 pr-2 pl-4 font-sans text-[13px] text-text shadow-[0_18px_40px_-16px_rgb(0_0_0/0.9)]">
        <div className="min-w-0 flex-1">
          <div className="truncate">{message}</div>
          {opts.detail && <div className="truncate text-[12px] text-faint">{opts.detail}</div>}
        </div>
        {opts.undo && (
          <button
            onClick={() => {
              opts.undo!();
              toast.dismiss(t);
            }}
            className="press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-text px-3 text-[13px] font-medium text-ground"
          >
            <Undo2 size={13} /> Undo
          </button>
        )}
        <button onClick={() => toast.dismiss(t)} aria-label="Dismiss" className="press grid size-8 shrink-0 place-items-center rounded-full text-faint hover:bg-active hover:text-text">
          <X size={14} />
        </button>
      </div>
    ),
    { duration: opts.duration ?? 5000 },
  );
}

type Coll = "videos" | "leads" | "blocks" | "reminders" | "notes";

/** Delete now, offer it back for five seconds. */
export function removeWithUndo(key: Coll, id: string, label: string, remove: (id: string) => void) {
  const where = locate(key, id);
  remove(id);
  notify(`Deleted ${label}`, { undo: where ? () => actions.restore(key, where.item as never, where.index) : undefined });
}
