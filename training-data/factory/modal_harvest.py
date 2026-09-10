"""
modal_harvest.py - clone and mine hundreds of repos in parallel, on Modal.

    python factory/launch.py harvest --list repos_js_clean.json --out harvest_js.jsonl
    python -m modal run factory/modal_harvest.py --list-file factory/repos_js_clean.json

WHY
---
Cloning ~400 repos one at a time on a laptop is bounded by one machine's bandwidth and one
disk. It is also embarrassingly parallel: every repo is independent, and the work is
clone -> read files -> emit rows -> delete.

This is the same argument modal_chromium.py already makes in this repo, and it was right
then: "This is CPU work, not GPU work, so a Modal CPU container is cheap - and Modal can
run many of them, so concurrency stops being bounded by one machine." A serial local run
was measured at roughly 20 small repos/minute and decelerating as repo size grows; 40
containers on datacentre bandwidth turn hours into minutes for a few cents of CPU time.

ONE EXTRACTOR, NOT TWO
----------------------
The container runs the SAME `factory/harvest_one.mjs` used locally, via node. Reimplementing
the extraction in Python would double every future fix and the two copies would disagree
within a day - the exact drift this project has already been bitten by (Sidebar's second
copy of the nav list, and gate.mjs's two contracts).
"""
import json
import os
import pathlib
import subprocess

import modal

HERE = pathlib.Path(__file__).parent

app = modal.App("hub-harvest")
out_vol = modal.Volume.from_name("harvest-out", create_if_missing=True)

# node + git, then the JS deps the extractor needs. web-tree-sitter and tree-sitter-wasms
# are pure JS/WASM so they need no build toolchain; tree-sitter-gdscript ships a linux-x64
# prebuild, so the native binding also works without a compiler.
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ca-certificates", "curl")
    .run_commands(
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
        "apt-get install -y nodejs",
        "mkdir -p /app",
        "cd /app && npm init -y >/dev/null 2>&1",
        "cd /app && npm install --silent web-tree-sitter@0.25.10 tree-sitter-wasms "
        "tree-sitter tree-sitter-gdscript",
    )
    .add_local_file(str(HERE / "ts_extract.mjs"), "/app/factory/ts_extract.mjs", copy=True)
    .add_local_file(str(HERE / "harvest_one.mjs"), "/app/factory/harvest_one.mjs", copy=True)
)


@app.function(
    image=image,
    cpu=1.0,
    memory=2048,
    timeout=60 * 12,
    retries=0,          # a repo that fails to clone is not a transient failure worth a second GPU-minute
    max_containers=48,
)
def harvest_repo(repo: dict) -> dict:
    """Clone one repo, mine it, delete it. Returns {repo, rows, error}."""
    import shutil
    import tempfile

    name = repo["name"]
    dest = tempfile.mkdtemp(prefix="repo-")
    try:
        subprocess.run(
            ["git", "clone", "--depth", "1", "--quiet", "--no-tags",
             f"https://github.com/{name}.git", dest],
            check=True, capture_output=True, timeout=300,
        )
    except Exception as e:  # noqa: BLE001
        shutil.rmtree(dest, ignore_errors=True)
        return {"repo": name, "rows": [], "error": f"clone: {str(e)[:120]}"}

    try:
        p = subprocess.run(
            ["node", "/app/factory/harvest_one.mjs",
             "--dir", dest, "--repo", name,
             "--license", str(repo.get("license") or ""),
             "--stars", str(repo.get("stars") or 0)],
            capture_output=True, text=True, timeout=300, cwd="/app",
        )
        rows = []
        for line in p.stdout.splitlines():
            line = line.strip()
            if not line.startswith("{"):
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                pass
        err = None if rows or p.returncode == 0 else (p.stderr or "")[-200:]
        return {"repo": name, "rows": rows, "error": err}
    except Exception as e:  # noqa: BLE001
        return {"repo": name, "rows": [], "error": f"extract: {str(e)[:120]}"}
    finally:
        shutil.rmtree(dest, ignore_errors=True)


@app.function(image=image, volumes={"/out": out_vol}, timeout=60 * 90)
def run_all(repos: list, out_name: str) -> dict:
    """Fan out over every repo and write one jsonl to the volume."""
    total = 0
    failed = 0
    per_repo = []
    path = f"/out/{out_name}"
    with open(path, "w", encoding="utf-8") as f:
        # Results stream back as they finish, so a long tail never blocks the rest, and
        # rows are on disk as they arrive rather than held until the end - the eval lost
        # 19 paid-for generations to exactly that mistake.
        for res in harvest_repo.map(repos, order_outputs=False, return_exceptions=True):
            if isinstance(res, Exception):
                failed += 1
                continue
            if res.get("error"):
                failed += 1
            for row in res.get("rows", []):
                f.write(json.dumps(row) + "\n")
                total += 1
            per_repo.append({"repo": res["repo"], "rows": len(res.get("rows", []))})
    out_vol.commit()
    per_repo.sort(key=lambda r: -r["rows"])
    return {"rows": total, "repos": len(repos), "failed": failed, "top": per_repo[:15], "out": out_name}


@app.local_entrypoint()
def main(list_file: str, out_name: str = "harvest.jsonl", limit: int = 0):
    data = json.loads(pathlib.Path(list_file).read_text(encoding="utf-8"))
    repos = data["permissive"] if isinstance(data, dict) else data
    if limit:
        repos = repos[:limit]
    print(f"harvesting {len(repos)} repos -> volume harvest-out/{out_name}", flush=True)
    r = run_all.remote(repos, out_name)
    print(json.dumps(r, indent=2))
    print(f"\n  python -m modal volume get harvest-out {out_name} ./factory/{out_name}")
