#!/usr/bin/env python3
"""Harvest training examples from a multi-file ES-module game (Project Memory Card).

Unlike harvest_html.py (single-file HTML/IIFE), this walks a directory of ES
modules and emits two kinds of example, both in the existing examples_done
format ( <id>-<tag>-<name>/ with output.js + a [REVIEW] prompt stub ):

  1. WHOLE-FILE examples  — each single-responsibility module, header + imports +
     all its constructs. Teaches module composition & idioms. id-<tag>file-<path>
  2. TOP-LEVEL UNIT examples — each exported/top-level class, function, arrow,
     or object table on its own. Teaches the isolated construct. id-<tag>-<name>

Content is de-duplicated by hash across ALL runs (.seen_hashes.txt), so re-running
only adds NEW material. Each run adds at most --limit examples (default 300) so a
big harvest can be done in controlled batches; the script prints how many remain.

Usage (defaults target the memory-card game):
    python harvest_modules.py                 # first batch of <=300
    python harvest_modules.py                 # run again for the next batch
    python harvest_modules.py --limit 150
    python harvest_modules.py --no-files       # units only
"""
import argparse
import hashlib
import pathlib
import re

HERE = pathlib.Path(__file__).parent
DEFAULT_SRC = pathlib.Path(
    r"C:\Users\tatte\OneDrive\Documents\new-game-project\project-memory-card"
)
MIN_BYTES, MAX_BYTES = 300, 40_000
BASE_ID = 1000  # keep clear of the existing ~707 ids so sets can be merged

ap = argparse.ArgumentParser()
ap.add_argument("--src", type=pathlib.Path, default=DEFAULT_SRC, help="game root (contains js/)")
ap.add_argument("--tag", default="memcard")
ap.add_argument("--limit", type=int, default=300, help="max NEW examples to add this run")
ap.add_argument("--out", type=pathlib.Path, default=HERE / "examples")
ap.add_argument("--no-files", action="store_true", help="skip whole-file examples")
args = ap.parse_args()

EX = args.out
EX.mkdir(parents=True, exist_ok=True)
SEEN = HERE / ".seen_hashes.txt"
seen = set(SEEN.read_text().split()) if SEEN.exists() else set()

existing_ids = [int(p.name[:4]) for p in EX.iterdir() if p.is_dir() and p.name[:4].isdigit()]
nid = max(existing_ids, default=BASE_ID - 1) + 1


def block_end(s, start):
    """Index of the '}' closing the first '{' at/after `start` (string/comment aware)."""
    try:
        i = s.index("{", start)
    except ValueError:
        return -1
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


# Top-level declarations (allow an optional `export ` / `export default `).
PATTERNS = [
    re.compile(r"^(?:export\s+)?(?:default\s+)?class\s+(\w+)[^\{]*\{", re.M),
    re.compile(r"^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*(\w+)\s*\([^)]*\)\s*\{", re.M),
    re.compile(r"^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function\s*\*?\s*\([^)]*\)\s*\{", re.M),
    re.compile(r"^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*\(?\s*(?:async\s+)?\(?[^=\n]*\)?\s*=>\s*\{", re.M),
    re.compile(r"^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*\{", re.M),  # object tables (STATES, BEHAVIORS…)
]


def first_doc_line(text):
    m = re.search(r"\*\s*([^\n*][^\n]*)", text)  # first non-empty line of a JSDoc block
    return m.group(1).strip() if m else ""


# Collect every candidate (file-level + unit-level) before applying the limit,
# so we can report how many remain after this batch.
candidates = []  # (kind, name, text, hint)
files = sorted(p for p in (args.src / "js").rglob("*.js") if p.is_file())
for f in files:
    code = f.read_text(encoding="utf-8", errors="ignore")
    rel = f.relative_to(args.src).as_posix()
    slug = f.relative_to(args.src / "js").as_posix().rsplit(".", 1)[0].replace("/", "-")

    if not args.no_files and MIN_BYTES <= len(code.encode()) <= MAX_BYTES:
        candidates.append(("file", slug, code, f"module {rel}: {first_doc_line(code)}"))

    found = {}
    for pat in PATTERNS:
        for m in pat.finditer(code):
            end = block_end(code, m.start())
            if end == -1:
                continue
            j = end + 1
            while j < len(code) and code[j] in " \t)(;":  # swallow trailing )();
                j += 1
            found[m.start()] = (m.group(1), code[m.start():j].strip())
    for start in sorted(found):
        name, text = found[start]
        if MIN_BYTES <= len(text.encode()) <= MAX_BYTES:
            candidates.append(("unit", name, text, f"{name} (from {rel})"))

# Dedup + write up to --limit new ones.
added = dup = skipped = 0
remaining = 0
for kind, name, text, hint in candidates:
    h = hashlib.sha1(re.sub(r"\s+", " ", text).encode()).hexdigest()
    if h in seen:
        dup += 1
        continue
    if added >= args.limit:
        remaining += 1
        continue
    seen.add(h)
    prefix = f"{args.tag}file" if kind == "file" else args.tag
    folder = EX / f"{nid:04d}-{prefix}-{name}"
    folder.mkdir(exist_ok=True)
    (folder / "output.js").write_text(text, encoding="utf-8")
    (folder / "prompt.txt").write_text(
        f"[REVIEW - write a real instruction]\n{hint}\n", encoding="utf-8")
    nid += 1
    added += 1

SEEN.write_text("\n".join(sorted(seen)))
total_now = len([p for p in EX.iterdir() if p.is_dir()])
print(f"added {added}  (deduped {dup} already-seen)")
print(f"examples in this patch now: {total_now}")
if remaining:
    print(f"[!] {remaining} more NEW examples waiting — run again for the next batch (--limit {args.limit}).")
else:
    print("[done] all available material harvested.")
