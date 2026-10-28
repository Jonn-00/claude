# Zephyrus

A personal dashboard for running four YouTube automation channels and an AI-ads cold-calling agency (real estate agents and car detailers) from one screen.

## Run it

```bash
cd zephyrus
npm install
npm run dev        # http://localhost:3000
```

For a production build: `npm run build && npm start`.

**Hosted copy:** https://claude.ai/artifact/1bDc6xgm5D7zwujZh1hRSY (private to you until you share it). It's the same app built into one file by `npm run build:single` (output in `spa/dist/zephyrus.html`), with pages as `#channels`, `#agency` and so on. Data you enter there is saved in that browser, separately from the local app.

## Pages

| Page | What it's for |
| --- | --- |
| **Today** | The production line (every video moving Idea → Live), channel views, calls against your daily dial target, the hourly planner, reminders, and the folded daily agenda. |
| **Channels** | Per-channel views, watch time, subscribers and revenue; where the views came from (treemap); views by weekday (radar); recent uploads; rename channels here. |
| **Agency** | Dials per day against target, reach and close numbers by niche, one-tap call logging, when people pick up by hour, this month's closes with the current pace carried to month end, and the lead list. |
| **Planner** | The week in blocks. Drag down a day to add one; click a block to rename, change its kind or delete it. |
| **Notes** | Today's work flowing into your stack of daily reports, quick notes, and every past report. |

## Things you can drag, hold and undo

- **Production line:** drag a video onto another stage (or click it for a menu). A dot runs along the line from the old stage to the new one.
- **Planner blocks:** drag to move them (onto another day on the Planner page), drag the bottom edge to change the end time, drag down an empty stretch to make a new one. Everything snaps to 15 minutes.
- **Undo:** moving a video or block, logging a call, and deleting anything shows a toast with Undo for five seconds. No "are you sure?" pop-ups.
- **Reset to sample data** (Settings) is hold-to-confirm: keep it pressed until the fill finishes.
- **Charts:** hover or drag across any line, bar, wave or radar to read values. Channel tabs, the niche switch on "When people pick up" and the channel tabs on Channels all redraw in place.
- **Needs-you glow:** anything late, due today or overdue has a warm light that leans toward your cursor.

## Keys

| Key | Does |
| --- | --- |
| `⌘K` / `Ctrl K` | Search videos, leads and notes, or jump to a page |
| `N` (or `⌘J`) | Quick add: reminder, planner block, lead, video idea or note |
| `A` | Open or fold the agenda on Today |
| `Esc` | Close whatever is open |

## Your data

Everything you add is saved in your browser (`localStorage`), so it stays on that computer and browser. Settings (bottom of the sidebar) holds the dial target (60), the deal value (120 CAD) and a reset to the sample data.

The app opens with **sample data** so you can see it working: the four channel names, every analytics figure, the leads and the planner blocks are made up. Rename the channels on the Channels page and delete or edit the rest. Channel analytics stay sample numbers until the YouTube Analytics API is connected.

## Design

Dark warm ground; surfaces step up in lightness instead of borders and shadows. Ember orange (`#ff6a1a`) is the one data colour and the "needs you" signal: anything late, due today or overdue gets a warm light behind it, everything else stays back. Type is Bricolage Grotesque for headings and figures, Onest for the interface, both bundled with the app.

Built with the design skills in `.claude/skills` (Impeccable, Taste, Emil Kowalski's design-engineering set); the dealt direction is in `.taste-skill/direction.json`.
