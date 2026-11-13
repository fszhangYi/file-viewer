#!/usr/bin/env python3
"""Convert STEP/STP → STL via FreeCAD (Part + Mesh).

Ways to run:
  1) freecadcmd -c with env:
       STEP2STL_IN=in.stp STEP2STL_OUT=out.stl freecadcmd -c 'exec(open("step_to_stl_freecad.py").read())'
       STEP2STL_DIR=/path/to/dir freecadcmd -c 'exec(open("step_to_stl_freecad.py").read())'
  2) Inside FreeCAD Python:
       python3 step_to_stl_freecad.py in.stp [out.stl]
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path


def convert_one(src: Path, dst: Path) -> None:
    import FreeCAD as App
    import Mesh
    import Part

    src = src.resolve()
    dst = dst.resolve()
    dst.parent.mkdir(parents=True, exist_ok=True)

    shape = Part.Shape()
    shape.read(str(src))
    if shape.isNull():
        raise RuntimeError("empty shape after STEP read")

    doc = App.newDocument("step2stl")
    try:
        obj = doc.addObject("Part::Feature", "Imported")
        obj.Shape = shape
        doc.recompute()
        Mesh.export([obj], str(dst))
    finally:
        App.closeDocument(doc.Name)

    if not dst.is_file() or dst.stat().st_size < 80:
        shape.exportStl(str(dst))
    if not dst.is_file() or dst.stat().st_size < 80:
        raise RuntimeError("STL export empty")


def iter_step_files(root: Path):
    for pattern in ("*.stp", "*.step", "*.STP", "*.STEP"):
        yield from sorted(root.glob(pattern))


def jobs_from_env():
    """Prefer env (freecadcmd -c does not forward CLI args)."""
    force = os.environ.get("STEP2STL_FORCE", "").strip() in ("1", "true", "yes")
    single_in = os.environ.get("STEP2STL_IN", "").strip()
    single_out = os.environ.get("STEP2STL_OUT", "").strip()
    batch_dir = os.environ.get("STEP2STL_DIR", "").strip()
    out_dir = os.environ.get("STEP2STL_OUT_DIR", "").strip()
    jobs_json = os.environ.get("STEP2STL_JOBS", "").strip()

    jobs = []
    if jobs_json:
        for pair in json.loads(jobs_json):
            jobs.append((Path(pair[0]), Path(pair[1])))
    elif single_in:
        src = Path(single_in)
        dst = Path(single_out) if single_out else src.with_suffix(".stl")
        jobs.append((src, dst))
    elif batch_dir:
        root = Path(batch_dir)
        dest_root = Path(out_dir) if out_dir else root
        dest_root.mkdir(parents=True, exist_ok=True)
        for f in iter_step_files(root):
            jobs.append((f, dest_root / f"{f.stem}.stl"))
    return jobs, force


def jobs_from_argv(argv):
    if len(argv) < 2:
        return [], False
    # strip freecadcmd noise: keep paths after script name if present
    args = argv[1:]
    force = False
    filtered = []
    for a in args:
        if a in ("--force", "-f"):
            force = True
        elif a.startswith("-"):
            continue
        else:
            filtered.append(a)
    if not filtered:
        return [], force
    src = Path(filtered[0])
    if src.is_dir():
        dest = Path(filtered[1]) if len(filtered) > 1 else src
        dest.mkdir(parents=True, exist_ok=True)
        return [(f, dest / f"{f.stem}.stl") for f in iter_step_files(src)], force
    dst = Path(filtered[1]) if len(filtered) > 1 else src.with_suffix(".stl")
    if dst.is_dir():
        dst = dst / f"{src.stem}.stl"
    return [(src, dst)], force


def main():
    jobs, force = jobs_from_env()
    if not jobs:
        jobs, force = jobs_from_argv(sys.argv)

    if not jobs:
        sys.stderr.write(
            "usage: set STEP2STL_DIR or STEP2STL_IN[/OUT], "
            "or: step_to_stl_freecad.py <file|dir> [out]\n"
        )
        sys.exit(2)

    ok = 0
    for src, dst in jobs:
        if not src.is_file():
            sys.stderr.write(f"missing: {src}\n")
            continue
        if dst.exists() and not force:
            print(f"skip (exists): {dst}")
            ok += 1
            continue
        print(f"convert: {src} -> {dst}")
        try:
            convert_one(src, dst)
            print(f"  ok ({dst.stat().st_size} bytes)")
            ok += 1
        except Exception as exc:
            sys.stderr.write(f"  FAIL: {exc}\n")

    print(f"done: {ok}/{len(jobs)}")
    sys.exit(0 if ok == len(jobs) else 1)


if __name__ == "__main__":
    main()
