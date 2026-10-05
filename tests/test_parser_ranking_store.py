import time

from clipfinder.models import Clip
from clipfinder.parser import extract_clips
from clipfinder.ranking import Filters, rank, score, velocity
from clipfinder.scout import source_url
from clipfinder.store import Store

NOW = 1_800_000_000


def item(id="1", author="alice", views="1000000", age_h=10, duration=30, **kw):
    return {
        "id": id, "desc": "a clip", "createTime": NOW - age_h * 3600,
        "author": {"uniqueId": author},
        "stats": {"playCount": 5, "diggCount": 1, "commentCount": 0, "shareCount": 0, "collectCount": 0},
        "statsV2": {"playCount": views, "diggCount": "100000", "commentCount": "2000",
                    "shareCount": "30000", "collectCount": "5000"},
        "video": {"duration": duration}, "music": {"title": "sound"}, **kw,
    }


def test_parses_item_list_shape():
    clips = extract_clips({"itemList": [item("1"), item("2", "bob")], "hasMore": True}, "hashtag:x")
    assert [c.id for c in clips] == ["1", "2"]
    assert clips[0].views == 1_000_000  # statsV2 string wins over stats
    assert clips[0].url == "https://www.tiktok.com/@alice/video/1"
    assert clips[0].music == "sound" and clips[0].source == "hashtag:x"


def test_parses_search_wrapper_and_rehydration_blob():
    search = {"data": [{"type": 1, "item": item("7")}, {"type": 99, "other": 1}]}
    assert [c.id for c in extract_clips(search, "s")] == ["7"]
    blob = {"__DEFAULT_SCOPE__": {"webapp.video-detail": {"itemInfo": {"itemStruct": item("9")}}}}
    assert [c.id for c in extract_clips(blob, "s")] == ["9"]


def test_ignores_junk():
    assert extract_clips({"id": 1, "foo": "bar"}, "s") == []
    assert extract_clips(None, "s") == []
    assert extract_clips([1, "x", {"author": "no id"}], "s") == []


def _clip(**kw):
    base = dict(id="1", author="a", description="", created_at=NOW - 10 * 3600, views=1_000_000,
                likes=100_000, comments=2_000, shares=30_000, saves=5_000, duration=30, music="", source="s")
    base.update(kw)
    return Clip(**base)


def test_faster_clip_outranks_older_bigger_one():
    fast = _clip(id="fast", views=500_000, created_at=NOW - 5 * 3600)
    old = _clip(id="old", views=2_000_000, created_at=NOW - 7 * 24 * 3600)
    assert velocity(fast, NOW) > velocity(old, NOW)
    ranked = rank([old, fast], Filters(), NOW)
    assert [c.id for _, c in ranked] == ["fast", "old"]


def test_filters_drop_small_stale_and_wrong_length():
    clips = [
        _clip(id="ok"),
        _clip(id="small", views=1_000),
        _clip(id="stale", created_at=NOW - 60 * 24 * 3600),
        _clip(id="long", duration=600),
        _clip(id="tiny", duration=1),
    ]
    assert [c.id for _, c in rank(clips, Filters(), NOW)] == ["ok"]


def test_engagement_boosts_score():
    flat = _clip(id="flat", likes=0, comments=0, shares=0, saves=0)
    assert score(_clip(), NOW) > score(flat, NOW)


def test_store_dedupes_and_preserves_status(tmp_path):
    s = Store(tmp_path / "c.db")
    c = _clip(id="x")
    assert s.upsert_many([c]) == 1
    s.set_fields("x", status="shortlisted", permission="requested")
    c.views = 2_000_000
    assert s.upsert_many([c]) == 0  # duplicate refreshes stats, isn't "new"
    assert s.get_clip("x").views == 2_000_000
    assert s.meta("x")["status"] == "shortlisted" and s.meta("x")["permission"] == "requested"
    assert s.set_fields("missing", status="skipped") is False


def test_source_url():
    assert source_url("hashtag:#funny") == "https://www.tiktok.com/tag/funny"
    assert source_url("user:@bob") == "https://www.tiktok.com/@bob"
    assert source_url("search:cute cats").endswith("q=cute%20cats")
    assert source_url("foryou") == "https://www.tiktok.com/foryou"
    try:
        source_url("nonsense")
        assert False
    except ValueError:
        pass
