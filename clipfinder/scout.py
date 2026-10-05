"""Drive pages, collect the JSON TikTok loads, and turn it into clips."""

from __future__ import annotations

import json
import random
import sys
from collections import deque
from dataclasses import dataclass
from urllib.parse import quote

from .browser import dismiss_popups, is_blocked, wait_for_human
from .models import Clip
from .parser import extract_clips

API_HINTS = ("item_list", "/api/search/")
BASE = "https://www.tiktok.com"


def source_url(spec: str) -> str:
    """Map 'hashtag:funny', 'user:@name', 'search:cats', 'foryou', 'explore' to a URL."""
    if spec.startswith("http"):
        return spec
    kind, _, value = spec.partition(":")
    value = value.strip()
    if kind == "hashtag" and value:
        return f"{BASE}/tag/{quote(value.lstrip('#'))}"
    if kind == "user" and value:
        return f"{BASE}/@{value.lstrip('@')}"
    if kind == "search" and value:
        return f"{BASE}/search?q={quote(value)}"
    if kind == "foryou":
        return f"{BASE}/foryou"
    if kind == "explore":
        return f"{BASE}/explore"
    raise ValueError(
        f"bad source {spec!r}; use hashtag:<tag>, user:<@name>, search:<text>, foryou, or explore"
    )


@dataclass
class ScoutOptions:
    scrolls: int = 40
    min_delay: float = 1.5
    max_delay: float = 4.0
    idle_limit: int = 5          # stop after this many scrolls with nothing new
    human_timeout_s: float = 1800


class Collector:
    """Queues API responses as they arrive; parsed later, outside the event handler."""

    def __init__(self, page, source: str):
        self.source = source
        self.seen: dict[str, Clip] = {}
        self._pending: deque = deque()
        page.on("response", self._on_response)

    def _on_response(self, response) -> None:
        if any(h in response.url for h in API_HINTS):
            self._pending.append(response)

    def drain(self) -> int:
        """Parse queued responses; returns number of clips not seen before."""
        fresh = 0
        while self._pending:
            response = self._pending.popleft()
            try:
                payload = response.json()
            except Exception:
                continue  # empty body, redirect, or non-JSON
            fresh += self.add(extract_clips(payload, self.source))
        return fresh

    def add(self, clips: list[Clip]) -> int:
        fresh = 0
        for c in clips:
            if c.id not in self.seen:
                self.seen[c.id] = c
                fresh += 1
        return fresh

    def read_embedded(self, page) -> int:
        """First batch of videos is often embedded in the HTML, not fetched."""
        try:
            raw = page.evaluate(
                "document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__')?.textContent"
            )
            return self.add(extract_clips(json.loads(raw), self.source)) if raw else 0
        except Exception:
            return 0


def _scroll(page, foryou: bool) -> None:
    if foryou:
        # The For You feed is a snap-scrolling stack of full-screen videos.
        page.keyboard.press("ArrowDown")
    else:
        # Wheel in a few small steps, like a thumb flick rather than a jump.
        for _ in range(random.randint(2, 4)):
            page.mouse.wheel(0, random.randint(250, 500))
            page.wait_for_timeout(random.randint(80, 220))


def _human_pause(page, opts: ScoutOptions) -> None:
    delay = random.uniform(opts.min_delay, opts.max_delay)
    if random.random() < 0.1:  # occasionally linger, as a person would
        delay += random.uniform(4, 9)
    page.wait_for_timeout(int(delay * 1000))


def _check_block(page, opts: ScoutOptions) -> bool:
    """Hand off to the human if needed. False means we should give up."""
    reason = is_blocked(page)
    if reason:
        return wait_for_human(page, reason, opts.human_timeout_s)
    return True


def scout_source(context, spec: str, opts: ScoutOptions, url: str | None = None) -> list[Clip]:
    """Auto-scroll one source and return every clip seen."""
    url = url or source_url(spec)
    page = context.new_page()
    collector = Collector(page, spec)
    foryou = spec == "foryou"
    try:
        page.goto(url, wait_until="domcontentloaded")
        page.wait_for_timeout(2500)
        if not _check_block(page, opts):
            return list(collector.seen.values())
        dismiss_popups(page)
        collector.read_embedded(page)
        collector.drain()

        idle = 0
        for i in range(1, opts.scrolls + 1):
            _scroll(page, foryou)
            _human_pause(page, opts)
            if not _check_block(page, opts):
                break
            fresh = collector.drain()
            idle = 0 if fresh else idle + 1
            print(f"  [{spec}] scroll {i}/{opts.scrolls}: {len(collector.seen)} clips (+{fresh})",
                  file=sys.stderr)
            if idle >= opts.idle_limit:
                print(f"  [{spec}] nothing new for {idle} scrolls, moving on", file=sys.stderr)
                break
    finally:
        collector.drain()
        if not page.is_closed():
            page.close()
    return list(collector.seen.values())


def watch(context, url: str, opts: ScoutOptions) -> list[Clip]:
    """Manual mode: you browse, we capture. Ends when you close the tab or Ctrl+C."""
    page = context.new_page()
    collector = Collector(page, "watch")
    page.goto(url, wait_until="domcontentloaded")
    collector.read_embedded(page)
    print("Browse normally. Close the tab (or Ctrl+C here) when you're done.", file=sys.stderr)
    try:
        while not page.is_closed():
            page.wait_for_timeout(1500)
            if collector.drain():
                print(f"  captured {len(collector.seen)} clips so far", file=sys.stderr)
    except KeyboardInterrupt:
        pass
    except Exception:
        pass  # tab/browser closed mid-wait
    try:
        collector.drain()
    except Exception:
        pass
    return list(collector.seen.values())
