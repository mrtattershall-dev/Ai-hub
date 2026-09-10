#!/usr/bin/env python3
"""Split the v0.2 example set into fixed-size training patches.

The harvested v0.2 folders are game-clustered (one game can dominate a contiguous
block), so a literal "first 300" would be lopsided. By default we SHUFFLE with a
fixed seed so every patch is a balanced cross-section of all games — reproducible,
and far better for incremental backtranslate+train. Use --order sequential for
strict id order instead.

Each patch is written as patches/v<ver>.<n>/ (copies of the example folders) and
zipped to patches/v<ver>.<n>.zip with forward-slash paths (Kaggle/Linux-safe), so
you can upload one patch, backtranslate its ~300 stubs, train, then move to the next.

Usage:
    python split_patches.py                       # 300/patch, shuffled, v0.2.N
    python split_patches.py --size 300 --order sequential
    python split_patches.py --version 0.3 --src patch-memory-card/examples
"""
import argparse
import collections
import pathlib
import random
import re
import shutil
import zipfile

HERE = pathlib.Path(__file__).parent

ap = argparse.ArgumentParser()
ap.add_argument("--src", type=pathlib.Path, default=HERE / "examples")
ap.add_argument("--size", type=int, default=300)
ap.add_argument("--order", choices=["shuffle", "sequential"], default="shuffle")
ap.add_argument("--seed", type=int, default=42)
ap.add_argument("--version", default="0.2", help="patches named v<version>.1, .2, …")
ap.add_argument("--out", type=pathlib.Path, default=HERE / "patches")
args = ap.parse_args()

folders = sorted(p for p in args.src.iterdir() if p.is_dir())
if not folders:
    raise SystemExit(f"no example folders found in {args.src}")
if args.order == "shuffle":
    random.Random(args.seed).shuffle(folders)


def game(name):
    m = re.match(r"^\d+-([a-zA-Z]+)", name)
    return m.group(1) if m else name.split("-")[0]


def is_real(folder):
    p = folder / "prompt.txt"
    if not p.exists():
        return False
    t = p.read_text(encoding="utf-8", errors="ignore").strip()
    return bool(t) and "[REVIEW" not in t


args.out.mkdir(parents=True, exist_ok=True)
patches = [folders[i:i + args.size] for i in range(0, len(folders), args.size)]
real_total = sum(is_real(f) for f in folders)
print(f"{len(folders)} examples ({real_total} already backtranslated, "
      f"{len(folders) - real_total} stubs) -> {len(patches)} patches "
      f"of up to {args.size}  (order={args.order})\n")

for i, chunk in enumerate(patches, 1):
    name = f"v{args.version}.{i}"
    pdir = args.out / name
    if pdir.exists():
        shutil.rmtree(pdir)
    pdir.mkdir(parents=True)
    for f in chunk:
        shutil.copytree(f, pdir / f.name)

    zpath = args.out / f"{name}.zip"
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for fp in sorted(pdir.rglob("*")):
            if fp.is_file():
                z.write(fp, fp.relative_to(pdir).as_posix())  # forward slashes

    stubs = sum(not is_real(f) for f in chunk)
    dist = collections.Counter(game(f.name) for f in chunk)
    top = ", ".join(f"{k}:{v}" for k, v in dist.most_common(6))
    print(f"  {name}: {len(chunk)} examples ({stubs} to backtranslate) -> {zpath.name}")
    print(f"        mix: {top}")

print("\ndone. Upload one patch zip to Kaggle, backtranslate its stubs, train, repeat.")
