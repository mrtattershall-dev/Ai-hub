#!/usr/bin/env python3
"""Harvest top-level JS modules/functions out of a single-file HTML game.

Usage:
    python harvest_html.py <file.html> <tag>

Pulls each top-level construct from the page's inline <script> blocks:
  - IIFE modules:   const Name = (() => { ... })();
  - functions:      function name(...) { ... }
  - const fns:      const name = function(...) { ... }  /  const name = (...) => { ... }
  - classes:        class Name { ... }

Each becomes examples/<id>-<tag>-<name>/ with output.js + a [REVIEW] prompt stub.
Content is de-duplicated by hash across ALL runs (so near-identical modules from
many game versions only get added once). Too-small (<300 B) / too-big (>40 KB)
units are skipped.
"""
import sys
import re
import hashlib
import pathlib

ROOT = pathlib.Path(__file__).parent
EX = ROOT / "examples"
EX.mkdir(exist_ok=True)
SEEN = ROOT / ".seen_hashes.txt"

MIN_BYTES, MAX_BYTES = 300, 40_000

if len(sys.argv) < 3:
    print("usage: python harvest_html.py <file.html> <tag>")
    sys.exit(1)
src = pathlib.Path(sys.argv[1])
tag = sys.argv[2].replace(" ", "-")
if not src.exists():
    print(f"not found: {src}")
    sys.exit(1)

seen = set(SEEN.read_text().split()) if SEEN.exists() else set()
existing = [int(p.name[:4]) for p in EX.iterdir() if p.is_dir() and p.name[:4].isdigit()]
nid = max(existing, default=0) + 1

html = src.read_text(encoding="utf-8", errors="ignore")
# inline scripts only (skip <script src=...>)
scripts = [m.group(1) for m in re.finditer(r"<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)</script>", html, re.I)]
js = "\n\n".join(scripts)


def block_end(s, start):
    """Index of the '}' that closes the first '{' at/after `start` (string/comment aware)."""
    i = s.index("{", start)
    depth, q, line_c, block_c = 0, None, False, False
    while i < len(s):
        c = s[i]
        nxt = s[i + 1] if i + 1 < len(s) else ""
        if line_c:
            if c == "\n":
                line_c = False
        elif block_c:
            if c == "*" and nxt == "/":
                block_c = False; i += 1
        elif q:
            if c == "\\":
                i += 1
            elif c == q:
                q = None
        elif c == "/" and nxt == "/":
            line_c = True; i += 1
        elif c == "/" and nxt == "*":
            block_c = True; i += 1
        elif c in "\"'`":
            q = c
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1


# top-level declarations (anchored at line start to favour real top-level units)
PATTERNS = [
    re.compile(r"^(?:const|let|var)\s+(\w+)\s*=\s*\(?\s*(?:async\s+)?\(?[^=\n]*\)?\s*=>\s*\{", re.M),
    re.compile(r"^(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{", re.M),
    re.compile(r"^(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function\s*\*?\s*\([^)]*\)\s*\{", re.M),
    re.compile(r"^class\s+(\w+)[^\{]*\{", re.M),
]

found = {}  # start_index -> (name, text)
for pat in PATTERNS:
    for m in pat.finditer(js):
        end = block_end(js, m.start())
        if end == -1:
            continue
        j = end + 1
        while j < len(js) and js[j] in " \t)(;":  # swallow trailing )();
            j += 1
        text = js[m.start():j].strip()
        found[m.start()] = (m.group(1), text)

added = skipped = dup = 0
for start in sorted(found):
    name, text = found[start]
    if not (MIN_BYTES <= len(text.encode()) <= MAX_BYTES):
        skipped += 1
        continue
    h = hashlib.sha1(re.sub(r"\s+", " ", text).encode()).hexdigest()
    if h in seen:
        dup += 1
        continue
    seen.add(h)
    folder = EX / f"{nid:04d}-{tag}-{name}"
    folder.mkdir(exist_ok=True)
    (folder / "output.js").write_text(text, encoding="utf-8")
    (folder / "prompt.txt").write_text(
        f"[REVIEW - write a real instruction]\nModule/function: {name}  (from {tag})\n",
        encoding="utf-8")
    nid += 1
    added += 1

SEEN.write_text("\n".join(sorted(seen)))
print(f"{src.name}: added {added}, skipped {skipped} (size), deduped {dup} (already seen)")
