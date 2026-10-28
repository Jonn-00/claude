"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";
import type { State } from "@/lib/types";
import { NICHE_LABEL } from "@/lib/types";
import { stageLabel } from "@/lib/stages";
import { cn } from "@/lib/utils";

type Item = { id: string; group: string; label: string; hint?: string; run: () => void };

/** Opened from the keyboard many times a day, so it appears instantly: no animation. */
export function CommandPalette({ state, onClose, onQuickAdd }: { state: State; onClose: () => void; onQuickAdd: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);

  const all = useMemo<Item[]>(() => {
    const go = (href: string) => () => {
      router.push(href);
      onClose();
    };
    const ch = Object.fromEntries(state.channels.map((c) => [c.id, c.name]));
    return [
      { id: "p-today", group: "Go to", label: "Today", run: go("/") },
      { id: "p-ch", group: "Go to", label: "Channels", run: go("/channels") },
      { id: "p-ag", group: "Go to", label: "Agency", run: go("/agency") },
      { id: "p-pl", group: "Go to", label: "Planner", run: go("/planner") },
      { id: "p-no", group: "Go to", label: "Notes", run: go("/notes") },
      { id: "a-add", group: "Do", label: "Quick add a reminder, block, lead, idea or note", hint: "N", run: onQuickAdd },
      { id: "a-log", group: "Do", label: "Log a dial", run: go("/agency#log") },
      ...state.videos.map((v) => ({ id: v.id, group: "Videos", label: v.title, hint: `${ch[v.channelId]} · ${stageLabel(state, v.stage)}`, run: go("/channels#production") })),
      ...state.leads.map((l) => ({ id: l.id, group: "Leads", label: l.business, hint: `${l.contact} · ${NICHE_LABEL[l.niche]}`, run: go(`/agency?lead=${l.id}`) })),
      ...state.notes.map((n) => ({ id: n.id, group: "Notes", label: n.text.slice(0, 80), run: go("/notes") })),
    ];
  }, [state, router, onClose, onQuickAdd]);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = t ? all.filter((i) => (i.label + " " + (i.hint ?? "")).toLowerCase().includes(t)) : all.filter((i) => i.group === "Go to" || i.group === "Do");
    return list.slice(0, 12);
  }, [all, q]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(results.length - 1, s + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      results[sel]?.run();
    }
  };

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-4 pt-[12vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Search"
        className="w-full max-w-[560px] overflow-hidden rounded-[16px] border border-control bg-raised shadow-[0_30px_80px_-20px_rgb(0_0_0/0.9)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-control/60 px-4">
          <Search size={16} className="text-faint" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={onKey}
            placeholder="Search videos, leads, notes, or jump to a page"
            aria-label="Search"
            className="h-12 flex-1 bg-transparent text-[15px] outline-none"
          />
        </div>
        <ul role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
          {results.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-muted">Nothing matches “{q}”.</li>}
          {results.map((r, i) => {
            const head = r.group !== lastGroup;
            lastGroup = r.group;
            return (
              <li key={r.id}>
                {head && <div className="px-3 pt-2.5 pb-1 text-[12px] text-faint">{r.group}</div>}
                <button
                  role="option"
                  aria-selected={i === sel}
                  onMouseMove={() => setSel(i)}
                  onClick={r.run}
                  className={cn("flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[14px]", i === sel ? "bg-active" : "")}
                >
                  <span className="min-w-0 flex-1 truncate">{r.label}</span>
                  {r.hint && <span className="shrink-0 truncate text-[12px] text-faint">{r.hint}</span>}
                  {i === sel && <CornerDownLeft size={14} className="shrink-0 text-faint" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
