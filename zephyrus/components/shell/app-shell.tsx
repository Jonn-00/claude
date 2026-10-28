"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarClock, Clapperboard, LayoutGrid, Menu, NotebookPen, PhoneCall, Search, Settings2, X } from "lucide-react";
import { actions, resetSample, useAppState } from "@/lib/store";
import { callbacks } from "@/lib/derive";
import { dayKey, minutesOf, timeOf, until, useNow, hhmm } from "@/lib/time";
import { cn } from "@/lib/utils";
import { ChartTooltip } from "@/components/ui/tooltip";
import { AppToaster, notify } from "@/components/ui/notify";
import { HoldButton } from "@/components/ui/hold-button";
import { Button, Kbd } from "@/components/ui/button";
import { Mark } from "./mark";
import { CommandPalette } from "./command-palette";
import { QuickAdd } from "./quick-add";

const NAV = [
  { href: "/", label: "Today", icon: LayoutGrid },
  { href: "/channels", label: "Channels", icon: Clapperboard },
  { href: "/agency", label: "Agency", icon: PhoneCall },
  { href: "/planner", label: "Planner", icon: CalendarClock },
  { href: "/notes", label: "Notes", icon: NotebookPen },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const s = useAppState();
  const now = useNow();
  const path = usePathname();
  const [palette, setPalette] = useState(false);
  const [quick, setQuick] = useState(false);
  const [menu, setMenu] = useState(false);
  const [settings, setSettings] = useState(false);

  useEffect(() => setMenu(false), [path]);

  // Lit things lean their light toward the pointer. One listener for the app;
  // it only writes to the element under the pointer.
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let last: HTMLElement | null = null;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = (e.target as Element | null)?.closest?.(".lit") as HTMLElement | null;
        if (last && last !== el) last.removeAttribute("data-near");
        last = el;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--px", `${((e.clientX - r.left) / r.width) * 100}%`);
        el.style.setProperty("--py", `${((e.clientY - r.top) / r.height) * 100 + 40}%`);
        el.setAttribute("data-near", "");
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.closest("input,textarea,select,[contenteditable=true]") !== null);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuick(false);
        setPalette((p) => !p);
      } else if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") || (!typing && e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey && !e.altKey)) {
        e.preventDefault();
        setPalette(false);
        setQuick((q) => !q);
      } else if (e.key === "Escape") {
        setPalette(false);
        setQuick(false);
        setSettings(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const overdue = s ? callbacks(s.leads, now).filter((l) => new Date(l.nextAt!).getTime() < now).length : 0;

  // What's next: the nearest planner block or callback that hasn't started.
  let next: { label: string; when: string } | null = null;
  if (s) {
    const today = dayKey(now);
    const m = minutesOf(now);
    const block = s.blocks.filter((b) => b.date === today && b.end > m).sort((a, b) => a.start - b.start)[0];
    const cb = callbacks(s.leads, now).find((l) => new Date(l.nextAt!).getTime() >= now);
    const blockAt = block ? (block.start <= m ? now : new Date(now).setHours(0, block.start, 0, 0)) : Infinity;
    const cbAt = cb ? new Date(cb.nextAt!).getTime() : Infinity;
    if (cb && cbAt < blockAt) next = { label: `Call ${cb.business}`, when: until(cb.nextAt!, now) + ` · ${timeOf(cb.nextAt!)}` };
    else if (block)
      next =
        block.start <= m
          ? { label: block.title, when: `now until ${hhmm(block.end)}` }
          : { label: block.title, when: until(blockAt, now) + ` · ${hhmm(block.start)}` };
  }

  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const on = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "press flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-[14px] transition-colors",
              on ? "bg-raised text-text" : "text-muted hover:bg-raised/60 hover:text-text",
            )}
          >
            <Icon size={16} strokeWidth={1.6} className={on ? "text-text" : "text-faint"} />
            <span className="flex-1">{label}</span>
            {href === "/agency" && overdue > 0 && (
              <span className="num rounded-full bg-ember-tint px-1.5 text-[12px] leading-5 text-ember-soft" aria-label={`${overdue} overdue callbacks`}>
                {overdue}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-rule px-3 py-4 lg:flex">
        <div className="mb-6 flex items-center gap-2.5 px-1.5">
          <Mark />
          <div className="leading-tight">
            <div className="font-display text-[16px] font-semibold tracking-[-0.01em]">Zephyrus</div>
            <div className="text-[12px] text-faint">4 channels · AI ad agency</div>
          </div>
        </div>
        {nav}
        <div className="mt-auto">
          <SettingsMenu open={settings} setOpen={setSettings} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-rule bg-ground px-4 sm:px-7">
          <button className="press -ml-1 grid size-9 place-items-center rounded-full text-muted hover:bg-raised lg:hidden" aria-label="Open menu" onClick={() => setMenu(true)}>
            <Menu size={18} strokeWidth={1.6} />
          </button>
          <div className="flex items-center gap-2 lg:hidden">
            <Mark size={24} />
            <span className="font-display text-[15px] font-semibold">Zephyrus</span>
          </div>
          <button
            onClick={() => setPalette(true)}
            className="press hidden h-9 w-[300px] items-center gap-2 rounded-full border border-border bg-surface px-3.5 text-[14px] text-faint hover:border-control sm:flex"
          >
            <Search size={15} strokeWidth={1.6} />
            <span className="flex-1 text-left">Search or jump to…</span>
            <Kbd>⌘K</Kbd>
          </button>
          {next && (
            <div className="hidden min-w-0 flex-1 items-center justify-center gap-2 text-[13px] xl:flex">
              <span className="text-faint">Next</span>
              <span className="truncate text-text">{next.label}</span>
              <span className="num shrink-0 text-muted">{next.when}</span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button className="press grid size-9 place-items-center rounded-full text-muted hover:bg-raised sm:hidden" aria-label="Search" onClick={() => setPalette(true)}>
              <Search size={17} strokeWidth={1.6} />
            </button>
            {s && <span className="num hidden text-[13px] text-muted sm:inline">{timeOf(now)}</span>}
            <Button variant="primary" size="sm" onClick={() => setQuick((q) => !q)} aria-keyshortcuts="N" aria-expanded={quick}>
              Quick add <Kbd className="border-ground/25 text-ground/60">N</Kbd>
            </Button>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 pt-6 pb-16 sm:px-7">{s ? children : <Loading />}</main>
      </div>

      {/* Phone / tablet menu sheet */}
      {menu && (
        <div className="fixed inset-0 z-50 bg-ground px-5 py-4 lg:hidden">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Mark />
              <span className="font-display text-[16px] font-semibold">Zephyrus</span>
            </div>
            <button className="press grid size-10 place-items-center rounded-full text-muted hover:bg-raised" aria-label="Close menu" onClick={() => setMenu(false)}>
              <X size={18} />
            </button>
          </div>
          <div className="[&_a]:h-12 [&_a]:text-[16px]">{nav}</div>
          <div className="mt-6 border-t border-rule pt-4">
            <SettingsMenu open={settings} setOpen={setSettings} />
          </div>
        </div>
      )}

      {s && palette && <CommandPalette state={s} onClose={() => setPalette(false)} onQuickAdd={() => { setPalette(false); setQuick(true); }} />}
      {s && quick && <QuickAdd state={s} onClose={() => setQuick(false)} />}
      <ChartTooltip />
      <AppToaster />
    </div>
  );
}

function SettingsMenu({ open, setOpen }: { open: boolean; setOpen: (o: boolean) => void }) {
  const s = useAppState();
  if (!s) return null;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="press flex h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-[14px] text-muted hover:bg-raised/60 hover:text-text"
      >
        <Settings2 size={16} strokeWidth={1.6} className="text-faint" />
        Settings
      </button>
      {open && (
        <div className="pop absolute bottom-11 left-0 z-40 w-[260px] origin-bottom-left rounded-[14px] border border-control bg-raised p-4 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.9)]">
          <label className="flex items-center justify-between gap-3 text-[13px] text-muted">
            Daily dial target
            <input
              type="number"
              min={1}
              value={s.settings.dialTarget}
              onChange={(e) => actions.setSettings({ dialTarget: Math.max(1, Number(e.target.value) || 1) })}
              className="num h-8 w-20 rounded-[8px] border border-control bg-surface px-2 text-right text-text"
            />
          </label>
          <label className="mt-2 flex items-center justify-between gap-3 text-[13px] text-muted">
            Deal value (CAD)
            <input
              type="number"
              min={0}
              value={s.settings.dealValue}
              onChange={(e) => actions.setSettings({ dealValue: Math.max(0, Number(e.target.value) || 0) })}
              className="num h-8 w-20 rounded-[8px] border border-control bg-surface px-2 text-right text-text"
            />
          </label>
          <p className="mt-3 text-[12px] leading-[17px] text-faint">Everything saves in this browser. Rename channels on the Channels page.</p>
          <HoldButton
            className="mt-3 h-8 w-full rounded-full border border-control text-[13px] text-muted hover:text-text"
            onConfirm={() => {
              resetSample();
              setOpen(false);
              notify("Back to the sample data");
            }}
          >
            Hold to reset to sample data
          </HoldButton>
        </div>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="grid gap-4">
      <div className="h-7 w-64 rounded-md bg-surface" />
      <div className="h-4 w-96 max-w-full rounded-md bg-surface" />
      <div className="mt-2 h-[220px] rounded-[18px] bg-surface" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-[300px] rounded-[18px] bg-surface" />
        <div className="h-[300px] rounded-[18px] bg-surface" />
      </div>
    </div>
  );
}
