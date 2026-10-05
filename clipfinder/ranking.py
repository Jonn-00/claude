"""Rank clips by how fast they're taking off, not just total views."""

from __future__ import annotations

import math
import time
from dataclasses import dataclass


@dataclass
class Filters:
    min_views: int = 50_000
    max_age_hours: float = 24 * 14
    min_duration: int = 5
    max_duration: int = 180


def age_hours(clip, now: float | None = None) -> float:
    now = time.time() if now is None else now
    return max((now - clip.created_at) / 3600, 1.0)


def velocity(clip, now: float | None = None) -> float:
    """Views per hour since posting (age floored at 1h to tame brand-new posts)."""
    return clip.views / age_hours(clip, now)


def engagement(clip) -> float:
    if clip.views <= 0:
        return 0.0
    return (clip.likes + clip.comments + clip.shares + clip.saves) / clip.views


def score(clip, now: float | None = None) -> float:
    # Velocity dominates; engagement (shares/saves especially signal rewatch and
    # spread) boosts clips people actually act on. log keeps outliers sane.
    boost = 1 + 10 * engagement(clip)
    return math.log10(1 + velocity(clip, now)) * boost


def passes(clip, f: Filters, now: float | None = None) -> bool:
    return (
        clip.views >= f.min_views
        and age_hours(clip, now) <= f.max_age_hours
        and f.min_duration <= clip.duration <= f.max_duration
    )


def rank(clips, f: Filters, now: float | None = None):
    scored = [(score(c, now), c) for c in clips if passes(c, f, now)]
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return scored
