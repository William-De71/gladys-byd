#!/usr/bin/env bash
# Builds cover.jpg (800 x 534, < 150 KB, as the store requires) from
# docs/assets/cover.svg. Needs ImageMagick, and Inkscape or else Chrome /
# Chromium (CHROME=/path/to/chrome, or the Playwright one).
set -euo pipefail
cd "$(dirname "$0")/.."
im="$(command -v magick || command -v convert)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
if command -v inkscape >/dev/null; then
  inkscape docs/assets/cover.svg --export-type=png --export-filename="$tmp/cover.png" -w 800 -h 534 >/dev/null 2>&1
else
  chrome="${CHROME:-$(ls -d /opt/pw-browsers/chromium-*/chrome-linux*/chrome "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux*/chrome 2>/dev/null | tail -n1 || true)}"
  [ -x "$chrome" ] || { echo "neither Inkscape nor Chrome found: set CHROME=/path/to/chrome" >&2; exit 1; }
  # The headless window is taller than the page: crop it to the cover.
  printf '<html><body style="margin:0"><img src="file://%s" width="800" height="534"></body></html>' \
    "$PWD/docs/assets/cover.svg" >"$tmp/cover.html"
  "$chrome" --headless --no-sandbox --disable-gpu --hide-scrollbars --allow-file-access-from-files \
    --window-size=800,800 --screenshot="$tmp/full.png" "file://$tmp/cover.html" >/dev/null 2>&1
  "$im" "$tmp/full.png" -crop 800x534+0+0 +repage "$tmp/cover.png"
fi
"$im" "$tmp/cover.png" -strip -quality 85 -sampling-factor 4:2:0 cover.jpg
size="$(stat -c %s cover.jpg)"
dims="$("$im" cover.jpg -format '%wx%h' info:)"
echo "cover.jpg: ${dims}, ${size} bytes"
[ "$dims" = "800x534" ] || { echo "wrong dimensions" >&2; exit 1; }
[ "$size" -lt $((150 * 1024)) ] || { echo "too heavy" >&2; exit 1; }
