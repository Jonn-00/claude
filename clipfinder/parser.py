"""Turn TikTok's JSON payloads into Clip objects.

Rather than hard-coding one response shape, we walk the payload and pick up
anything that looks like a video item. That survives wrapper changes such as
`itemList[]` vs `data[].item` vs the embedded rehydration blob.
"""

from __future__ import annotations

from typing import Any, Iterator

from .models import Clip


def _num(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _looks_like_item(d: dict) -> bool:
    return (
        "id" in d
        and "createTime" in d
        and ("stats" in d or "statsV2" in d)
        and isinstance(d.get("author"), (dict, str))
    )


def _walk(node: Any) -> Iterator[dict]:
    if isinstance(node, dict):
        if _looks_like_item(node):
            yield node
            return
        for value in node.values():
            yield from _walk(value)
    elif isinstance(node, list):
        for value in node:
            yield from _walk(value)


def parse_item(item: dict, source: str) -> Clip | None:
    author = item.get("author")
    if isinstance(author, dict):
        author = author.get("uniqueId") or author.get("nickname") or ""
    if not author or not item.get("id"):
        return None

    # statsV2 carries numbers as strings and is usually more precise.
    stats = {**(item.get("stats") or {}), **(item.get("statsV2") or {})}
    video = item.get("video") or {}
    music = item.get("music") or {}

    return Clip(
        id=str(item["id"]),
        author=str(author),
        description=str(item.get("desc") or ""),
        created_at=_num(item.get("createTime")),
        views=_num(stats.get("playCount")),
        likes=_num(stats.get("diggCount")),
        comments=_num(stats.get("commentCount")),
        shares=_num(stats.get("shareCount")),
        saves=_num(stats.get("collectCount")),
        duration=_num(video.get("duration")),
        music=str(music.get("title") or "") if isinstance(music, dict) else "",
        source=source,
    )


def extract_clips(payload: Any, source: str) -> list[Clip]:
    clips = []
    for item in _walk(payload):
        clip = parse_item(item, source)
        if clip:
            clips.append(clip)
    return clips
