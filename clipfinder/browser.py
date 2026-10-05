"""Browser session, captcha/block detection, and human handoff.

The browser is always headed by default: when TikTok throws a captcha or
challenge, we pause, ring the terminal bell, and wait for you to solve it in the
window. Automation resumes once the challenge is gone.
"""

from __future__ import annotations

import importlib
import os
import sys
import time
from contextlib import contextmanager
from pathlib import Path

# Selectors / phrases that mean "a human needs to look at this".
# These are best-effort heuristics; TikTok changes markup, so keep them loose.
BLOCK_SELECTORS = ", ".join([
    "#captcha_container",
    "#captcha-verify-container",
    ".captcha_verify_container",
    ".captcha-verify-container",
    "[id*='captcha' i]",
    "[class*='captcha' i]",
    "iframe[src*='captcha' i]",
    "iframe[src*='verify' i]",
])
BLOCK_PHRASES = [
    "verify to continue",
    "drag the slider",
    "select 2 objects",
    "security check",
    "maximum number of attempts reached",
    "too many requests",
    "unusual activity",
]

_DETECT_JS = """
([selector, phrases]) => {
  if (document.querySelector(selector)) return 'captcha';
  const text = ((document.body && document.body.innerText) || '').toLowerCase();
  for (const p of phrases) if (text.includes(p)) return p;
  return null;
}
"""


def is_blocked(page) -> str | None:
    """Return a short reason string if the page needs a human, else None."""
    try:
        return page.evaluate(_DETECT_JS, [BLOCK_SELECTORS, BLOCK_PHRASES])
    except Exception:
        return None  # mid-navigation; the next poll will catch it


def dismiss_popups(page) -> None:
    """Best-effort: close the dismissible 'log in' modal that appears for guests."""
    try:
        close = page.locator("[data-e2e='modal-close-inner-button']")
        if close.count():
            close.first.click(timeout=1000)
    except Exception:
        pass


def wait_for_human(page, reason: str, timeout_s: float = 1800, poll_s: float = 2.0) -> bool:
    """Block until the challenge clears. True if cleared, False on timeout/close."""
    sys.stderr.write(
        f"\a\n[clipfinder] Needs you: '{reason}'. Solve it in the browser window; "
        f"I'll resume automatically (waiting up to {int(timeout_s // 60)} min).\n"
    )
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        if page.is_closed():
            return False
        if not is_blocked(page):
            sys.stderr.write("[clipfinder] Cleared, continuing.\n")
            # Let the page settle before we start scrolling again.
            page.wait_for_timeout(1500)
            return True
        page.wait_for_timeout(int(poll_s * 1000))
    return False


def export_cookies_txt(context, path: Path) -> None:
    """Write the session's cookies in Netscape format so yt-dlp can reuse the login."""
    lines = ["# Netscape HTTP Cookie File"]
    for c in context.cookies():
        domain = c["domain"]
        prefix = "#HttpOnly_" if c.get("httpOnly") else ""
        include_sub = "TRUE" if domain.startswith(".") else "FALSE"
        expires = int(c["expires"]) if c.get("expires", -1) and c["expires"] > 0 else 0
        lines.append("\t".join([
            f"{prefix}{domain}", include_sub, c.get("path", "/"),
            "TRUE" if c.get("secure") else "FALSE", str(expires), c["name"], c["value"],
        ]))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n")
    os.chmod(path, 0o600)


@contextmanager
def open_session(profile_dir: Path, engine: str = "playwright", headless: bool = False):
    """Launch Chromium with a persistent profile so the TikTok login survives runs.

    engine: 'playwright' (default) or 'patchright' (drop-in with stronger
    anti-detection; install with `pip install clipfinder[stealth]`).
    """
    module = {"playwright": "playwright.sync_api", "patchright": "patchright.sync_api"}.get(engine)
    if module is None:
        raise ValueError(f"unknown engine {engine!r}")
    sync_playwright = importlib.import_module(module).sync_playwright

    profile_dir.mkdir(parents=True, exist_ok=True)
    kwargs = dict(
        headless=headless,
        locale="en-US",
        viewport={"width": 1280, "height": 900},
        args=["--disable-blink-features=AutomationControlled"],
    )
    # Escape hatch for machines where Playwright's bundled Chromium isn't installed.
    exe = os.environ.get("CLIPFINDER_CHROMIUM_PATH")
    if exe:
        kwargs["executable_path"] = exe

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(str(profile_dir), **kwargs)
        try:
            yield context
        finally:
            context.close()
