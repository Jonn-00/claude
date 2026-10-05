import os
import pytest

CHROMIUM = "/opt/pw-browsers/chromium"


@pytest.fixture(scope="session")
def context(tmp_path_factory):
    """Headless persistent context for local-page tests (skipped if no browser)."""
    from clipfinder.browser import open_session

    if os.path.exists(CHROMIUM) and not os.environ.get("CLIPFINDER_CHROMIUM_PATH"):
        os.environ["CLIPFINDER_CHROMIUM_PATH"] = CHROMIUM
    try:
        with open_session(tmp_path_factory.mktemp("profile"), headless=True) as ctx:
            yield ctx
    except Exception as e:  # pragma: no cover
        pytest.skip(f"no usable browser: {e}")
