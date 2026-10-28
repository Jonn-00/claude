"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { actions } from "@/lib/store";
import type { BlockKind, ChannelId, Niche, State } from "@/lib/types";
import { KIND_LABEL, NICHE_LABEL } from "@/lib/types";
import { addDays, dayKey, fromKey, hhmm, minutesOf } from "@/lib/time";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";

type Kind = "reminder" | "block" | "lead" | "video" | "note";

export const field =
  "h-9 w-full rounded-[10px] border border-control bg-surface px-3 text-[14px] text-text outline-none transition-colors focus:border-sand";

/** One small panel for anything you think of mid-task. Enter saves, Esc closes. */
export function QuickAdd({ state, onClose }: { state: State; onClose: () => void }) {
  const [kind, setKind] = useState<Kind>("reminder");
  const nowM = minutesOf(Date.now());
  const nextHour = Math.min(23 * 60, Math.ceil((nowM + 30) / 30) * 30);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState(hhmm(nextHour));
  const [end, setEnd] = useState(hhmm(Math.min(24 * 60 - 1, nextHour + 60)));
  const [blockKind, setBlockKind] = useState<BlockKind>("youtube");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [niche, setNiche] = useState<Niche>("realestate");
  const [channel, setChannel] = useState<ChannelId>("c1");
  const [date, setDate] = useState(addDays(dayKey(Date.now()), 7));
  const [saved, setSaved] = useState<string | null>(null);

  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const today = dayKey(Date.now());

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    if (kind === "reminder") {
      const d = fromKey(today);
      d.setHours(0, toMin(time), 0, 0);
      actions.addReminder({ title: t, due: d.toISOString(), kind: blockKind });
    } else if (kind === "block") {
      const a = toMin(time);
      const b = Math.max(a + 15, toMin(end));
      actions.addBlock({ date: today, start: a, end: b, title: t, kind: blockKind });
    } else if (kind === "lead") {
      actions.addLead({ business: t, contact: contact.trim(), phone: phone.trim(), city: city.trim(), niche, status: "new", note: "" });
    } else if (kind === "video") {
      const d = fromKey(date);
      d.setHours(17, 0, 0, 0);
      actions.addVideo({ channelId: channel, title: t, stage: "idea", publishAt: d.toISOString() });
    } else {
      actions.addNote(t);
    }
    setSaved(`Saved “${t.length > 40 ? t.slice(0, 40) + "…" : t}”`);
    setTitle("");
    setContact("");
    setPhone("");
    setCity("");
  };

  const placeholder: Record<Kind, string> = {
    reminder: "Remind me to…",
    block: "What are you doing in this block?",
    lead: "Business name",
    video: "Working title",
    note: "Write it down before it's gone",
  };

  return (
    <div className="fixed inset-0 z-50" onMouseDown={onClose}>
      <form
        role="dialog"
        aria-label="Quick add"
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
        className="pop absolute top-[60px] right-4 w-[min(420px,calc(100vw-32px))] origin-top-right rounded-[16px] border border-control bg-raised p-4 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.9)] sm:right-7"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-[15px] font-semibold">Quick add</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="press grid size-8 place-items-center rounded-full text-muted hover:bg-active">
            <X size={16} />
          </button>
        </div>
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <Segmented
            label="What to add"
            value={kind}
            onChange={(k) => {
              setKind(k);
              setSaved(null);
            }}
            items={[
              { value: "reminder", label: "Reminder" },
              { value: "block", label: "Block" },
              { value: "lead", label: "Lead" },
              { value: "video", label: "Video idea" },
              { value: "note", label: "Note" },
            ]}
          />
        </div>
        <div className="mt-3 grid gap-2">
          {kind === "note" ? (
            <textarea
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
              }}
              placeholder={placeholder.note}
              aria-label="Note"
              rows={4}
              className={field + " h-auto resize-none py-2 leading-5"}
            />
          ) : (
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={placeholder[kind]} aria-label="Title" className={field} />
          )}
          {(kind === "reminder" || kind === "block") && (
            <div className="grid grid-cols-[1fr_1fr_1.2fr] gap-2">
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label={kind === "block" ? "Start" : "Time"} className={field + " num"} />
              {kind === "block" ? (
                <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="End" className={field + " num"} />
              ) : (
                <span className="self-center text-[13px] text-faint">today</span>
              )}
              <select value={blockKind} onChange={(e) => setBlockKind(e.target.value as BlockKind)} aria-label="For" className={field}>
                {(Object.keys(KIND_LABEL) as BlockKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>
          )}
          {kind === "lead" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact name" aria-label="Contact name" className={field} />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" aria-label="Phone" inputMode="tel" className={field} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" aria-label="City" className={field} />
                <select value={niche} onChange={(e) => setNiche(e.target.value as Niche)} aria-label="Niche" className={field}>
                  {(Object.keys(NICHE_LABEL) as Niche[]).map((n) => (
                    <option key={n} value={n}>
                      {NICHE_LABEL[n]}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          {kind === "video" && (
            <div className="grid grid-cols-2 gap-2">
              <select value={channel} onChange={(e) => setChannel(e.target.value as ChannelId)} aria-label="Channel" className={field}>
                {state.channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Publish on" className={field + " num"} />
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-[13px] text-positive" aria-live="polite">
            {saved}
          </span>
          <Button type="submit" variant="primary" size="sm" disabled={!title.trim()}>
            Add {kind === "video" ? "idea" : kind}
          </Button>
        </div>
      </form>
    </div>
  );
}
