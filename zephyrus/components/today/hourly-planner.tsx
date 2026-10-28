"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { actions } from "@/lib/store";
import type { BlockKind, PlanBlock, State } from "@/lib/types";
import { KIND_LABEL } from "@/lib/types";
import { addDays, dayKey, fromKey, hhmm, minutesOf, weekday } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/panel";

const FROM = 6 * 60;
const TO = 24 * 60;
const snap = (m: number) => Math.round(m / 15) * 15;

export const blockClass: Record<BlockKind, string> = {
  youtube: "bg-[#3a2a1e] border-transparent",
  agency: "bg-surface border-control",
  personal: "bg-raised border-transparent hatch",
};

/**
 * A day of blocks. Drag down an empty stretch to add one; click a block to
 * rename, recolour or remove it. Kinds read by fill, outline and hatch.
 */
export function DayColumn({
  state,
  date,
  now,
  pitch,
  showHours = true,
  className,
}: {
  state: State;
  date: string;
  now: number;
  pitch: number;
  showHours?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<{ start: number; end: number; anchor: number } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const blocks = state.blocks.filter((b) => b.date === date).sort((a, b) => a.start - b.start);
  const isToday = date === dayKey(now);
  const nowM = minutesOf(now);
  const Y = (m: number) => ((m - FROM) / 60) * pitch;
  const toM = (y: number) => Math.max(FROM, Math.min(TO, FROM + (y / pitch) * 60));

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("[data-block],[data-editor]")) return;
    const r = e.currentTarget.getBoundingClientRect();
    const m = snap(toM(e.clientY - r.top) - 7);
    e.currentTarget.setPointerCapture(e.pointerId);
    setEditing(null);
    setNewOpen(false);
    setDraft({ start: m, end: Math.min(TO, m + 30), anchor: m });
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draft || newOpen) return;
    const r = e.currentTarget.getBoundingClientRect();
    const m = snap(toM(e.clientY - r.top));
    setDraft((d) => (d ? (m >= d.anchor ? { ...d, start: d.anchor, end: Math.max(d.anchor + 15, m) } : { ...d, start: m, end: d.anchor + 15 }) : d));
  };
  const up = () => {
    if (draft && !newOpen) setNewOpen(true);
  };

  return (
    <div
      ref={ref}
      className={cn("relative touch-pan-x select-none", className)}
      style={{ height: Y(TO) }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
    >
      {Array.from({ length: (TO - FROM) / 60 }, (_, i) => FROM / 60 + i).map((h) => (
        <div key={h} className="absolute inset-x-0 border-t border-rule" style={{ top: Y(h * 60) }}>
          {showHours && <span className="num absolute -top-2 left-0 bg-surface pr-1.5 text-[11px] leading-4 text-faint">{String(h).padStart(2, "0")}</span>}
        </div>
      ))}
      <div className={cn("absolute inset-y-0 right-0", showHours ? "left-8" : "left-0")}>
        {blocks.map((b) => (
          <BlockView
            key={b.id}
            b={b}
            top={Y(b.start)}
            height={Math.max(18, Y(b.end) - Y(b.start) - 2)}
            live={isToday && nowM >= b.start && nowM < b.end}
            past={isToday ? b.end <= nowM : date < dayKey(now)}
            open={editing === b.id}
            setOpen={(o) => {
              setDraft(null);
              setNewOpen(false);
              setEditing(o ? b.id : null);
            }}
          />
        ))}
        {draft && (
          <div className="absolute inset-x-0 rounded-[8px] border border-dashed border-sand bg-raised/70" style={{ top: Y(draft.start), height: Math.max(16, Y(draft.end) - Y(draft.start) - 2) }}>
            <span className="num px-2 text-[11px] text-muted">
              {hhmm(draft.start)}–{hhmm(draft.end)}
            </span>
          </div>
        )}
        {draft && newOpen && (
          <BlockEditor
            top={Y(draft.end) + 4}
            initial={{ title: "", kind: "youtube" }}
            onCancel={() => {
              setDraft(null);
              setNewOpen(false);
            }}
            onSave={(title, kind) => {
              actions.addBlock({ date, start: draft.start, end: draft.end, title, kind });
              setDraft(null);
              setNewOpen(false);
            }}
          />
        )}
        {isToday && nowM >= FROM && nowM < TO && (
          <div className="pointer-events-none absolute -left-1 right-0 z-20 flex items-center" style={{ top: Y(nowM) - 4 }} aria-label={`Now, ${hhmm(nowM)}`}>
            <span className="size-2 rounded-full bg-ember" />
            <span className="h-px flex-1 bg-ember" />
          </div>
        )}
      </div>
    </div>
  );
}

