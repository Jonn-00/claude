export type ChannelId = "c1" | "c2" | "c3" | "c4";

export type Channel = {
  id: ChannelId;
  name: string;
  niche: string;
  /** Revenue per 1,000 views, USD. */
  rpm: number;
  /** Average view duration, minutes. */
  avd: number;
  /** New subscribers per view. */
  subRate: number;
  /** YouTube handle, e.g. "@tikktokers". */
  handle?: string;
  /** Your own figures (from Social Blade or YouTube Studio); they override the estimates. */
  real?: { subscribers?: number; views30?: number; subs30?: number; earnings30?: number };
};

/**
 * Production stages are yours to rename, add and remove. Two ids carry
 * meaning: "scheduled" (done, waiting to publish) and "live". Everything
 * before them counts as in production.
 */
export type Stage = string;
export type StageDef = { id: Stage; label: string };
export const DEFAULT_STAGES: StageDef[] = [
  { id: "idea", label: "Idea" },
  { id: "script", label: "Script" },
  { id: "voice", label: "Voiceover" },
  { id: "edit", label: "Edit" },
  { id: "thumbnail", label: "Thumbnail" },
  { id: "scheduled", label: "Scheduled" },
  { id: "live", label: "Live" },
];
export const FIXED_STAGES = ["scheduled", "live"];

/** A video moving through production. Published history lives in the stats. */
export type Video = {
  id: string;
  channelId: ChannelId;
  title: string;
  stage: Stage;
  /** When it should go live (ISO). */
  publishAt: string;
  /** Set when it reaches Live. */
  liveAt?: string;
};

export type DayStat = { date: string; views: number; subs: number; watchHours: number; revenue: number };

export type PublishedVideo = {
  id: string;
  channelId: ChannelId;
  title: string;
  publishedOn: string;
  /** Views per day keyed by date, so any window sums honestly. */
  daily: Record<string, number>;
  /** Estimated; YouTube only shows these in Studio, so real uploads leave them out. */
  ctr?: number;
  avdPct?: number;
  /** Set on uploads read from YouTube: their lifetime views and where to watch them. */
  lifetime?: number;
  url?: string;
  seconds?: number;
  /** The date was placed between neighbours and the views were rounded. */
  approx?: boolean;
};

export type Niche = "realestate" | "detailing";
export const NICHE_LABEL: Record<Niche, string> = { realestate: "Real estate", detailing: "Car detailing" };

export type LeadStatus = "new" | "noanswer" | "voicemail" | "callback" | "sample" | "interested" | "demo" | "won" | "lost";
export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "To call",
  noanswer: "No answer",
  voicemail: "Voicemail + text",
  callback: "Call back",
  sample: "Sample sent",
  interested: "Interested",
  demo: "Demo booked",
  won: "Won",
  lost: "Not interested",
};
/** Statuses still worth a call; won and lost leave the queue. */
export const OPEN_STATUSES: LeadStatus[] = ["new", "noanswer", "voicemail", "callback", "sample", "interested", "demo"];

export type LeadScore = "Hot" | "Warm" | "Cold";
export type FloorPlan = { label: string; url: string; source?: string; match?: "exact" | "size" | "project"; lowRes?: boolean };
export type LeadLog = { d: string; s: LeadStatus };

export type Lead = {
  id: string;
  business: string;
  contact: string;
  niche: Niche;
  /** City or area. */
  city: string;
  phone: string;
  status: LeadStatus;
  /** Next call or demo (ISO). */
  nextAt?: string;
  note: string;
  /* Research from the Realtor Call Tracker; all optional. */
  score?: LeadScore;
  team?: string;
  brokerage?: string;
  email?: string;
  website?: string;
  instagram?: string;
  /** What they focus on (pre-construction, luxury condos…). */
  category?: string;
  why?: string;
  researchNotes?: string;
  floorPlans?: FloorPlan[];
  floorPlanNote?: string;
  siteVideo?: string;
  confidence?: string;
  verified?: string;
  source?: string;
  /** Last call date (YYYY-MM-DD) and the call history, newest first. */
  lastContact?: string;
  log?: LeadLog[];
};

export type Outcome = "noanswer" | "voicemail" | "talked" | "interested" | "demo" | "won";
export const OUTCOME_LABEL: Record<Outcome, string> = {
  noanswer: "No answer",
  voicemail: "Voicemail",
  talked: "Talked",
  interested: "Interested",
  demo: "Demo booked",
  won: "Closed",
};
/** A dial reached someone unless nobody picked up. */
export const reached = (o: Outcome) => o !== "noanswer" && o !== "voicemail";

/** What you can log on a lead's call sheet: the dial it records, the status it sets and when to follow up. */
export const LEAD_OUTCOMES: { status: LeadStatus; label: string; call: Outcome; days: number | null }[] = [
  { status: "noanswer", label: "No answer", call: "noanswer", days: 2 },
  { status: "voicemail", label: "Voicemail + text", call: "voicemail", days: 3 },
  { status: "callback", label: "Call back", call: "talked", days: 1 },
  { status: "sample", label: "Sample sent", call: "talked", days: 3 },
  { status: "interested", label: "Interested", call: "interested", days: 2 },
  { status: "demo", label: "Demo booked", call: "demo", days: 2 },
  { status: "won", label: "Won", call: "won", days: null },
  { status: "lost", label: "Not interested", call: "talked", days: null },
];

/** One dial. Every outcome past "noanswer" means you reached someone. */
export type CallEvent = { id: string; at: string; niche: Niche; outcome: Outcome; leadId?: string };

export type BlockKind = "youtube" | "agency" | "personal";
export const KIND_LABEL: Record<BlockKind, string> = { youtube: "YouTube", agency: "Agency", personal: "Personal" };

export type PlanBlock = { id: string; date: string; start: number; end: number; title: string; kind: BlockKind };

export type Reminder = { id: string; title: string; due: string; kind: BlockKind; done: boolean };

export type AgendaEntry = { shipped: string; stuck: string; tomorrow: string };

export type Note = { id: string; createdAt: string; text: string };

export type Settings = { dialTarget: number; dealValue: number };

export type State = {
  version: 1;
  seededOn: string;
  channels: Channel[];
  videos: Video[];
  leads: Lead[];
  calls: CallEvent[];
  blocks: PlanBlock[];
  reminders: Reminder[];
  agenda: Record<string, AgendaEntry>;
  notes: Note[];
  settings: Settings;
  stages: StageDef[];
  /** Your names for panels and sections, by key. */
  labels: Record<string, string>;
};
