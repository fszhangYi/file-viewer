#!/usr/bin/env bash
# Convert STEP/STP → STL with FreeCAD (freecadcmd).
# Usage:
#   ./tools/convert_step_dir.sh /path/to/dir
#   ./tools/convert_step_dir.sh /path/to/file.stp
#   ./tools/convert_step_dir.sh /path/to/dir /path/to/out_dir --force
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/tools/step_to_stl_freecad.py"

if [ $# -lt 1 ]; then
  echo "usage: $0 <step-file-or-dir> [out-dir] [--force]" >&2
  exit 2
fi

INPUT="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
shift
OUT=""
FORCE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --force|-f) FORCE=1; shift ;;
    --*)
      echo "unknown option: $1" >&2
      exit 2
      ;;
    *)
      if [ -z "$OUT" ]; then
        mkdir -p "$1"
        OUT="$(cd "$1" && pwd)"
        shift
      else
        echo "unexpected arg: $1" >&2
        exit 2
      fi
      ;;
  esac
done

FREECADCMD="$(command -v freecadcmd || command -v FreeCADCmd || true)"
if [ -z "$FREECADCMD" ]; then
  echo "error: freecadcmd not found. Install: sudo apt-get install -y freecad" >&2
  exit 1
fi

export STEP2STL_FORCE="$FORCE"
if [ -d "$INPUT" ]; then
  export STEP2STL_DIR="$INPUT"
  if [ -n "$OUT" ]; then
    export STEP2STL_OUT_DIR="$OUT"
  else
    unset STEP2STL_OUT_DIR || true
  fi
  unset STEP2STL_IN STEP2STL_OUT || true
else
  export STEP2STL_IN="$INPUT"
  if [ -n "$OUT" ]; then
    export STEP2STL_OUT="$OUT/$(basename "${INPUT%.*}").stl"
  else
    export STEP2STL_OUT="${INPUT%.*}.stl"
  fi
  unset STEP2STL_DIR STEP2STL_OUT_DIR || true
fi

echo "FreeCAD: $FREECADCMD"
echo "Input:   $INPUT"
[ -n "${STEP2STL_OUT_DIR:-}" ] && echo "Out dir: $STEP2STL_OUT_DIR"
[ -n "${STEP2STL_OUT:-}" ] && echo "Out file:$STEP2STL_OUT"

# Clear ROS/conda lib conflicts that break FreeCAD's libffi.
exec env -u LD_LIBRARY_PATH -u PYTHONPATH \
  STEP2STL_IN="${STEP2STL_IN:-}" \
  STEP2STL_OUT="${STEP2STL_OUT:-}" \
  STEP2STL_DIR="${STEP2STL_DIR:-}" \
  STEP2STL_OUT_DIR="${STEP2STL_OUT_DIR:-}" \
  STEP2STL_FORCE="$FORCE" \
  "$FREECADCMD" -c "exec(open(r'''$SCRIPT''', encoding='utf-8').read())"
