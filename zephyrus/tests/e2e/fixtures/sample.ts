import { seed } from "./old-sample";
// The old sample data, re-keyed so the app's sample cleanup leaves it alone.
export function fixture(now = Date.now()) {
  const s = seed(now) as any;
  const t = (id: string) => "t" + id;
  s.videos = s.videos.map((v: any) => ({ ...v, id: t(v.id) }));
  s.leads = s.leads.map((l: any) => ({ ...l, id: t(l.id) }));
  s.calls = s.calls.map((c: any) => ({ ...c, id: t(c.id), leadId: c.leadId ? t(c.leadId) : undefined }));
  s.blocks = s.blocks.map((b: any) => ({ ...b, id: t(b.id) }));
  s.reminders = s.reminders.map((r: any) => ({ ...r, id: t(r.id) }));
  s.notes = s.notes.map((n: any) => ({ ...n, id: t(n.id) }));
  for (const k of Object.keys(s.agenda)) s.agenda[k].shipped = s.agenda[k].shipped + " (test)";
  return s;
}
export { seed as oldSeed } from "./old-sample";
