"use client";

import { useMemo, useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { actions, useAppState } from "@/lib/store";
import type { AgendaEntry } from "@/lib/types";
import { dayKey, fromKey, longDate, relDay, useNow } from "@/lib/time";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { removeWithUndo } from "@/components/ui/notify";
import { ReportFlow } from "@/components/notes/report-flow";

const PROMPTS: { key: keyof AgendaEntry; label: string }[] = [
  { key: "shipped", label: "Shipped" },
  { key: "stuck", label: "Stuck" },
  { key: "tomorrow", label: "Tomorrow" },
];

export default function NotesPage() {
  const s = useAppState()!;
  const now = useNow();
  const today = dayKey(now);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const reports = useMemo(() => {
    const keys = new Set([today, ...Object.keys(s.agenda)]);
    return [...keys].sort().reverse();
  }, [s.agenda, today]);
  const notes = s.notes.filter((n) => !q.trim() || n.text.toLowerCase().includes(q.trim().toLowerCase()));
  const streak = (() => {
    let n = 0;
    for (const k of reports) {
      const e = s.agenda[k];
      if (e && (e.shipped || e.stuck || e.tomorrow)) n++;
      else if (k !== today) break;
    }
    return n;
  })();

  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader photo="notes" title="Notes" line={`${s.notes.length} quick notes · daily reports written ${streak} day${streak === 1 ? "" : "s"} running`} />
      <ReportFlow state={s} now={now} />
      <div className="mt-5 grid gap-5 xl:h-[620px] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel tone="glass" index={1} title="Quick notes" aside={<span className="num">{notes.length}</span>} className="xl:min-h-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) {
                actions.addNote(draft.trim());
                setDraft("");
              }
            }}
            className="rounded-[14px] bg-raised p-2"
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (draft.trim()) {
                    actions.addNote(draft.trim());
                    setDraft("");
                  }
                }
              }}
              placeholder="Write it down before it's gone"
              aria-label="New note"
              rows={3}
              className="w-full resize-none bg-transparent px-2 py-1.5 text-[14px] leading-5 outline-none"
            />
            <div className="flex items-center justify-between px-1">
              <span className="text-[12px] text-faint">Ctrl or ⌘ + Enter to save</span>
              <Button type="submit" variant="primary" size="sm" disabled={!draft.trim()}>
                Save note
              </Button>
            </div>
          </form>
          <label className="mt-4 flex h-9 items-center gap-2 rounded-full border border-border px-3">
            <Search size={14} className="text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes" aria-label="Search notes" className="flex-1 bg-transparent text-[13px] outline-none" />
          </label>
          <ul className="mt-2 -mr-2 divide-y divide-rule pr-2 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
            {notes.map((n) => (
              <li key={n.id} className="group enter py-3">
                {editing === n.id ? (
                  <textarea
                    autoFocus
                    defaultValue={n.text}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== n.text) actions.updateNote(n.id, v);
                      setEditing(null);
                    }}
                    onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
                    rows={3}
                    aria-label="Edit note"
                    className="w-full resize-none rounded-[10px] border border-control bg-raised px-2.5 py-1.5 text-[14px] leading-5 outline-none focus:border-sand"
                  />
                ) : (
                  <button onClick={() => setEditing(n.id)} className="block w-full text-left text-[14px] leading-5 whitespace-pre-wrap">
                    {n.text}
                  </button>
                )}
                <div className="mt-1 flex items-center justify-between">
                  <span className="num text-[12px] text-faint">{relDay(n.createdAt, now)}</span>
                  <button
                    onClick={() => removeWithUndo("notes", n.id, "note", actions.removeNote)}
                    aria-label="Delete note"
                    className="press grid size-7 place-items-center rounded-full text-faint opacity-0 group-hover:opacity-100 hover:bg-raised hover:text-text focus-visible:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            ))}
            {notes.length === 0 && <li className="py-6 text-center text-[13px] text-faint">{q ? `Nothing matches “${q}”.` : "No notes yet."}</li>}
          </ul>
        </Panel>

        <Panel tone="glass" index={2} title="Daily reports" aside={<span>newest first</span>} className="xl:min-h-0">
          <ol className="-mr-2 grid content-start gap-3 pr-2 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
            {reports.map((k) => (
              <Report key={k} date={k} entry={s.agenda[k]} isToday={k === today} />
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  );
}

function Report({ date, entry, isToday }: { date: string; entry?: AgendaEntry; isToday: boolean }) {
  const [open, setOpen] = useState(isToday);
  const e = entry ?? { shipped: "", stuck: "", tomorrow: "" };
  return (
    <li className={cn("rounded-[14px] border px-4 py-3", isToday ? "border-control bg-raised" : "border-border")}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[14px] font-medium">{isToday ? "Today" : longDate(fromKey(date))}</h3>
        <button onClick={() => setOpen(!open)} className="press h-7 rounded-full px-2.5 text-[12px] text-muted hover:bg-active hover:text-text">
          {open ? "Done" : "Edit"}
        </button>
      </div>
      <dl className="mt-2 grid gap-2">
        {PROMPTS.map((p) => (
          <div key={p.key} className="grid grid-cols-[76px_minmax(0,1fr)] items-start gap-3">
            <dt className="pt-0.5 text-[12px] text-faint">{p.label}</dt>
            <dd className="text-[13px] leading-[18px]">
              {open ? (
                <textarea
                  value={e[p.key]}
                  onChange={(ev) => actions.setAgenda(date, { [p.key]: ev.target.value })}
                  rows={2}
                  aria-label={`${p.label}, ${date}`}
                  className="w-full resize-none rounded-[8px] border border-border bg-surface px-2 py-1 outline-none focus:border-sand"
                />
              ) : (
                e[p.key] || <span className="text-faint">—</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </li>
  );
}
