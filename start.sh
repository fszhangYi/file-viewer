#!/usr/bin/env bash
# File Viewer — desktop process is the server; Web always starts.
# Usage:
#   ./start.sh --dir /path/to/folder           # headless (no Electron UI)
#   ./start.sh --dir /path/to/folder --ui      # headless server + Electron window
#   ./start.sh --dir /path -p 8787 --host 0.0.0.0
set -euo pipefail
cd "$(dirname "$0")"

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$HOME/.nvm/nvm.sh"
  nvm use 20 >/dev/null 2>&1 || true
fi
export PATH="${HOME}/.nvm/versions/node/v20.20.2/bin:${PATH}"

UI=0
DIR=""
HOST="0.0.0.0"
PORT="8787"
EXTRA=()

while [ $# -gt 0 ]; do
  case "$1" in
    --ui) UI=1; shift ;;
    --dir) DIR="${2:-}"; shift 2 ;;
    --dir=*) DIR="${1#--dir=}"; shift ;;
    --host) HOST="${2:-}"; shift 2 ;;
    --host=*) HOST="${1#--host=}"; shift ;;
    -p|--port)
      PORT="${2:-}"
      if [ -z "$PORT" ]; then
        echo "error: -p/--port requires a value" >&2
        exit 2
      fi
      shift 2
      ;;
    --port=*) PORT="${1#--port=}"; shift ;;
    -p*) PORT="${1#-p}"; shift ;;
    -h|--help)
      sed -n '2,7p' "$0"
      exit 0
      ;;
    *) EXTRA+=("$1"); shift ;;
  esac
done

if [ -z "$DIR" ]; then
  DIR="$(pwd)"
fi
DIR="$(cd "$DIR" && pwd)"

if [ ! -d node_modules/vite ]; then
  echo "Installing dependencies…"
  pnpm install --ignore-scripts
  pnpm add -D @rollup/rollup-linux-x64-gnu --ignore-scripts >/dev/null 2>&1 || true
fi

if [ ! -f dist/index.html ]; then
  echo "Building web UI…"
  pnpm run build
fi

ARGS=(--dir "$DIR" --host "$HOST" --port "$PORT")
if [ "$UI" -eq 1 ]; then
  ARGS+=(--ui)
fi
ARGS+=("${EXTRA[@]+"${EXTRA[@]}"}")

if [ "$UI" -eq 1 ]; then
  if [ -z "${DISPLAY:-}" ] && [ "$(uname -s)" = "Linux" ]; then
    echo "warning: DISPLAY unset — --ui needs a graphical session." >&2
  fi
  if [ ! -d node_modules/electron ]; then
    pnpm add -D electron@34.5.8
  fi
  if [ ! -x node_modules/electron/dist/electron ]; then
    export ELECTRON_MIRROR="${ELECTRON_MIRROR:-https://npmmirror.com/mirrors/electron/}"
    (cd node_modules/electron && node install.js)
  fi
  echo "Starting File Viewer (UI)  dir=$DIR  http://0.0.0.0:$PORT/"
  exec env -u VITE_DEV_SERVER_URL pnpm exec electron . "${ARGS[@]}"
fi

echo "Starting File Viewer (headless)  dir=$DIR  http://0.0.0.0:$PORT/"
exec node server/cli.cjs "${ARGS[@]}"