function BlockView({ b, top, height, live, past, open, setOpen }: { b: PlanBlock; top: number; height: number; live: boolean; past: boolean; open: boolean; setOpen: (o: boolean) => void }) {
  return (
    <>
      <button
        data-block
        onClick={() => setOpen(!open)}
        aria-label={`${b.title}, ${hhmm(b.start)} to ${hhmm(b.end)}, ${KIND_LABEL[b.kind]}`}
        className={cn(
          "press absolute inset-x-0 overflow-hidden rounded-[8px] border px-2 text-left hover:border-sand",
          blockClass[b.kind],
          live && "lit",
          past && !live && "opacity-55",
        )}
        style={{ top, height }}
      >
        <span className={cn("block truncate text-[13px] leading-4", height < 30 ? "pt-0.5" : "pt-1")}>
          {b.title}
          {height < 30 && <span className="num ml-1.5 text-[12px] text-muted">{hhmm(b.start)}</span>}
        </span>
        {height >= 30 && (
          <span className="num block text-[12px] leading-4 text-muted">
            {hhmm(b.start)}–{hhmm(b.end)}
          </span>
        )}
      </button>
      {open && (
        <BlockEditor
          top={top + height + 4}
          initial={{ title: b.title, kind: b.kind }}
          onCancel={() => setOpen(false)}
          onSave={(title, kind) => {
            actions.updateBlock(b.id, { title, kind });
            setOpen(false);
          }}
          onDelete={() => {
            actions.removeBlock(b.id);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function BlockEditor({
  top,
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  top: number;
  initial: { title: string; kind: BlockKind };
  onSave: (title: string, kind: BlockKind) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [kind, setKind] = useState<BlockKind>(initial.kind);
  const box = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const off = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) onCancel();
    };
    const t = setTimeout(() => window.addEventListener("pointerdown", off), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", off);
    };
  }, [onCancel]);
  return (
    <form
      ref={box}
      data-editor
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) onSave(title.trim(), kind);
      }}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      onPointerDown={(e) => e.stopPropagation()}
      className="pop absolute inset-x-0 z-30 origin-top rounded-[12px] border border-control bg-raised p-2 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.9)]"
      style={{ top }}
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What's this block for?"
        aria-label="Block title"
        className="h-8 w-full rounded-[8px] border border-control bg-surface px-2 text-[13px] outline-none focus:border-sand"
      />
      <div className="mt-2 flex items-center gap-1">
        {(Object.keys(KIND_LABEL) as BlockKind[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={cn("press h-7 rounded-full px-2.5 text-[12px]", kind === k ? "bg-active text-text" : "text-muted hover:text-text")}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
        {onDelete && (
          <button type="button" onClick={onDelete} aria-label="Delete block" className="press ml-auto grid size-7 place-items-center rounded-full text-muted hover:bg-active hover:text-text">
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </form>
  );
}

/** The compact right-rail planner on Today. */
export function HourlyPlanner({ state, now }: { state: State; now: number }) {
  const [date, setDate] = useState(dayKey(now));
  const scroller = useRef<HTMLDivElement>(null);
  const pitch = 44;
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const m = date === dayKey(now) ? minutesOf(now) - 90 : 8 * 60;
    el.scrollTop = Math.max(0, ((m - FROM) / 60) * pitch);
    // only when the day changes, not on every tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);
  const isToday = date === dayKey(now);
  return (
    <Panel
      title="Hourly"
      aside={
        <div className="flex items-center gap-1">
          <button className="press grid size-7 place-items-center rounded-full hover:bg-raised" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>
            <ChevronLeft size={15} />
          </button>
          <button className="press h-7 rounded-full px-2 text-[13px] hover:bg-raised" onClick={() => setDate(dayKey(now))} aria-label="Go to today">
            {isToday ? "Today" : `${weekday(fromKey(date))} ${fromKey(date).getDate()}`}
          </button>
          <button className="press grid size-7 place-items-center rounded-full hover:bg-raised" aria-label="Next day" onClick={() => setDate(addDays(date, 1))}>
            <ChevronRight size={15} />
          </button>
        </div>
      }
      bodyClassName="pb-3"
    >
      <div ref={scroller} className="-mr-2 h-[272px] overflow-y-auto pt-2 pr-2">
        <DayColumn state={state} date={date} now={now} pitch={pitch} />
      </div>
      <div className="mt-2.5 flex items-center gap-2.5 text-[12px] whitespace-nowrap text-faint">
        {(Object.keys(KIND_LABEL) as BlockKind[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <i className={cn("inline-block h-2.5 w-3.5 rounded-[3px] border", blockClass[k])} />
            {KIND_LABEL[k]}
          </span>
        ))}
        <span className="ml-auto">Drag to add</span>
      </div>
    </Panel>
  );
}
