#!/usr/bin/env bash
#
# Render the narration to MP3 and check every clip fits its scene.
#
# Needs edge-tts:  pip install edge-tts
# The voice is fixed so re-runs are consistent.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VIDEO_ROOT="$(cd "$HERE/.." && pwd)"
OUT="$VIDEO_ROOT/public/narration"
VOICE="en-GB-RyanNeural"
RATE="-4%"

mkdir -p "$OUT"

if [ -f "$HOME/tts-venv/bin/activate" ]; then
  # shellcheck disable=SC1091
  source "$HOME/tts-venv/bin/activate"
fi

command -v edge-tts >/dev/null 2>&1 || {
  echo "edge-tts not found. Install it with: pip install edge-tts" >&2
  exit 1
}

# Scene budgets, in seconds. Must match video/src/config.ts.
declare -A BUDGET=(
  [hook]=16 [falsePass]=27 [problem]=11 [document]=13 [terminal]=38
  [browser]=21 [green]=15 [accept]=12
)

echo "Rendering narration with $VOICE"
"$VIDEO_ROOT/../node_modules/.bin/tsx" "$HERE/narration-lines.mjs" | while IFS=$'\t' read -r scene text; do
  [ -z "$scene" ] && continue
  file="$OUT/$scene.mp3"
  edge-tts --voice "$VOICE" --rate="$RATE" --text "$text" --write-media "$file" >/dev/null 2>&1

  # Duration straight from the MP3 frame headers — no ffprobe on this box.
  duration="$(node "$HERE/mp3-duration.mjs" "$file")"
  budget="${BUDGET[$scene]}"
  fits="ok"
  awk -v d="$duration" -v b="$budget" 'BEGIN { exit !(d > b - 0.6) }' && fits="OVERRUNS"

  printf '  %-11s %5.1fs / %2ss  %s\n' "$scene" "$duration" "$budget" "$fits"
done

echo
echo "Written to $OUT"
