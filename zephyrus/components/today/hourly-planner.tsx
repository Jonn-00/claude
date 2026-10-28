"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { actions } from "@/lib/store";
import type { BlockKind, PlanBlock, State } from "@/lib/types";
import { KIND_LABEL } from "@/lib/types";
import { addDays, dayKey, fromKey, hhmm, minutesOf, weekday } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/panel";
import { notify, removeWithUndo } from "@/components/ui/notify";
import { EditableTitle } from "@/components/ui/editable-title";

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
      data-day={date}
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
            pitch={pitch}
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
            initial={{ title: "", kind: "youtube", start: draft.start, end: draft.end }}
            onCancel={() => {
              setDraft(null);
              setNewOpen(false);
            }}
            onSave={(title, kind, start, end) => {
              actions.addBlock({ date, start, end, title, kind });
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

/**
 * A block you can click to edit, drag to move (snapping to 15 minutes, across
 * days on the week view) or stretch from its bottom edge. The preview moves by
 * transform; the saved time changes only when you let go.
 */
function BlockView({ b, pitch, live, past, open, setOpen }: { b: PlanBlock; pitch: number; live: boolean; past: boolean; open: boolean; setOpen: (o: boolean) => void }) {
  const [drag, setDrag] = useState<{ start: number; end: number; date: string; dx: number } | null>(null);
  const g = useRef<{ x: number; y: number; mode: "move" | "resize"; active: boolean; colLeft: number; id: number } | null>(null);
  const moved = useRef(false);
  const Y = (m: number) => ((m - FROM) / 60) * pitch;
  const cur = drag ?? { start: b.start, end: b.end, date: b.date, dx: 0 };
  const top = Y(cur.start);
  const height = Math.max(18, Y(cur.end) - Y(cur.start) - 2);

  const down = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || e.pointerType === "touch") return;
    const r = e.currentTarget.getBoundingClientRect();
    const col = e.currentTarget.closest("[data-day]") as HTMLElement | null;
    g.current = { x: e.clientX, y: e.clientY, mode: r.bottom - e.clientY < 8 ? "resize" : "move", active: false, colLeft: col?.getBoundingClientRect().left ?? 0, id: e.pointerId };
  };
  const move = (e: React.PointerEvent<HTMLButtonElement>) => {
    const s = g.current;
    if (!s) return;
    if (!s.active) {
      if (Math.abs(e.clientY - s.y) < 4 && Math.abs(e.clientX - s.x) < 4) return;
      s.active = true;
      e.currentTarget.setPointerCapture(s.id);
      setOpen(false);
    }
    const dm = snap(((e.clientY - s.y) / pitch) * 60);
    if (s.mode === "resize") {
      setDrag({ start: b.start, end: Math.min(TO, Math.max(b.start + 15, b.end + dm)), date: b.date, dx: 0 });
      return;
    }
    const len = b.end - b.start;
    const start = Math.max(FROM, Math.min(TO - len, b.start + dm));
    // Which day is under the pointer (the week view has seven columns).
    const under = document.elementsFromPoint(e.clientX, e.clientY).find((el) => (el as HTMLElement).dataset?.day) as HTMLElement | undefined;
    const date = under?.dataset.day ?? b.date;
    const dx = under ? under.getBoundingClientRect().left - s.colLeft : 0;
    setDrag({ start, end: start + len, date, dx });
  };
  const up = () => {
    const s = g.current;
    g.current = null;
    if (!s?.active || !drag) {
      setDrag(null);
      return;
    }
    moved.current = true;
    const before = { start: b.start, end: b.end, date: b.date };
    const after = { start: drag.start, end: drag.end, date: drag.date };
    setDrag(null);
    if (before.start === after.start && before.end === after.end && before.date === after.date) return;
    actions.updateBlock(b.id, after);
    const day = after.date === before.date ? "" : ` on ${weekday(fromKey(after.date))}`;
    notify(s.mode === "resize" ? `Now ends at ${hhmm(after.end)}` : `Moved to ${hhmm(after.start)}${day}`, {
      detail: b.title,
      undo: () => actions.updateBlock(b.id, before),
    });
  };

  return (
    <>
      <button
        data-block
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => {
          g.current = null;
          setDrag(null);
        }}
        onClick={() => {
          if (moved.current) {
            moved.current = false;
            return;
          }
          setOpen(!open);
        }}
        aria-label={`${b.title}, ${hhmm(b.start)} to ${hhmm(b.end)}, ${KIND_LABEL[b.kind]}`}
        className={cn(
          "group/block absolute inset-x-0 overflow-hidden rounded-[8px] border px-2 text-left hover:border-sand md:cursor-grab",
          blockClass[b.kind],
          live && "lit",
          past && !live && !drag && "opacity-55",
          drag ? "z-30 cursor-grabbing border-sand shadow-[0_16px_34px_-14px_rgb(0_0_0/0.95)]" : "press transition-[top,height] duration-200 ease-[var(--ease-out)]",
        )}
        style={{ top, height, transform: drag ? `translateX(${drag.dx}px)` : undefined }}
      >
        <span className={cn("block truncate text-[13px] leading-4", height < 30 ? "pt-0.5" : "pt-1")}>
          {b.title}
          {height < 30 && <span className="num ml-1.5 text-[12px] text-muted">{hhmm(cur.start)}</span>}
        </span>
        {height >= 30 && (
          <span className={cn("num block text-[12px] leading-4", drag ? "text-text" : "text-muted")}>
            {hhmm(cur.start)}–{hhmm(cur.end)}
          </span>
        )}
        <span aria-hidden className="absolute inset-x-3 bottom-0.5 hidden h-[3px] cursor-ns-resize rounded-full bg-sand/0 transition-colors group-hover/block:bg-sand/50 md:block" />
      </button>
      {open && (
        <BlockEditor
          top={top + height + 4}
          initial={{ title: b.title, kind: b.kind, start: b.start, end: b.end }}
          onCancel={() => setOpen(false)}
          onSave={(title, kind, start, end) => {
            actions.updateBlock(b.id, { title, kind, start, end });
            setOpen(false);
          }}
          onDelete={() => {
            setOpen(false);
            removeWithUndo("blocks", b.id, `“${b.title}”`, actions.removeBlock);
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
  initial: { title: string; kind: BlockKind; start: number; end: number };
  onSave: (title: string, kind: BlockKind, start: number, end: number) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [kind, setKind] = useState<BlockKind>(initial.kind);
  const [start, setStart] = useState(hhmm(initial.start));
  const [end, setEnd] = useState(hhmm(initial.end));
  const toMins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
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
        const a = toMins(start);
        const b = Math.max(a + 15, toMins(end));
        if (title.trim()) onSave(title.trim(), kind, a, Math.min(24 * 60, b));
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
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <input type="time" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} aria-label="Starts" className="num h-8 rounded-[8px] border border-control bg-surface px-1.5 text-[12px] outline-none focus:border-sand" />
        <input type="time" value={end} onChange={(e) => e.target.value && setEnd(e.target.value)} aria-label="Ends" className="num h-8 rounded-[8px] border border-control bg-surface px-1.5 text-[12px] outline-none focus:border-sand" />
      </div>
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
        <button type="submit" className={cn("press h-7 rounded-full bg-text px-3 text-[12px] font-medium text-ground", !onDelete && "ml-auto")}>
          Save
        </button>
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
      title={<EditableTitle state={state} k="hourly" fallback="Hourly" />}
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
      className="xl:min-h-[400px] xl:flex-1"
    >
      <div ref={scroller} className="-mr-2 h-[272px] overflow-y-auto pt-2 pr-2 xl:h-auto xl:min-h-0 xl:flex-1 xl:basis-0">
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
