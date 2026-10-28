"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, GripVertical, Trash2 } from "lucide-react";
import { actions } from "@/lib/store";
import type { ChannelId, Stage, State, Video } from "@/lib/types";
import { STAGES, STAGE_LABEL } from "@/lib/types";
import { videoUrgency } from "@/lib/derive";
import { relDay, until, DAY } from "@/lib/time";
import { TONE } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/panel";
import { notify, removeWithUndo } from "@/components/ui/notify";

/**
 * Every video across the channels, moving left to right through production.
 * Drag a video onto another stage (or click it for the menu); a packet runs
 * along the line from where it was to where it went, the Ink Orbit flow put
 * to work. Anything late or due today is lit.
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
  const [drag, setDrag] = useState<{ id: string; over: Stage | null } | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const pills = useRef<Partial<Record<Stage, HTMLDivElement | null>>>({});

  const videos = state.videos
    .filter((v) => !channel || channel === "all" || v.channelId === channel)
    .filter((v) => v.stage !== "live" || now - new Date(v.liveAt ?? v.publishAt).getTime() < 2 * DAY)
    .sort((a, b) => a.publishAt.localeCompare(b.publishAt));
  const byStage = STAGES.map((s) => videos.filter((v) => v.stage === s));
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
      notify(`Moved to ${STAGE_LABEL[to]}`, {
        detail: v.title,
        undo: () => {
          actions.setStage(v.id, from);
          fly(to, from);
        },
      });
    },
    [fly],
  );

  return (
    <Panel
      framed
      title="Production line"
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
        <div ref={grid} className="relative grid min-w-[760px] grid-cols-7 gap-2">
          {/* The line the work travels along, behind the stage heads. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-4 top-4 h-px border-t border-dashed border-control" />
          <div ref={dot} aria-hidden className="pointer-events-none absolute top-[13px] left-[-4px] z-20 size-2 rounded-full bg-ember opacity-0 shadow-[0_0_0_4px_rgb(255_106_26/0.18)]" />
          {STAGES.map((stage, si) => {
            const list = byStage[si];
            const show = expanded[stage] ? list : list.slice(0, maxPerStage);
            const stageLit = list.some((v) => videoUrgency(v, now) !== "ok");
            const target = !!drag && drag.over === stage && state.videos.find((v) => v.id === drag.id)?.stage !== stage;
            return (
              <div
                key={stage}
                data-stage={stage}
                className={cn("flex min-w-0 flex-col gap-1.5 rounded-[14px] outline-offset-4 transition-[background-color,outline-color] duration-150", target && "bg-ember-tint/70 outline-1 outline-ember/50 outline-dashed")}
              >
                <div
                  ref={(el) => {
                    pills.current[stage] = el;
                  }}
                  className={cn(
                    "relative z-10 flex h-8 items-center justify-between rounded-full border bg-raised px-3 text-[13px] transition-colors",
                    stageLit ? "border-ember/45 text-text" : "border-border text-muted",
                    target && "border-ember text-text",
                  )}
                >
                  <span className="truncate">{STAGE_LABEL[stage]}</span>
                  <span className={cn("num", list.length ? "text-text" : "text-faint")}>{list.length}</span>
                </div>
                {list.length === 0 && (
                  <div className="grid h-[58px] place-items-center rounded-[12px] border border-dashed border-border text-[12px] text-faint">{drag ? "Drop here" : "Empty"}</div>
                )}
                {show.map((v) => (
                  <Chip
                    key={v.id}
                    v={v}
                    now={now}
                    channelName={ch[v.channelId]?.name ?? ""}
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
                    onClick={() => setExpanded((e) => ({ ...e, [stage]: !e[stage] }))}
                    className="press h-7 rounded-full text-[12px] text-muted hover:bg-raised hover:text-text"
                  >
                    {expanded[stage] ? "Show less" : `+${list.length - maxPerStage} more`}
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
        <span className="ml-auto">Drag a video to another stage, or click it</span>
      </div>
    </Panel>
  );
}

function Chip({
  v,
  now,
  channelName,
  open,
  setOpen,
  dragging,
  onDrag,
  onDrop,
  onMove,
}: {
  v: Video;
  now: number;
  channelName: string;
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

  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", off);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", off);
      window.removeEventListener("keydown", esc);
    };
  }, [open, setOpen]);

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

  const idx = STAGES.indexOf(v.stage);
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
        aria-haspopup="menu"
        title={`${channelName}: ${v.title}`}
        aria-label={`${v.title}, ${channelName}, ${STAGE_LABEL[v.stage]}, ${when}`}
        className={cn(
          "press enter group/chip relative flex w-full flex-col gap-1 rounded-[12px] border bg-raised px-2.5 py-2 text-left hover:border-control md:cursor-grab",
          u === "ok" ? "border-border" : "lit",
          dragging && "opacity-35",
        )}
      >
        <GripVertical size={12} aria-hidden className="absolute top-2 right-1 hidden text-faint opacity-0 transition-opacity group-hover/chip:opacity-100 md:block" />
        <i aria-hidden className="absolute top-[13px] left-2.5 size-1.5 rounded-full" style={{ background: TONE[v.channelId].bg }} />
        <span className="line-clamp-3 pr-2 pl-3 text-[12px] leading-4 text-text">{v.title}</span>
        <span className={cn("num pl-3 text-[11px] leading-4", u === "ok" ? "text-faint" : "text-ember-soft")}>{when}</span>
      </button>
      {open && (
        <div role="menu" className="pop absolute top-[calc(100%+6px)] left-0 z-30 w-[220px] origin-top-left rounded-[12px] border border-control bg-raised p-1.5 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.9)]">
          {idx < STAGES.length - 1 && (
            <MenuItem
              autoFocus
              onClick={() => {
                onMove(STAGES[idx + 1]);
                setOpen(false);
              }}
            >
              <ArrowRight size={14} /> Move to {STAGE_LABEL[STAGES[idx + 1]]}
            </MenuItem>
          )}
          {idx > 0 && (
            <MenuItem
              onClick={() => {
                onMove(STAGES[idx - 1]);
                setOpen(false);
              }}
            >
              <ArrowLeft size={14} /> Back to {STAGE_LABEL[STAGES[idx - 1]]}
            </MenuItem>
          )}
          <MenuItem
            onClick={() => {
              setOpen(false);
              removeWithUndo("videos", v.id, `“${v.title}”`, actions.removeVideo);
            }}
            className="text-muted"
          >
            <Trash2 size={14} /> Remove
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({ className, ...rest }: React.ComponentProps<"button">) {
  return <button role="menuitem" className={cn("flex h-9 w-full items-center gap-2 rounded-[8px] px-2.5 text-left text-[13px] hover:bg-active focus-visible:bg-active", className)} {...rest} />;
}
