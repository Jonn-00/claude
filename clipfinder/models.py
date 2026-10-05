from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Clip:
    id: str
    author: str
    description: str
    created_at: int  # unix seconds
    views: int
    likes: int
    comments: int
    shares: int
    saves: int
    duration: int  # seconds
    music: str
    source: str

    @property
    def url(self) -> str:
        return f"https://www.tiktok.com/@{self.author}/video/{self.id}"
