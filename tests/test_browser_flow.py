"""Exercise the real browser logic against a local mock page (no TikTok involved)."""

import json
import re
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from clipfinder.browser import export_cookies_txt, is_blocked, wait_for_human
from clipfinder.scout import ScoutOptions, scout_source

NOW = 1_800_000_000


def _item(i):
    return {
        "id": str(i), "desc": f"clip {i}", "createTime": NOW - 3600,
        "author": {"uniqueId": "alice"},
        "stats": {"playCount": 100_000 + i, "diggCount": 10, "commentCount": 1, "shareCount": 1, "collectCount": 1},
        "video": {"duration": 20},
    }


PAGE = """<html><body style="height:5000px">
<script>
let n = 0;
async function load() {{ await fetch('/api/challenge/item_list/?page=' + (n++)); }}
load();
window.addEventListener('wheel', () => {{ if (n < 4) load(); }});
{extra}
</script></body></html>"""

CAPTCHA_EXTRA = """
const d = document.createElement('div'); d.id = 'captcha_container'; d.textContent = 'Verify to continue';
document.body.appendChild(d); setTimeout(() => d.remove(), 1200);
"""


@pytest.fixture()
def server():
    state = {"extra": ""}

    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_GET(self):
            if self.path.startswith("/api/challenge/item_list/"):
                page = int(self.path.split("page=")[1])
                body = json.dumps({"itemList": [_item(page * 10 + k) for k in range(10)]}).encode()
                ctype = "application/json"
            else:
                body = PAGE.format(extra=state["extra"]).encode()
                ctype = "text/html"
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.end_headers()
            self.wfile.write(body)

    srv = HTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{srv.server_port}/", state
    srv.shutdown()


def test_collects_clips_while_scrolling(context, server):
    url, _ = server
    opts = ScoutOptions(scrolls=6, min_delay=0.05, max_delay=0.1, idle_limit=3)
    clips = scout_source(context, "hashtag:test", opts, url=url)
    assert len(clips) == 40  # 4 pages x 10, deduped, parsed from live network responses
    assert all(c.source == "hashtag:test" for c in clips)


def test_pauses_on_captcha_then_resumes(context, server):
    url, state = server
    state["extra"] = CAPTCHA_EXTRA
    page = context.new_page()
    page.goto(url)
    page.wait_for_timeout(200)
    assert is_blocked(page)  # captcha element + 'verify to continue' text
    assert wait_for_human(page, "captcha", timeout_s=10, poll_s=0.3) is True
    assert is_blocked(page) is None
    page.close()


def test_scout_waits_out_captcha_and_still_collects(context, server):
    url, state = server
    state["extra"] = CAPTCHA_EXTRA
    opts = ScoutOptions(scrolls=6, min_delay=0.05, max_delay=0.1, idle_limit=3, human_timeout_s=15)
    assert len(scout_source(context, "hashtag:test", opts, url=url)) == 40


def test_wait_gives_up_on_timeout(context):
    page = context.new_page()
    page.set_content("<div id='captcha_container'>stuck</div>")
    assert wait_for_human(page, "captcha", timeout_s=1, poll_s=0.2) is False
    page.close()


def test_cookie_export_is_netscape(context, tmp_path):
    context.add_cookies([{"name": "sessionid", "value": "abc", "domain": ".tiktok.com", "path": "/",
                          "httpOnly": True, "secure": True, "expires": 2_000_000_000}])
    out = tmp_path / "cookies.txt"
    export_cookies_txt(context, out)
    text = out.read_text()
    assert text.startswith("# Netscape HTTP Cookie File")
    # Chromium clamps cookie lifetimes (~400 days), so only check the shape of the expiry.
    assert re.search(r"#HttpOnly_\.tiktok\.com\tTRUE\t/\tTRUE\t\d{10}\tsessionid\tabc", text)
    assert oct(out.stat().st_mode)[-3:] == "600"
