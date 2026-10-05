# clipfinder

Finds viral short-form clips for you to edit by driving a **real, visible browser** on your own
machine. No paid APIs. It scrolls TikTok hashtag / search / profile / For You pages like a person,
captures the video data the page loads, ranks clips by how fast they're taking off, and downloads
the best ones with yt-dlp.

If TikTok shows a captcha or a block page, the tool **pauses, beeps, and waits for you** to solve it
in the browser window, then resumes by itself.

## Setup (on your computer, not a server)

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e .            # add [stealth] for the patchright engine
playwright install chromium
```

Needs Python 3.10+. Also install `ffmpeg` (yt-dlp uses it to merge video + audio).

## Use

```bash
clipfinder login                          # once: log in to a THROWAWAY TikTok account
clipfinder scout hashtag:fyp hashtag:funny search:"fail compilation" --scrolls 40
clipfinder top --limit 15                 # re-rank anything already collected
clipfinder mark 7123456789 --status shortlisted --permission requested
clipfinder download --top 5               # or: clipfinder download <id> <id>
clipfinder watch                          # manual mode: you scroll, it captures
```

Sources: `hashtag:<tag>`, `user:@name`, `search:<text>`, `foryou`, `explore`, or a full URL.
Everything lives in `./data` (or `--data-dir` / `$CLIPFINDER_HOME`): the browser profile, `clips.db`,
`cookies.txt`, and `downloads/`.

## How ranking works

`score = log10(1 + views per hour since posting) x (1 + 10 x engagement)`, where engagement is
(likes + comments + shares + saves) / views. Filters (all flags on `scout`/`top`/`download`):
`--min-views 50000 --max-age-days 14 --min-duration 5 --max-duration 180`.

## Tracking permission

Each clip has a `status` (new, shortlisted, downloaded, edited, skipped) and a `permission`
(unknown, requested, granted, denied). Reposting someone else's clip needs their permission or a
substantial transformative edit, and TikTok's licensed music can trigger claims on YouTube; use
`mark` to keep track of who said yes.

## Notes and limits

- Automation is against TikTok's terms. Use a throwaway account, keep volume modest, and expect
  occasional breakage when TikTok changes its site.
- `--engine patchright` (after `pip install -e .[stealth]`) swaps in a harder-to-detect Chromium.
- Selectors for captcha/login-modal detection and the API URL patterns are heuristics that were
  tested against a local mock page, not against live TikTok. If a source returns nothing, run
  `clipfinder watch` and browse manually; the capture path uses the same parser.
- `yt-dlp` occasionally lags behind TikTok changes: `pip install -U yt-dlp` first if downloads fail.

## Tests

```bash
pip install -e .[dev] && pytest
```
