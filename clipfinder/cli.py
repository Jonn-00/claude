from __future__ import annotations

import argparse
import os
import time
from datetime import datetime, timezone
from pathlib import Path

from . import ranking
from .browser import export_cookies_txt, open_session
from .scout import ScoutOptions, scout_source, source_url, watch
from .store import PERMISSIONS, STATUSES, Store


def _home(args) -> Path:
    return Path(args.data_dir or os.environ.get("CLIPFINDER_HOME") or "data")


def _filters(args) -> ranking.Filters:
    return ranking.Filters(
        min_views=args.min_views,
        max_age_hours=args.max_age_days * 24,
        min_duration=args.min_duration,
        max_duration=args.max_duration,
    )


def _fmt(n: int) -> str:
    for unit, div in (("M", 1_000_000), ("K", 1_000)):
        if n >= div:
            return f"{n / div:.1f}{unit}"
    return str(n)


def _print_table(rows, store: Store, now: float) -> None:
    if not rows:
        print("No clips matched. Loosen --min-views / --max-age-days, or scout more sources.")
        return
    print(f"{'score':>6} {'views':>7} {'v/hr':>7} {'eng%':>5} {'age':>5} {'dur':>4}  {'status':<11} id / author")
    for score, c in rows:
        meta = store.meta(c.id)
        age = ranking.age_hours(c, now)
        age_s = f"{age:.0f}h" if age < 48 else f"{age / 24:.0f}d"
        print(
            f"{score:6.2f} {_fmt(c.views):>7} {_fmt(int(ranking.velocity(c, now))):>7} "
            f"{ranking.engagement(c) * 100:5.1f} {age_s:>5} {c.duration:>3}s  "
            f"{meta.get('status', '?'):<11} {c.id}  @{c.author}"
        )
        print(f"{'':>50}{c.url}")
        if c.description:
            print(f"{'':>50}{c.description[:90]}")


def _store(args) -> Store:
    return Store(_home(args) / "clips.db")


def cmd_login(args) -> None:
    home = _home(args)
    with open_session(home / "profile", args.engine, headless=False) as ctx:
        page = ctx.new_page()
        page.goto("https://www.tiktok.com/login")
        print("Log in to a throwaway TikTok account in the browser window,")
        print("solve any captcha, then come back here and press Enter.")
        input()
        export_cookies_txt(ctx, home / "cookies.txt")
    print(f"Saved login to {home / 'profile'} (cookies for yt-dlp: {home / 'cookies.txt'}).")


def cmd_scout(args) -> None:
    home = _home(args)
    store = _store(args)
    opts = ScoutOptions(scrolls=args.scrolls)
    for spec in args.sources:
        try:
            source_url(spec)  # validate everything up front
        except ValueError as e:
            raise SystemExit(f"clipfinder: {e}")
    total = 0
    with open_session(home / "profile", args.engine, headless=args.headless) as ctx:
        for i, spec in enumerate(args.sources):
            print(f"Scouting {spec} ...")
            clips = scout_source(ctx, spec, opts)
            new = store.upsert_many(clips)
            total += len(clips)
            print(f"  {len(clips)} clips seen, {new} new")
            if i < len(args.sources) - 1:
                time.sleep(5 + 5 * (i % 2))  # breathe between sources
        export_cookies_txt(ctx, home / "cookies.txt")
    print(f"\nDone: {total} clips seen. Top picks:\n")
    cmd_top(args)


def cmd_watch(args) -> None:
    home = _home(args)
    store = _store(args)
    with open_session(home / "profile", args.engine, headless=False) as ctx:
        clips = watch(ctx, source_url(args.url) if not args.url.startswith("http") else args.url, ScoutOptions())
        new = store.upsert_many(clips)
        export_cookies_txt(ctx, home / "cookies.txt")
    print(f"Captured {len(clips)} clips ({new} new). Run `clipfinder top` to see the best.")


def cmd_top(args) -> None:
    store = _store(args)
    now = time.time()
    statuses = tuple(args.status) if args.status else ("new", "shortlisted")
    rows = ranking.rank(store.all_clips(statuses), _filters(args), now)[: args.limit]
    _print_table(rows, store, now)


def cmd_mark(args) -> None:
    store = _store(args)
    for clip_id in args.ids:
        if not store.set_fields(clip_id, status=args.status, permission=args.permission):
            print(f"  ? {clip_id}: not found or nothing to change")
        else:
            print(f"  updated {clip_id}")


def cmd_download(args) -> None:
    from .downloader import download_many

    home = _home(args)
    store = _store(args)
    if args.ids:
        clips = [c for c in (store.get_clip(i) for i in args.ids) if c]
    else:
        now = time.time()
        ranked = ranking.rank(store.all_clips(("new", "shortlisted")), _filters(args), now)
        clips = [c for _, c in ranked[: args.top]]
    if not clips:
        print("Nothing to download.")
        return

    def on_done(clip, path):
        store.set_fields(clip.id, status="downloaded", file_path=str(path))

    out = Path(args.out) if args.out else home / "downloads"
    ok, failed = download_many(clips, out, home / "cookies.txt", on_done)
    print(f"\n{ok} downloaded, {failed} failed -> {out}")


def _add_filter_args(p) -> None:
    p.add_argument("--min-views", type=int, default=50_000)
    p.add_argument("--max-age-days", type=float, default=14)
    p.add_argument("--min-duration", type=int, default=5)
    p.add_argument("--max-duration", type=int, default=180)


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(prog="clipfinder", description="Find viral short-form clips by driving a real browser.")
    ap.add_argument("--data-dir", help="where the profile, DB and downloads live (default: ./data)")
    ap.add_argument("--engine", choices=["playwright", "patchright"], default="playwright")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("login", help="open a browser to log in once; session is saved").set_defaults(fn=cmd_login)

    p = sub.add_parser("scout", help="auto-scroll sources and rank what's taking off")
    p.add_argument("sources", nargs="+", help="hashtag:funny user:@name search:cats foryou explore")
    p.add_argument("--scrolls", type=int, default=40)
    p.add_argument("--limit", type=int, default=15)
    p.add_argument("--status", nargs="*")
    p.add_argument("--headless", action="store_true",
                   help="no window (can't hand off captchas to you; not recommended)")
    _add_filter_args(p)
    p.set_defaults(fn=cmd_scout)

    p = sub.add_parser("watch", help="you browse, it captures every clip the page loads")
    p.add_argument("url", nargs="?", default="foryou", help="source spec or URL (default: foryou)")
    p.set_defaults(fn=cmd_watch)

    p = sub.add_parser("top", help="show ranked clips from the database")
    p.add_argument("--limit", type=int, default=15)
    p.add_argument("--status", nargs="*", choices=STATUSES)
    _add_filter_args(p)
    p.set_defaults(fn=cmd_top)

    p = sub.add_parser("download", help="download clips with yt-dlp")
    p.add_argument("ids", nargs="*", help="clip ids (default: the current top N)")
    p.add_argument("--top", type=int, default=5)
    p.add_argument("--out")
    _add_filter_args(p)
    p.set_defaults(fn=cmd_download)

    p = sub.add_parser("mark", help="track status / creator permission for clips")
    p.add_argument("ids", nargs="+")
    p.add_argument("--status", choices=STATUSES)
    p.add_argument("--permission", choices=PERMISSIONS)
    p.set_defaults(fn=cmd_mark)

    args = ap.parse_args(argv)
    args.fn(args)


if __name__ == "__main__":
    main()
