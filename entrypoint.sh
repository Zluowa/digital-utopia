#!/bin/sh
# @input: WORLD env var (default: genesis), AGENTS env var (optional)
# @output: Running engine on PORT (default: 4000)
# @position: Docker entrypoint — bootstrap world if missing, then start engine

WORLD="${WORLD:-genesis}"
WORLD_DIR="/app/worlds/$WORLD"

if [ ! -d "$WORLD_DIR/.world" ]; then
  echo "[entrypoint] No world found. Creating: $WORLD"
  AGENTS="${AGENTS:-alice,bob,charlie}"
  npx tsx engine/src/bootstrap-cli.ts "$WORLD" $(echo "$AGENTS" | tr ',' ' ')
fi

echo "[entrypoint] Starting engine: $WORLD"
exec npx tsx engine/src/start.ts "$WORLD"
