#!/usr/bin/env python3
"""Import a project's source files as example STUBS to mine for training data.

Usage:
    python import_project.py <path-to-project-folder> [tag]

For each source file (.js/.html/.css) that's a sensible size for one example,
it creates examples/<id>-<tag>-<name>/ containing:
    output.<ext>   - the file itself (the "ideal answer")
    prompt.txt     - a STUB instruction seeded from the file's header comment

You then edit each prompt.txt into a real instruction and run build_dataset.py.

Files that are too small (<400 B) or too big (>40 KB, i.e. a whole game in one
file) are skipped — big files should be split into focused modules by hand.
"""
import sys
import re
import shutil
import pathlib

ROOT = pathlib.Path(__file__).parent
EX = ROOT / "examples"
EX.mkdir(exist_ok=True)

EXTS = {".js", ".html", ".css"}
MIN_BYTES = 400
MAX_BYTES = 40_000

if len(sys.argv) < 2:
    print("usage: python import_project.py <project-folder> [tag]")
    sys.exit(1)

src = pathlib.Path(sys.argv[1])
if not src.exists():
    print(f"not found: {src}")
    sys.exit(1)
tag = (sys.argv[2] if len(sys.argv) > 2 else src.name).replace(" ", "-")

existing = [int(p.name[:4]) for p in EX.iterdir() if p.is_dir() and p.name[:4].isdigit()]
nid = max(existing, default=0) + 1


def seed_prompt(text, name):
    m = re.search(r"/\*([\s\S]{0,300}?)\*/", text) or re.search(r"((?:^//.*\n){1,6})", text, re.M)
    hint = (m.group(1) if m else "").replace("═", "").replace("/", "").strip()
    return (f"[REVIEW - replace with a real instruction]\n"
            f"Module: {name}\n"
            f"Header hint: {hint}\n")


count = skipped = 0
for f in sorted(src.rglob("*")):
    if f.suffix.lower() not in EXTS:
        continue
    size = f.stat().st_size
    if size < MIN_BYTES or size > MAX_BYTES:
        skipped += 1
        continue
    text = f.read_text(encoding="utf-8", errors="ignore")
    folder = EX / f"{nid:04d}-{tag}-{f.stem}"
    folder.mkdir(exist_ok=True)
    shutil.copy(f, folder / f"output{f.suffix.lower()}")
    (folder / "prompt.txt").write_text(seed_prompt(text, f.name), encoding="utf-8")
    print(f"  + {folder.name}")
    nid += 1
    count += 1

print(f"\nImported {count} stub(s), skipped {skipped} (too small/large or wrong type).")
print("Next: edit each new prompt.txt into a real instruction, then run build_dataset.py")
