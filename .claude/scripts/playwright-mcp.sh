#!/bin/sh
# Launches the Playwright MCP server. In Claude Code cloud sessions it runs
# headless against the container's preinstalled Chromium; locally it uses
# Playwright's defaults so you get a visible browser.
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ] && [ -x /opt/pw-browsers/chromium ]; then
  exec npx -y @playwright/mcp@latest --headless --isolated --no-sandbox \
    --executable-path /opt/pw-browsers/chromium "$@"
fi
exec npx -y @playwright/mcp@latest "$@"
