"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, GripVertical, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
import { actions } from "@/lib/store";
import type { ChannelId, Stage, State, Video } from "@/lib/types";
import { FIXED_STAGES } from "@/lib/types";
import { videoUrgency } from "@/lib/derive";
import { stagesOf } from "@/lib/stages";
import { addDays, dayKey, fromKey, relDay, until, DAY } from "@/lib/time";
import { TONE } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/panel";
import { Editable } from "@/components/ui/editable";
import { EditableTitle } from "@/components/ui/editable-title";
import { notify, removeWithUndo } from "@/components/ui/notify";

const field = "h-8 w-full rounded-[8px] border border-control bg-surface px-2 text-[13px] text-text outline-none focus:border-sand";

const toLocal = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/**
 * Every video across the channels, moving left to right through production.
 * Everything here is editable: rename a stage by clicking its name, add or
 * remove stages from its menu, add a video at the foot of any column, click a
 * video to edit it, or drag it to another stage. A packet runs along the line
 * when a video moves, the Ink Orbit flow put to work. Late or due-today
 * videos are lit.
 */
export function ProductionLine({
  state,
  now,
  channel,
  maxPerStage = 2,
  className,
}: {
  state: State;
  now: number;
  channel?: ChannelId | "all";
  maxPerStage?: number;
  className?: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState<Stage | null>(null);
  const [renaming, setRenaming] = useState<Stage | null>(null);
  const [drag, setDrag] = useState<{ id: string; over: Stage | null } | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const pills = useRef<Record<string, HTMLDivElement | null>>({});

  const stages = stagesOf(state);
  const label = (id: Stage) => stages.find((x) => x.id === id)?.label ?? id;
  const videos = state.videos
    .filter((v) => !channel || channel === "all" || v.channelId === channel)
    .filter((v) => v.stage !== "live" || now - new Date(v.liveAt ?? v.publishAt).getTime() < 2 * DAY)
    .sort((a, b) => a.publishAt.localeCompare(b.publishAt));
  const byStage = stages.map((s) => videos.filter((v) => v.stage === s.id));
  const urgent = videos.filter((v) => ["late", "today", "missed"].includes(videoUrgency(v, now)));
  const late = urgent.filter((v) => videoUrgency(v, now) === "late").length;
  const inProgress = videos.filter((v) => v.stage !== "live" && v.stage !== "scheduled").length;
  const ch = Object.fromEntries(state.channels.map((c) => [c.id, c]));

  /** Run a packet from one stage head to another. */
  const fly = useCallback((from: Stage, to: Stage) => {
    const g = grid.current;
    const a = pills.current[from];
    const b = pills.current[to];
    const d = dot.current;
    if (!g || !a || !b || !d || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const gx = g.getBoundingClientRect().left;
    const ax = a.getBoundingClientRect().left + a.offsetWidth / 2 - gx;
    const bx = b.getBoundingClientRect().left + b.offsetWidth / 2 - gx;
    d.animate(
      [
        { transform: `translateX(${ax}px) scale(0.6)`, opacity: 0 },
        { transform: `translateX(${ax}px) scale(1)`, opacity: 1, offset: 0.12 },
        { transform: `translateX(${bx}px) scale(1)`, opacity: 1, offset: 0.88 },
        { transform: `translateX(${bx}px) scale(0.6)`, opacity: 0 },
      ],
      { duration: Math.min(700, 260 + Math.abs(bx - ax) * 0.6), easing: "cubic-bezier(0.77, 0, 0.175, 1)" },
    );
  }, []);

  const move = useCallback(
    (v: Video, to: Stage) => {
      if (v.stage === to) return;
      const from = v.stage;
      actions.setStage(v.id, to);
      fly(from, to);
      notify(`Moved to ${label(to)}`, {
        detail: v.title,
        undo: () => {
          actions.setStage(v.id, from);
          fly(to, from);
        },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fly, stages],
  );

  const removeStage = (id: Stage) => {
    const before = { stages: state.stages, videos: state.videos };
    const name = label(id);
    actions.removeStage(id);
    notify(`Removed the ${name} stage`, { undo: () => actions.restoreStages(before.stages, before.videos) });
  };

  return (
    <Panel
      framed
      title={<EditableTitle state={state} k="production" fallback="Production line" />}
      aside={
        <span className="num">
          {inProgress} in progress
          {urgent.length > 0 && (
            <>
              {" · "}
              <span className="text-ember-soft">
                {late > 0 ? `${late} late, ` : ""}
                {urgent.length - late} due today
              </span>
            </>
          )}
        </span>
      }
      className={className}
    >
      <div className="-mx-5 overflow-x-auto px-5 pt-1 pb-1" data-scroller>
        <div ref={grid} className="relative grid gap-2" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(96px, 1fr))`, minWidth: stages.length * 102 }}>
          {/* The line the work travels along, behind the stage heads. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-4 top-4 h-px border-t border-dashed border-control" />
          <div ref={dot} aria-hidden className="pointer-events-none absolute top-[13px] left-[-4px] z-20 size-2 rounded-full bg-ember opacity-0 shadow-[0_0_0_4px_rgb(255_106_26/0.18)]" />
          {stages.map((stage, si) => {
            const list = byStage[si];
            const show = expanded[stage.id] ? list : list.slice(0, maxPerStage);
            const stageLit = list.some((v) => videoUrgency(v, now) !== "ok");
            const target = !!drag && drag.over === stage.id && state.videos.find((v) => v.id === drag.id)?.stage !== stage.id;
            return (
              <div
                key={stage.id}
                data-stage={stage.id}
                className={cn("group/col flex min-w-0 flex-col gap-1.5 rounded-[14px] outline-offset-4 transition-[background-color,outline-color] duration-150", target && "bg-ember-tint/70 outline-1 outline-ember/50 outline-dashed")}
              >
                <div
                  ref={(el) => {
                    pills.current[stage.id] = el;
                  }}
                  className={cn(
                    "relative z-10 flex h-8 items-center gap-0.5 rounded-full border bg-raised pr-0.5 pl-2.5 text-[12px] transition-colors",
                    stageLit ? "border-ember/45 text-text" : "border-border text-muted",
                    target && "border-ember text-text",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">
                    <Editable
                      value={stage.label}
                      label="Stage name"
                      startEditing={renaming === stage.id}
                      onDone={() => renaming === stage.id && setRenaming(null)}
                      onSave={(v) => actions.renameStage(stage.id, v)}
                      inputClassName="h-6 text-[12px]"
                    />
                  </span>
                  <StageMenu
                    count={list.length}
                    onAddVideo={() => setAdding(stage.id)}
                    name={stage.label}
                    fixed={FIXED_STAGES.includes(stage.id)}
                    canAddAfter={stage.id !== "live" && stage.id !== "scheduled"}
                    onRename={() => setRenaming(stage.id)}
                    onAddAfter={() => setRenaming(actions.addStage(stage.id))}
                    onRemove={() => removeStage(stage.id)}
                  />
                </div>
                {show.map((v) => (
                  <Chip
                    key={v.id}
                    v={v}
                    now={now}
                    state={state}
                    channelName={ch[v.channelId]?.name ?? ""}
                    stageName={label}
                    prev={stages[si - 1]?.id}
                    next={stages[si + 1]?.id}
                    open={open === v.id}
                    setOpen={(o) => setOpen(o ? v.id : null)}
                    dragging={drag?.id === v.id}
                    onDrag={(over) => setDrag(over === undefined ? null : { id: v.id, over })}
                    onDrop={(to) => {
                      setDrag(null);
                      if (to) move(v, to);
                    }}
                    onMove={(to) => move(v, to)}
                  />
                ))}
                {list.length > maxPerStage && (
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, [stage.id]: !e[stage.id] }))}
                    className="press h-7 rounded-full text-[12px] text-muted hover:bg-raised hover:text-text"
                  >
                    {expanded[stage.id] ? "Show less" : `+${list.length - maxPerStage} more`}
                  </button>
                )}
                {adding === stage.id ? (
                  <AddVideo
                    state={state}
                    stage={stage.id}
                    channel={channel && channel !== "all" ? channel : undefined}
                    onDone={() => setAdding(null)}
                  />
                ) : (
                  <button
                    onClick={() => setAdding(stage.id)}
                    className={cn(
                      "press flex items-center justify-center gap-1 rounded-[12px] border border-dashed text-[12px] transition-[color,border-color] hover:border-sand hover:text-text",
                      list.length === 0 ? "h-[58px] border-border text-faint" : "h-8 border-transparent text-faint md:hidden",
                    )}
                  >
                    {drag && list.length === 0 ? (
                      "Drop here"
                    ) : (
                      <>
                        <Plus size={13} /> Add video
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-faint">
        {state.channels.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1.5">
            <i className="size-1.5 rounded-full" style={{ background: TONE[c.id].bg }} />
            {c.name}
          </span>
        ))}
        <span className="ml-auto">Click any name to rename it. Drag videos between stages.</span>
      </div>
    </Panel>
  );
}

function StageMenu({
  count,
  name,
  fixed,
  canAddAfter,
  onAddVideo,
  onRename,
  onAddAfter,
  onRemove,
}: {
  count: number;
  name: string;
  fixed: boolean;
  canAddAfter: boolean;
  onAddVideo: () => void;
  onRename: () => void;
  onAddAfter: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, open, () => setOpen(false));
  return (
    <div ref={ref} className="relative grid h-6 w-5 shrink-0 place-items-center text-[12px]">
      {/* The count, swapped for the stage's menu while you hover the column. */}
      <span className={cn("num transition-opacity md:group-hover/col:opacity-0", count ? "text-text" : "text-faint", open && "opacity-0")}>{count}</span>
      <button
        onClick={() => setOpen(!open)}
        aria-label={`Options for ${name}`}
        aria-expanded={open}
        className="press absolute inset-0 grid place-items-center rounded-full bg-raised text-faint opacity-0 hover:bg-active hover:text-text focus-visible:opacity-100 md:group-hover/col:opacity-100 aria-expanded:opacity-100"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div role="menu" className="pop absolute top-[calc(100%+6px)] right-0 z-40 w-[200px] origin-top-right rounded-[12px] border border-control bg-raised p-1.5 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.9)]">
          <MenuItem
            autoFocus
            onClick={() => {
              setOpen(false);
              onAddVideo();
            }}
          >
            <Plus size={14} /> Add video here
          </MenuItem>
          <MenuItem
            onClick={() => {
              setOpen(false);
              onRename();
            }}
          >
            Rename stage
          </MenuItem>
          {canAddAfter && (
            <MenuItem
              onClick={() => {
                setOpen(false);
                onAddAfter();
              }}
            >
              <Plus size={14} /> Add a stage after this
            </MenuItem>
          )}
          {fixed ? (
            <p className="px-2.5 py-2 text-[12px] leading-4 text-faint">Scheduled and Live are kept so due dates and the Live column work. You can rename them.</p>
          ) : (
            <MenuItem
              className="text-muted"
              onClick={() => {
                setOpen(false);
                onRemove();
              }}
            >
              <Trash2 size={14} /> Remove stage
            </MenuItem>
          )}
        </div>
      )}
    </div>
  );
}

function AddVideo({ state, stage, channel, onDone }: { state: State; stage: Stage; channel?: ChannelId; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [ch, setCh] = useState<ChannelId>(channel ?? (lastChannel.current as ChannelId) ?? state.channels[0].id);
  const ref = useRef<HTMLFormElement>(null);
  useOutside(ref, true, onDone);
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return onDone();
    const d = fromKey(stage === "live" || stage === "scheduled" ? dayKey(Date.now()) : addDays(dayKey(Date.now()), 3));
    d.setHours(17, 0, 0, 0);
    actions.addVideo({ channelId: ch, title: t, stage, publishAt: d.toISOString(), ...(stage === "live" ? { liveAt: new Date().toISOString() } : {}) });
    lastChannel.current = ch;
    setTitle("");
  };
  return (
    <form ref={ref} onSubmit={save} onKeyDown={(e) => e.key === "Escape" && onDone()} className="enter grid gap-1.5 rounded-[12px] border border-control bg-raised p-2">
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Video title" aria-label="New video title" className={field} />
      <select value={ch} onChange={(e) => setCh(e.target.value as ChannelId)} aria-label="Channel" className={field}>
        {state.channels.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] text-faint">Enter adds</span>
        <button type="button" onClick={onDone} className="press grid size-7 place-items-center rounded-full text-faint hover:bg-active hover:text-text" aria-label="Close">
          <X size={13} />
        </button>
      </div>
    </form>
  );
}
const lastChannel: { current: string | null } = { current: null };

function Chip({
  v,
  now,
  state,
  channelName,
  stageName,
  prev,
  next,
  open,
  setOpen,
  dragging,
  onDrag,
  onDrop,
  onMove,
}: {
  v: Video;
  now: number;
  state: State;
  channelName: string;
  stageName: (id: Stage) => string;
  prev?: Stage;
  next?: Stage;
  open: boolean;
  setOpen: (o: boolean) => void;
  dragging: boolean;
  onDrag: (over: Stage | null | undefined) => void;
  onDrop: (to: Stage | null) => void;
  onMove: (to: Stage) => void;
}) {
  const u = videoUrgency(v, now);
  const ref = useRef<HTMLDivElement>(null);
  const ghost = useRef<HTMLElement | null>(null);
  const start = useRef<{ x: number; y: number; dx: number; dy: number; w: number; active: boolean; id: number } | null>(null);
  const justDragged = useRef(false);
  useOutside(ref, open, () => setOpen(false));
  useEffect(() => () => ghost.current?.remove(), []);

  const stageAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest("[data-stage]")?.getAttribute("data-stage") as Stage | null) ?? null;

  const down = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || e.pointerType === "touch") return;
    const r = e.currentTarget.getBoundingClientRect();
    start.current = { x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, active: false, id: e.pointerId };
  };
  const moveP = (e: React.PointerEvent<HTMLButtonElement>) => {
    const s = start.current;
    if (!s) return;
    if (!s.active) {
      if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < 5) return;
      s.active = true;
      e.currentTarget.setPointerCapture(s.id);
      setOpen(false);
      // A clone follows the pointer by transform alone; nothing re-renders per frame.
      const g = e.currentTarget.cloneNode(true) as HTMLElement;
      Object.assign(g.style, {
        position: "fixed",
        left: "0px",
        top: "0px",
        width: s.w + "px",
        pointerEvents: "none",
        zIndex: "60",
        transition: "none",
        boxShadow: "0 22px 50px -18px rgb(0 0 0 / 0.95)",
        background: "var(--active)",
        opacity: "1",
      });
      g.setAttribute("aria-hidden", "true");
      document.body.appendChild(g);
      ghost.current = g;
    }
    ghost.current!.style.transform = `translate(${e.clientX - s.dx}px, ${e.clientY - s.dy}px) rotate(1.5deg) scale(1.03)`;
    const scroller = e.currentTarget.closest("[data-scroller]") as HTMLElement | null;
    if (scroller) {
      const r = scroller.getBoundingClientRect();
      if (e.clientX > r.right - 48) scroller.scrollLeft += 10;
      else if (e.clientX < r.left + 48) scroller.scrollLeft -= 10;
    }
    onDrag(stageAt(e.clientX, e.clientY));
  };
  const up = (e: React.PointerEvent<HTMLButtonElement>) => {
    const s = start.current;
    start.current = null;
    if (!s?.active) return;
    justDragged.current = true;
    ghost.current?.remove();
    ghost.current = null;
    onDrop(stageAt(e.clientX, e.clientY));
  };
  const cancel = () => {
    if (start.current?.active) onDrag(undefined);
    start.current = null;
    ghost.current?.remove();
    ghost.current = null;
  };

  const when =
    u === "late" ? until(v.publishAt, now) : u === "missed" ? "Did it go live?" : v.stage === "live" ? "Live " + relDay(v.liveAt ?? v.publishAt, now).toLowerCase() : relDay(v.publishAt, now);
  return (
    <div ref={ref} className="relative">
      <button
        onPointerDown={down}
        onPointerMove={moveP}
        onPointerUp={up}
        onPointerCancel={cancel}
        onClick={() => {
          if (justDragged.current) {
            justDragged.current = false;
            return;
          }
          setOpen(!open);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={`${channelName}: ${v.title}`}
        aria-label={`${v.title}, ${channelName}, ${stageName(v.stage)}, ${when}. Edit`}
        className={cn(
          "press enter group/chip relative flex w-full flex-col gap-1 rounded-[12px] border bg-raised px-2.5 py-2 text-left hover:border-control md:cursor-grab",
          u === "ok" ? "border-border" : "lit",
          dragging && "opacity-35",
          open && "border-sand",
        )}
      >
        <GripVertical size={12} aria-hidden className="absolute top-2 right-1 hidden text-faint opacity-0 transition-opacity group-hover/chip:opacity-100 md:block" />
        <i aria-hidden className="absolute top-[13px] left-2.5 size-1.5 rounded-full" style={{ background: TONE[v.channelId].bg }} />
        <span className="line-clamp-3 pr-2 pl-3 text-[12px] leading-4 text-text">{v.title}</span>
        <span className={cn("num pl-3 text-[11px] leading-4", u === "ok" ? "text-faint" : "text-ember-soft")}>{when}</span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={`Edit ${v.title}`}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          className="pop absolute top-[calc(100%+6px)] left-0 z-40 grid w-[260px] origin-top-left gap-2 rounded-[14px] border border-control bg-raised p-3 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.9)]"
        >
          <label className="grid gap-1 text-[11px] text-faint">
            Title
            <textarea
              defaultValue={v.title}
              rows={2}
              onBlur={(e) => {
                const t = e.target.value.trim();
                if (t && t !== v.title) actions.updateVideo(v.id, { title: t });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  (e.target as HTMLTextAreaElement).blur();
                }
              }}
              className="w-full resize-none rounded-[8px] border border-control bg-surface px-2 py-1.5 text-[13px] leading-[18px] text-text outline-none focus:border-sand"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-[11px] text-faint">
              Channel
              <select value={v.channelId} onChange={(e) => actions.updateVideo(v.id, { channelId: e.target.value as ChannelId })} className={field}>
                {state.channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[11px] text-faint">
              Stage
              <select value={v.stage} onChange={(e) => onMove(e.target.value)} className={field}>
                {stagesOf(state).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="grid gap-1 text-[11px] text-faint">
            Goes live
            <input
              type="datetime-local"
              value={toLocal(v.publishAt)}
              onChange={(e) => e.target.value && actions.updateVideo(v.id, { publishAt: new Date(e.target.value).toISOString() })}
              className={field + " num"}
            />
          </label>
          <div className="flex items-center gap-1 pt-1">
            {prev && (
              <button onClick={() => onMove(prev)} className="press inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px] text-muted hover:bg-active hover:text-text">
                <ArrowLeft size={13} /> {stageName(prev)}
              </button>
            )}
            {next && (
              <button onClick={() => onMove(next)} className="press inline-flex h-8 items-center gap-1 rounded-full bg-text px-2.5 text-[12px] font-medium text-ground">
                {stageName(next)} <ArrowRight size={13} />
              </button>
            )}
            <button
              onClick={() => {
                setOpen(false);
                removeWithUndo("videos", v.id, `“${v.title}”`, actions.removeVideo);
              }}
              aria-label={`Delete ${v.title}`}
              className="press ml-auto grid size-8 place-items-center rounded-full text-faint hover:bg-active hover:text-text"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ className, ...rest }: React.ComponentProps<"button">) {
  return <button role="menuitem" className={cn("flex h-9 w-full items-center gap-2 rounded-[8px] px-2.5 text-left text-[13px] hover:bg-active focus-visible:bg-active", className)} {...rest} />;
}

/** Closes a popover on a click outside it or on Escape. */
function useOutside(ref: React.RefObject<HTMLElement | null>, active: boolean, close: () => void) {
  useEffect(() => {
    if (!active) return;
    const off = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    const t = setTimeout(() => window.addEventListener("pointerdown", off), 0);
    window.addEventListener("keydown", esc);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", off);
      window.removeEventListener("keydown", esc);
    };
  }, [ref, active, close]);
}
