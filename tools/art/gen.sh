#!/usr/bin/env bash
# Generate art sheets with Codex image generation. Usage: tools/art/gen.sh [sheetKey...]
# Raw images land in assets/gen/raw/<key>.png; then run tools/art/slice.cjs.
set -u
cd "$(dirname "$0")/../.."
mkdir -p assets/gen/raw
keys=("$@")
[ ${#keys[@]} -eq 0 ] && keys=($(node -e "console.log(require('./tools/art/sheets.json').map(s=>s.key).join(' '))"))
for k in "${keys[@]}"; do
  [ -s "assets/gen/raw/$k.png" ] && { echo "skip $k"; continue; }
  prompt=$(node -e "const s=require('./tools/art/sheets.json').find(s=>s.key==='$k'); console.log(s.prompt)")
  marker=$(mktemp); sleep 1
  echo "== generating $k"
  timeout 900 codex exec --skip-git-repo-check -s workspace-write -C assets/gen/raw \
    "Use your image generation tool exactly once. $prompt After generating, save/copy the PNG to ./$k.png in the current directory and reply DONE." \
    </dev/null > "assets/gen/raw/$k.log" 2>&1
  if [ ! -s "assets/gen/raw/$k.png" ]; then
    f=$(find ~/.codex/generated_images -type f -name '*.png' -newer "$marker" -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
    [ -n "$f" ] && cp "$f" "assets/gen/raw/$k.png"
  fi
  rm -f "$marker"
  [ -s "assets/gen/raw/$k.png" ] && echo "ok $k" || { echo "FAILED $k"; tail -3 "assets/gen/raw/$k.log"; }
done
