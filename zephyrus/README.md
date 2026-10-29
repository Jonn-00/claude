# Zephyrus

A personal dashboard for running four YouTube automation channels and an AI-ads cold-calling agency (real estate agents and car detailers) from one screen.

## Run it

```bash
cd zephyrus
npm install
npm run dev        # http://localhost:3000
```

For a production build: `npm run build && npm start`.

Browser tests: with `npm run dev` running, `npm run test:e2e`; `npm run test:e2e:spa` tests the single-file copy. The first time, run `npx playwright install chromium`.

**Hosted copy:** https://claude.ai/artifact/1bDc6xgm5D7zwujZh1hRSY (private to you until you share it). It's the same app built into one file by `npm run build:single` (output in `spa/dist/zephyrus.html`), with pages as `#channels`, `#agency` and so on. Data you enter there is saved in that browser, separately from the local app.

## Pages

| Page | What it's for |
| --- | --- |
| **Today** | The production line (every video moving Idea → Live), channel views, calls against your daily dial target, the hourly planner, reminders, and the folded daily agenda. |
| **Channels** | Per-channel views, watch time, subscribers and revenue; where the views came from (treemap); views by weekday (radar); recent uploads; rename channels here. |
| **Agency** | Dials per day against target, reach and close numbers by niche, one-tap call logging, when people pick up by hour, this month's closes with the current pace carried to month end, and the call queue (the Realtor Call Tracker, built in). |
| **Planner** | The week in blocks. Drag down a day to add one; click a block to rename, change its kind or delete it. |
| **Notes** | Today's work flowing into your stack of daily reports, quick notes, and every past report. |

## Things you can drag, hold and undo

- **Production line:** drag a video onto another stage (or click it for a menu). A dot runs along the line from the old stage to the new one.
- **Planner blocks:** drag to move them (onto another day on the Planner page), drag the bottom edge to change the end time, drag down an empty stretch to make a new one. Everything snaps to 15 minutes.
- **Undo:** moving a video or block, logging a call, and deleting anything shows a toast with Undo for five seconds. No "are you sure?" pop-ups.
- **Clear and reset** (Settings) are hold-to-confirm: keep it pressed until the fill finishes.
- **Charts:** hover or drag across any line, bar, wave or radar to read values. Channel tabs, the niche switch on "When people pick up" and the channel tabs on Channels all redraw in place.
- **Needs-you glow:** anything late, due today or overdue has a warm light that leans toward your cursor.

## Editing

Almost everything is edited where it sits: click a name or title (stage names, card titles, video titles, reminders, lead names, phone numbers, the dial target) to change it; Enter saves, Esc cancels.

- **Production line:** click a video to edit its title, channel, stage and go-live time. Hover a column for its menu: add a video there, rename the stage, add a stage after it, or remove it (its videos move to the stage before; Undo puts it all back). Scheduled and Live can be renamed but not removed.
- **Channels:** name, handle and niche on the Channels page, with links to the channel on YouTube and Social Blade.
- **Sidebar:** the button next to the logo (or `[`) folds it to icons.
- **Settings:** hold to clear everything you've added (keeps your channels, stages, names and settings), or hold to reset everything to how it started.

## Keys

| Key | Does |
| --- | --- |
| `⌘K` / `Ctrl K` | Search videos, leads and notes, or jump to a page |
| `N` (or `⌘J`) | Quick add: reminder, planner block, lead, video idea or note |
| `A` | Open or fold the agenda on Today |
| `[` | Fold or unfold the sidebar |
| `Esc` | Close whatever is open |

## Call queue (from the Realtor Call Tracker)

The bottom of Agency is the Realtor Call Tracker rebuilt: agents ordered overdue first, then due today, then not called, Hot before Warm before Cold. Filter by status, score, niche or search. The call script (opener, voicemail, objections, when to call) folds open above the list, with your name filled in. The header says whether it's a good time to call in Toronto.

Click an agent for their sheet: why to call them, floor plans, brokerage and contact facts, Call / Copy number / Copy text / Website / Instagram, and the call log. Tapping an outcome (No answer, Voicemail + text, Call back, Sample sent, Interested, Demo booked, Won, Not interested) records a dial (so the charts above count it), sets the status, proposes the follow-up date and adds to the history; Undo takes it all back. Notes save as you type.

**Saved to Claude.** In the hosted copy, leads and dials live in the artifact's Claude database, so they follow you across devices (the queue header shows "Saved to Claude"). Lead documents keep the tracker's format, so a chat that researched leads for the tracker can add them to Zephyrus instead: give it this artifact's link and say "add these to the `leads` collection". Dials are stored one document per day under `dials`. Run locally, both stay in the browser.

## Your data

Everything you add is saved in your browser (`localStorage`), so it stays on that computer and browser. Settings (bottom of the sidebar) holds the dial target (60), the deal value (120 CAD), a clear and a full reset.

The app starts **empty** apart from your four channels: no made-up leads, dials, videos, planner blocks, reminders or notes. Everything you see is something you added. (Earlier versions opened with sample data; it's removed automatically the next time the app loads, and anything you added yourself stays.)

**Channel numbers are real**, read from YouTube's public pages and RSS feeds on Oct 28, 2026 (`lib/youtube-snapshot.json`): subscribers (YouTube rounds them), upload count, and every upload's title, date and lifetime views. 14 older uploads YouTube didn't date publicly have their date placed between neighbours and a rounded view count; they're marked ~. What YouTube only shows in Studio stays estimated: how views split across days, watch time, CTR and revenue (about $0.05 per 1,000 Shorts views, the channel's RPM for longer videos). If you change a channel's handle, that channel goes back to estimates; for channels without YouTube data you can type your own numbers on the Channels page. Social Blade blocks automated visits, so the figures come from YouTube directly.

## Design

Some cards use the Finance Bento look (21st.dev, @romanvasnev): a warm vertical colour field behind a dark core (Calls, Pipeline, Closed this month, the charts), and see-through glass tiles for the working cards. Big counts are a dot-matrix number or a thin figure with a row of ticks under it showing progress.

Each page opens on a warm golden-hour photograph that fades into the dark ground, with the page title over it.

Dark warm ground; surfaces step up in lightness instead of borders and shadows. Ember orange (`#ff6a1a`) is the one data colour and the "needs you" signal: anything late, due today or overdue gets a warm light behind it, everything else stays back. Type is Bricolage Grotesque for headings and figures, Onest for the interface, both bundled with the app.

Built with the design skills in `.claude/skills` (Impeccable, Taste, Emil Kowalski's design-engineering set); the dealt direction is in `.taste-skill/direction.json`.

## Photo credits

Header photographs are from [Unsplash](https://unsplash.com/?utm_source=zephyrus&utm_medium=referral), used under the Unsplash License, and stored in `assets/photos`:

- Today: [Olexandr Ignatov](https://unsplash.com/@olexandrignatov?utm_source=zephyrus&utm_medium=referral)
- Channels: [Nibras Hassan Nathu](https://unsplash.com/@pop_at_nibras_hassan?utm_source=zephyrus&utm_medium=referral)
- Agency: [Kreit](https://unsplash.com/@kreit?utm_source=zephyrus&utm_medium=referral)
- Planner: [Jay Lo](https://unsplash.com/@jaylotw?utm_source=zephyrus&utm_medium=referral)
- Notes: [Avtar Singh](https://unsplash.com/@avtar9w?utm_source=zephyrus&utm_medium=referral)

To swap one, replace the file in `assets/photos` (a wide crop, about 1800 × 560) and update its credit in `lib/photos.ts`.
