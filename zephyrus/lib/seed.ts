import type { CallEvent, Lead, Niche, Outcome, PlanBlock, State, Video } from "./types";
import { addDays, dayKey, fromKey } from "./time";
import { rng } from "./utils";

/*
  First-run sample data, placed around the moment you open the app so the
  screen reads as a real day. Everything here is yours to edit or delete;
  it is saved in this browser only.
*/

const at = (day: string, h: number, m = 0) => {
  const d = fromKey(day);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

export function seed(now = Date.now()): State {
  const today = dayKey(now);
  const nowDate = new Date(now);
  const r = rng(424242);

  const channels: State["channels"] = [
    { id: "c1", name: "Stoic Minutes", niche: "Philosophy shorts", rpm: 0.09, avd: 0.5, subRate: 0.0011 },
    { id: "c2", name: "Deep Sea Files", niche: "Ocean mysteries", rpm: 4.2, avd: 7.8, subRate: 0.0021 },
    { id: "c3", name: "Money Mechanics", niche: "Personal finance", rpm: 9.5, avd: 9.4, subRate: 0.0026 },
    { id: "c4", name: "Lost History", niche: "History documentaries", rpm: 5.1, avd: 14.2, subRate: 0.0019 },
  ];

  const v = (id: string, channelId: Video["channelId"], title: string, stage: Video["stage"], day: number, h: number, m = 0): Video => ({
    id,
    channelId,
    title,
    stage,
    publishAt: at(addDays(today, day), h, m),
    ...(stage === "live" ? { liveAt: at(addDays(today, day), h, m) } : {}),
  });

  const videos: Video[] = [
    v("v01", "c3", "Credit scores explained in 9 minutes", "thumbnail", -1, 15),
    v("v02", "c1", "Seneca on wasting time", "thumbnail", 0, 17),
    v("v03", "c2", "The ship that sailed 38 years alone", "edit", 0, 18),
    v("v04", "c1", "Marcus Aurelius at 3 a.m.", "scheduled", 1, 9),
    v("v05", "c2", "What the snailfish eats", "scheduled", 1, 18),
    v("v06", "c3", "Why rent rises faster than pay", "voice", 1, 15),
    v("v07", "c1", "Stoics on envy", "voice", 2, 9),
    v("v08", "c3", "The $5 coffee myth, checked", "edit", 2, 15),
    v("v09", "c1", "Epictetus and the locked door", "script", 3, 9),
    v("v10", "c4", "The town swallowed by a lake", "script", 3, 16),
    v("v11", "c4", "Pompeii's graffiti was petty", "voice", 4, 16),
    v("v12", "c2", "Lights 4 km down", "idea", 6, 18),
    v("v13", "c3", "Compound interest, drawn by hand", "idea", 8, 15),
    v("v14", "c4", "A map drawn from memory", "idea", 10, 16),
    { id: "v15", channelId: "c1", title: "Seneca on the shortness of life", stage: "live", publishAt: new Date(now - 3 * 3_600_000).toISOString(), liveAt: new Date(now - 3 * 3_600_000).toISOString() },
  ];

  const plus = (mins: number) => new Date(now + mins * 60_000).toISOString();
  const leads: Lead[] = [
    { id: "l01", business: "Harbourline Realty", contact: "Priya Nandakumar", niche: "realestate", city: "Toronto", phone: "+1 416 555 0142", status: "callback", nextAt: plus(-75), note: "Asked to call after her 1 pm showing." },
    { id: "l02", business: "Gloss Lab Detailing", contact: "Marco Bellini", niche: "detailing", city: "Mississauga", phone: "+1 905 555 0178", status: "callback", nextAt: plus(35), note: "Wants to see a ceramic-coating ad example." },
    { id: "l03", business: "North Shore Homes", contact: "Daniel Okafor", niche: "realestate", city: "Vancouver", phone: "+1 604 555 0119", status: "callback", nextAt: plus(190), note: "Team of 4 agents, decision on Friday." },
    { id: "l04", business: "Mirror Finish Auto Spa", contact: "Kayla Fortin", niche: "detailing", city: "Ottawa", phone: "+1 613 555 0163", status: "demo", nextAt: at(addDays(today, 1), 10), note: "Demo: 3 sample ads for winter salt packages." },
    { id: "l05", business: "Keystone Realty Group", contact: "Hannah Leclerc", niche: "realestate", city: "Calgary", phone: "+1 403 555 0127", status: "demo", nextAt: at(addDays(today, 2), 14), note: "Interested in listing-video ads." },
    { id: "l06", business: "Prairie Gate Realty", contact: "Omar Haddad", niche: "realestate", city: "Edmonton", phone: "+1 780 555 0191", status: "won", note: "Monthly, 4 ads per month." },
    { id: "l07", business: "Detail Den", contact: "Sasha Ivanova", niche: "detailing", city: "Hamilton", phone: "+1 905 555 0104", status: "won", note: "Paid first month." },
    { id: "l08", business: "Lakeview Property Co.", contact: "Ben Tremblay", niche: "realestate", city: "Kingston", phone: "+1 613 555 0186", status: "won", note: "Wants Instagram-first edits." },
    { id: "l09", business: "Apex Mobile Detailing", contact: "Jordan Pike", niche: "detailing", city: "Toronto", phone: "+1 647 555 0133", status: "interested", nextAt: at(addDays(today, 1), 13, 30), note: "Send pricing PDF first." },
    { id: "l10", business: "Maple & Main Realty", contact: "Grace Liu", niche: "realestate", city: "Markham", phone: "+1 905 555 0112", status: "interested", nextAt: at(addDays(today, 3), 11), note: "Busy until the open house." },
    { id: "l11", business: "Shine Theory", contact: "Luis Romero", niche: "detailing", city: "Brampton", phone: "+1 905 555 0158", status: "new", note: "" },
    { id: "l12", business: "Summit Ridge Realty", contact: "Emily Walsh", niche: "realestate", city: "Kelowna", phone: "+1 250 555 0147", status: "new", note: "" },
    { id: "l13", business: "Blackline Auto Care", contact: "Tariq Nasser", niche: "detailing", city: "London", phone: "+1 519 555 0175", status: "new", note: "" },
    { id: "l14", business: "Cedar Coast Realty", contact: "Mei Tanaka", niche: "realestate", city: "Victoria", phone: "+1 250 555 0109", status: "new", note: "" },
    { id: "l15", business: "Wax Works Studio", contact: "Ryan Doyle", niche: "detailing", city: "Barrie", phone: "+1 705 555 0166", status: "lost", note: "Does ads in-house." },
    { id: "l16", business: "Union Street Realty", contact: "Fatima Siddiqui", niche: "realestate", city: "Halifax", phone: "+1 902 555 0138", status: "lost", note: "Locked into a 12-month agency contract." },
  ];

  // Dials: weekdays 09:00–17:00 at roughly the target, Saturdays half.
  const calls: CallEvent[] = [];
  const pick = (): Outcome => {
    const x = r();
    return x < 0.66 ? "noanswer" : x < 0.9 ? "talked" : "interested";
  };
  for (let back = 20; back >= 0; back--) {
    const day = addDays(today, -back);
    const dow = fromKey(day).getDay();
    if (dow === 0) continue;
    let count = Math.round((dow === 6 ? 26 : 46) + r() * 18);
    if (back === 0) {
      const mins = nowDate.getHours() * 60 + nowDate.getMinutes();
      count = Math.round(Math.max(0, Math.min(1, (mins - 540) / 480)) * 60);
    }
    for (let i = 0; i < count; i++) {
      const mins = 540 + Math.floor((i / Math.max(count, 1)) * 480) + Math.floor(r() * 6);
      const d = fromKey(day);
      d.setHours(0, mins, 0, 0);
      const niche: Niche = r() < 0.55 ? "realestate" : "detailing";
      calls.push({ id: `k${back}-${i}`, at: d.toISOString(), niche, outcome: pick() });
    }
  }
  // The deals and demos behind the leads above, so counts and the lead list agree.
  const mark = (leadId: string, outcome: Outcome, daysAgo: number, h: number) => {
    const lead = leads.find((l) => l.id === leadId)!;
    calls.push({ id: `m-${leadId}-${outcome}`, at: at(addDays(today, -daysAgo), h, 10), niche: lead.niche, outcome, leadId });
  };
  mark("l04", "demo", 1, 11);
  mark("l05", "demo", 3, 15);
  mark("l06", "demo", 16, 10);
  mark("l06", "won", 12, 16);
  mark("l07", "demo", 9, 13);
  mark("l07", "won", 6, 12);
  mark("l08", "demo", 5, 10);
  mark("l08", "won", 2, 14);
  calls.sort((a, b) => a.at.localeCompare(b.at));

  const b = (date: string, start: string, end: string, title: string, kind: PlanBlock["kind"]): PlanBlock => {
    const m = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
    return { id: `b-${date}-${start}`, date, start: m(start), end: m(end), title, kind };
  };
  const monday = addDays(today, -((fromKey(today).getDay() + 6) % 7));
  const blocks: PlanBlock[] = [
    b(today, "07:30", "08:30", "Script: Stoics on envy", "youtube"),
    b(today, "09:00", "11:30", "Call block · real estate", "agency"),
    b(today, "12:00", "12:45", "Lunch, walk", "personal"),
    b(today, "13:00", "14:00", "Edit: Ship that sailed alone", "youtube"),
    b(today, "14:30", "16:30", "Call block · detailing", "agency"),
    b(today, "17:00", "18:00", "Thumbnails ×2", "youtube"),
    b(today, "19:00", "20:00", "Gym", "personal"),
    b(today, "21:00", "22:00", "Idea batch: Lost History", "youtube"),
  ];
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    if (d === today) continue;
    const dow = fromKey(d).getDay();
    if (dow === 0) {
      blocks.push(b(d, "10:00", "12:00", "Batch scripts", "youtube"), b(d, "15:00", "17:00", "Family", "personal"));
      continue;
    }
    blocks.push(
      b(d, "08:00", "09:00", dow % 2 ? "Voiceovers" : "Scripts", "youtube"),
      b(d, "09:30", "12:00", "Call block · real estate", "agency"),
      b(d, "13:00", "14:30", "Edit queue", "youtube"),
      b(d, "15:00", "16:30", "Call block · detailing", "agency"),
      b(d, "18:30", "19:30", "Gym", "personal"),
    );
  }

  const reminders: State["reminders"] = [
    { id: "r1", title: "Call back Harbourline Realty", due: plus(-75), kind: "agency", done: false },
    { id: "r2", title: "Finish thumbnail: Seneca on wasting time", due: at(today, 16, 30), kind: "youtube", done: false },
    { id: "r3", title: "Send invoice to Detail Den (120 CAD)", due: at(today, 17), kind: "agency", done: false },
    { id: "r4", title: "Top up voiceover credits", due: at(today, 20), kind: "youtube", done: false },
    { id: "r5", title: "Check AdSense payment threshold", due: at(addDays(today, 1), 10), kind: "youtube", done: false },
    { id: "r6", title: "Post Stoic short to TikTok", due: at(today, 9, 30), kind: "youtube", done: true },
  ];

  const agenda: State["agenda"] = {
    [addDays(today, -1)]: {
      shipped: "Uploaded Lost History #31. Booked demo with Mirror Finish.",
      stuck: "Credit scores video: thumbnail still not landing.",
      tomorrow: "Two uploads due. Detailing call block after lunch.",
    },
    [addDays(today, -2)]: {
      shipped: "52 dials. Closed Lakeview Property Co.",
      stuck: "Voice tool rate-limited for an hour.",
      tomorrow: "Edit Ship that sailed alone.",
    },
    [addDays(today, -3)]: {
      shipped: "Scripts for 3 Stoic shorts.",
      stuck: "",
      tomorrow: "Follow up Keystone about a demo.",
    },
  };

  const notes: State["notes"] = [
    { id: "n1", createdAt: at(today, 8, 5), text: "Detailers answer more before 10 am. Try moving the detailing block to mornings for a week." },
    { id: "n2", createdAt: at(addDays(today, -1), 21, 40), text: "Deep Sea Files: titles with a number in them get better CTR. Test on the next two." },
    { id: "n3", createdAt: at(addDays(today, -2), 13, 15), text: "Offer: first ad free for agents with 10+ listings?" },
    { id: "n4", createdAt: at(addDays(today, -4), 18, 0), text: "Lost History needs a new intro sting, the current one is 6 s too long." },
  ];

  return {
    version: 1,
    seededOn: today,
    channels,
    videos,
    leads,
    calls,
    blocks,
    reminders,
    agenda,
    notes,
    settings: { dialTarget: 60, dealValue: 120 },
  };
}
