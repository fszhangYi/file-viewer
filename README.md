# File Viewer

Local directory browser and multi-format file preview for the lab / workstation.

The **desktop process is the server**: it always starts an HTTP service that serves the Web UI. You can run **headless** (LAN / browser only) or with an **Electron window** (`--ui`). Both share the same sidebar + lazy preview frontend.

![File Viewer icon](assets/icons/icon-128.png)

## Features

- Browse a rooted folder tree (**depth = 1** per screen; double-click to enter)
- Double-click a file to preview (viewers are **lazy-loaded**)
- Optional Electron shell: pick another root directory at runtime
- Secondary “open file” path kept for one-off files
- LAN-ready (`0.0.0.0`, port via `-p`)
- Cairo-designed app icon (desktop window + favicon)

### Preview formats

| Kind | Extensions |
|------|------------|
| 3D mesh | `.stl` |
| CAD (OCCT WASM) | `.stp` `.step` |
| Point cloud | `.npz` `.npy` `.ply` `.pcd` `.xyz` |
| Markdown | `.md` |
| Word | `.docx` |
| PDF | `.pdf` |
| Spreadsheet | `.xlsx` `.xls` `.csv` |
| Image | `.png` `.jpg` `.gif` `.webp` `.svg` … |
| Video | `.mp4` `.webm` `.mov` … |
| Text / scripts | `.txt` `.json` `.sh` … |
| Archives | listed only (no content preview) |

## Requirements

- Node.js **20+** and **pnpm**
- Linux recommended (tested on Ubuntu / AutoDL)
- Electron UI needs a graphical `DISPLAY`
- Optional: FreeCAD (`freecadcmd`) for STEP→STL batch conversion tools

## Quick start

```bash
git clone git@github.com:fszhangYi/file-viewer.git
cd file-viewer
pnpm install
pnpm run build

# Headless: HTTP + Web only
./start.sh --dir /path/to/folder

# Desktop window + same server (can re-pick --dir in UI)
./start.sh --dir /path/to/folder --ui

# Port / bind
./start.sh --dir /data -p 8787 --host 0.0.0.0
```

Default listen: **`0.0.0.0:8787`**. Open `http://<host-ip>:8787/` from another device on the LAN.

### CLI flags

| Flag | Meaning |
|------|---------|
| `--dir <path>` | Root directory to browse (default: cwd) |
| `--ui` | Open Electron window |
| `-p` / `--port` | HTTP port (default `8787`) |
| `--host` | Bind address (default `0.0.0.0`) |

## Usage

1. Left sidebar lists the **current directory** only (files + folders).
2. **Double-click a folder** → enter that layer (still depth 1).
3. **Double-click a file** → center pane preview.
4. Use `..` or breadcrumbs to go up (cannot leave the root).
5. With `--ui`, **选择目录** replaces the server root for everyone connected to that instance.

## Architecture

```text
start.sh
  ├─ headless → node server/cli.cjs
  └─ --ui     → Electron main
                  ├─ HTTP server (API + static dist/)
                  └─ BrowserWindow → http://127.0.0.1:<port>/

API
  GET  /api/state
  GET  /api/list?cwd=
  GET  /api/file?path=
  POST /api/root          # Electron UI only (canPickDir)
```

Frontend: React 18 + Vite 5 + Ant Design 5. Heavy viewers (PDF / DOCX / Excel / CAD) load on demand.

## STEP → STL helper

Batch-convert STEP/STP next to sources (or into an output folder) with FreeCAD:

```bash
sudo apt-get install -y freecad   # once
./tools/convert_step_dir.sh /path/to/downloads --force
./tools/convert_step_dir.sh /path/to/downloads /path/to/stl_out --force
```

## Icons

Regenerate Cairo assets (desktop + web):

```bash
/usr/bin/python3 tools/generate_icons.py
```

Writes `assets/icons/`, `public/favicon*`, `electron/icon.png`.

## Development

```bash
pnpm install
pnpm run build          # tsc + vite → dist/
pnpm run typecheck
./start.sh --dir "$PWD" -p 8787
# or with UI:
./start.sh --dir "$PWD" --ui -p 8787
```

Do not commit `node_modules/` or `dist/` (see `.gitignore`).

## License

Private / unlicensed unless stated otherwise by the repository owner.
