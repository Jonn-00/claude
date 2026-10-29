# Zephyrus: notes for the next session

Read `README.md` first (what each page does, how to run it). This file is the context a fresh chat won't have.

## What this is

A personal dashboard: four YouTube automation channels plus a cold-calling agency selling AI ads / floor-plan walkthrough videos to real-estate agents (GTA) and car detailers. Next.js 16 App Router + React 19 + TypeScript + Tailwind v4, shadcn layout. Dial target 60/day, about 120 CAD per deal.

- Work branch: `claude/zen-wozniak-hsvsf5` on `Jonn-00/claude`. Commit and push there.
- Hosted copy (the one actually used): https://claude.ai/artifact/1bDc6xgm5D7zwujZh1hRSY, private. Built by `npm run build:single` into `spa/dist/zephyrus.html` and published with the Artifact tool (same file path keeps the URL). It declares the `db` capability: pass `capabilities: {"db": {}}` on publish, or omit `capabilities` to keep it.

## Where the data lives

- **Channels:** real public YouTube numbers in `lib/youtube-snapshot.json` (read 2026-10-28 from channel pages and RSS feeds; Social Blade blocks automated visits behind Cloudflare, so don't try to get past that). Watch time, CTR and revenue are estimates; the UI says so.
- **Leads and dials:** in the hosted copy, the artifact's Claude database (`lib/cloud.ts`): collection `leads` (one doc per agent, same format as the old Realtor Call Tracker artifact 13RZ5JSy9J5Fmu3Ko1ZpPC: business, phone, score, brokerage, area, why, floorPlans, status "to_call"…) and `dials` (one doc per day, `{items: [...]}`, to stay under the 25,000-document cap). 27 researched GTA agents were copied in on 2026-10-29. Read or write them with the ArtifactData tool, never by hand-editing the page.
- **Everything else** (production line, planner, reminders, notes, settings): the browser's localStorage, key `zephyrus:v1`. No placeholder data; old sample items are stripped on load by their sample-only ids (`lib/seed.ts`).
- Header photos: Unsplash, credited on the page and in the README, stored in `assets/photos`.

## How to check work

- `npx tsc --noEmit`, then `npx next build`.
- Design checks from the installed skills (run from the repo root): `node .claude/skills/taste-skill/scripts/lint.mjs --app zephyrus/app zephyrus/components zephyrus/lib` and `.claude/skills/taste-skill/scripts/inspect.mjs --app <url>`; `.taste-skill/direction.json` lists the allowed exceptions (the requested gradient cards, emoji inside real video titles) with reasons.
- Click-through tests in a real browser: `npm run dev`, then `npm run test:e2e` (the Next app on :3000; pass another URL to use another port), and `npm run test:e2e:spa` (builds and tests the single-file copy). First time on a machine: `npx playwright install chromium`. They load test data into the browser (`tests/e2e/fixtures`: the old sample day and six made-up agents); the app itself ships empty. `cloud-test.js` checks the Claude-database sync against an in-memory stand-in, since the real one only exists inside Claude.

## Preferences seen so far

- Warm orange/brown on a dark ground, Finance Bento glass/gradient cards, Cofounder-style photo headers. No AI slop: no generic gradients-with-centered-text, no basic fonts.
- Almost everything editable in place; Undo instead of confirm dialogs; hold-to-confirm for destructive resets.
- Never invent data: estimates are labelled, sample data was removed on request.
- Never bypass captchas or bot checks; the user solves captchas themselves.
