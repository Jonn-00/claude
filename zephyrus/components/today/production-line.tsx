"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Trash2 } from "lucide-react";
import { actions } from "@/lib/store";
import type { ChannelId, State, Video } from "@/lib/types";
import { STAGES, STAGE_LABEL } from "@/lib/types";
import { videoUrgency } from "@/lib/derive";
import { relDay, until, DAY } from "@/lib/time";
import { TONE } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/panel";

/**
 * Every video across the channels, moving left to right through production.
 * The line between stations is the Ink Orbit flow: dashes march and packets
 * travel while you're looking at it. Anything late or due today is lit.
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
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const reduce = useReducedMotionFlag();

  const videos = state.videos
    .filter((v) => !channel || channel === "all" || v.channelId === channel)
    .filter((v) => v.stage !== "live" || now - new Date(v.liveAt ?? v.publishAt).getTime() < 2 * DAY)
    .sort((a, b) => a.publishAt.localeCompare(b.publishAt));
  const byStage = STAGES.map((s) => videos.filter((v) => v.stage === s));
  const urgent = videos.filter((v) => ["late", "today", "missed"].includes(videoUrgency(v, now)));
  const late = urgent.filter((v) => videoUrgency(v, now) === "late").length;
  const inProgress = videos.filter((v) => v.stage !== "live" && v.stage !== "scheduled").length;
  const ch = Object.fromEntries(state.channels.map((c) => [c.id, c]));

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
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="-mx-5 overflow-x-auto px-5 pb-1">
        <div className={cn("relative grid min-w-[760px] grid-cols-7 gap-2", hover && "flowing")}>
          {/* The flow, drawn behind the station heads. */}
          <svg className="pointer-events-none absolute inset-x-0 top-0 h-8 w-full" preserveAspectRatio="none" viewBox="0 0 700 32" aria-hidden>
            {STAGES.slice(0, -1).map((_, i) => {
              const x1 = i * 100 + 86;
              const x2 = (i + 1) * 100 + 4;
              const d = `M${x1},16 L${x2},16`;
              return (
                <g key={i}>
                  <path d={d} className={cn("flow", i % 2 && "flow-dash")} vectorEffect="non-scaling-stroke" />
                  {hover && !reduce && byStage[i + 1].length > 0 && (
                    <circle r="2.2" fill="var(--sand)">
                      <animateMotion dur={`${1.6 + (i % 3) * 0.3}s`} begin={`${i * 0.2}s`} repeatCount="indefinite" path={d} />
                    </circle>
                  )}
                </g>
              );
            })}
          </svg>
          {STAGES.map((stage, si) => {
            const list = byStage[si];
            const show = expanded[stage] ? list : list.slice(0, maxPerStage);
            const stageLit = list.some((v) => videoUrgency(v, now) !== "ok");
            return (
              <div key={stage} className="flex min-w-0 flex-col gap-1.5">
                <div
                  className={cn(
                    "relative z-10 flex h-8 items-center justify-between rounded-full border bg-raised px-3 text-[13px]",
                    stageLit ? "border-ember/45 text-text" : "border-border text-muted",
                  )}
                >
                  <span className="truncate">{STAGE_LABEL[stage]}</span>
                  <span className={cn("num", list.length ? "text-text" : "text-faint")}>{list.length}</span>
                </div>
                {list.length === 0 && <div className="grid h-[58px] place-items-center rounded-[12px] border border-dashed border-border text-[12px] text-faint">Empty</div>}
                {show.map((v) => (
                  <Chip key={v.id} v={v} now={now} channelName={ch[v.channelId]?.name ?? ""} open={open === v.id} setOpen={(o) => setOpen(o ? v.id : null)} />
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
        <span className="ml-auto">Click a video to move it along</span>
      </div>
    </Panel>
  );
}

function Chip({ v, now, channelName, open, setOpen }: { v: Video; now: number; channelName: string; open: boolean; setOpen: (o: boolean) => void }) {
  const u = videoUrgency(v, now);
  const ref = useRef<HTMLDivElement>(null);
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
  const idx = STAGES.indexOf(v.stage);
  const when =
    u === "late" ? until(v.publishAt, now) : u === "missed" ? "Did it go live?" : v.stage === "live" ? "Live " + relDay(v.liveAt ?? v.publishAt, now).toLowerCase() : relDay(v.publishAt, now);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        title={`${channelName}: ${v.title}`}
        aria-label={`${v.title}, ${channelName}, ${STAGE_LABEL[v.stage]}, ${when}`}
        className={cn(
          "press enter flex w-full flex-col gap-1 rounded-[12px] border bg-raised px-2.5 py-2 text-left hover:border-control",
          u === "ok" ? "border-border" : "lit",
        )}
      >
        <span className="line-clamp-3 text-[12px] leading-4 text-text">
          <i className="mr-1.5 mb-px inline-block size-1.5 rounded-full align-middle" style={{ background: TONE[v.channelId].bg }} />
          {v.title}
        </span>
        <span className={cn("num text-[11px] leading-4", u === "ok" ? "text-faint" : "text-ember-soft")}>{when}</span>
      </button>
      {open && (
        <div className="pop absolute top-[calc(100%+6px)] left-0 z-30 w-[220px] origin-top-left rounded-[12px] border border-control bg-raised p-1.5 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.9)]">
          {idx < STAGES.length - 1 && (
            <MenuItem
              onClick={() => {
                actions.moveVideo(v.id, 1);
                setOpen(false);
              }}
            >
              <ArrowRight size={14} /> Move to {STAGE_LABEL[STAGES[idx + 1]]}
            </MenuItem>
          )}
          {idx > 0 && (
            <MenuItem
              onClick={() => {
                actions.moveVideo(v.id, -1);
                setOpen(false);
              }}
            >
              <ArrowLeft size={14} /> Back to {STAGE_LABEL[STAGES[idx - 1]]}
            </MenuItem>
          )}
          <MenuItem
            onClick={() => {
              if (confirm(`Remove “${v.title}” from the line?`)) actions.removeVideo(v.id);
              setOpen(false);
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
  return <button className={cn("flex h-9 w-full items-center gap-2 rounded-[8px] px-2.5 text-left text-[13px] hover:bg-active", className)} {...rest} />;
}

function useReducedMotionFlag() {
  const [r, setR] = useState(false);
  useEffect(() => setR(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  return r;
}
