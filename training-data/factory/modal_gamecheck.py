"""
modal_gamecheck.py - gamecheck.mjs `gate` then `validate`, one harvested game per Modal CPU container.

    MSYS_NO_PATHCONV=1 python -m modal run factory/modal_gamecheck.py \
        --manifest factory/raw/workspaces_manifest.jsonl [--limit 0]

WHY
---
Validating one game locally takes ~2.5 min (each goal is graded twice, on the untouched game and
on its reference edit, in a real browser), so ~300 games is ~12 hours on the laptop. Every game is
independent - the same argument that moved the harvest to Modal (984 repos in ~3.5 min).

ONE CHECKER, NOT TWO
--------------------
The container runs the SAME gamecheck.mjs, unmodified, with the hub's own browser.js,
engineCache.js and visualCheck.js beside it in the repo layout it expects - so the gate pass
really is the hub's finish gate, and a check cannot drift between laptop and container.
browser.js honours PUPPETEER_EXECUTABLE_PATH first, which the image points at Playwright's Chromium.

LOCAL DISK, NOT THE VOLUME
--------------------------
The first container smoke served games straight off the network volume on 1 CPU, and the hub's
visual gate called PiratesGame's canvas BLANK - while the identical files on the laptop gave
"11 distinct colours ... No visual problems found". Its sprites had simply not arrived by the
gate's 1.2 s settle. The real hub serves from a local disk, so each game is now copied to the
container's local disk first, on 2 CPUs: a slow disk must never reject a working game.

Per game: its one manifest row is written where gamecheck expects the manifest, raw/workspaces
points at the local copy, `gate` runs, and only a gate-clean game goes on to `validate`.
Results stream back and are written to the LOCAL raw/gate_check.jsonl and raw/game_goals.jsonl.
Ephemeral `modal run` app: it stops when the run ends. No GPU.
"""
import json
import os
import pathlib
import shutil
import subprocess

import modal

HERE = pathlib.Path(__file__).parent
SERVER = HERE.parent.parent / "server"

app = modal.App("hub-gamecheck")
ws_vol = modal.Volume.from_name("harvest-ws-out", create_if_missing=False)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ca-certificates", "curl", "fonts-liberation")
    .pip_install("playwright==1.47.0")
    .run_commands(
        "playwright install --with-deps chromium",
        "ln -sf \"$(ls -d /root/.cache/ms-playwright/chromium-*/chrome-linux/chrome | head -1)\" /usr/local/bin/chromium-pw",
        "curl -fsSL https://deb.nodesource.com/setup_22.x | bash -",
        "apt-get install -y nodejs",
        "mkdir -p /app/server /app/training-data/factory/raw",
        "cd /app && npm init -y >/dev/null 2>&1",
        "cd /app && PUPPETEER_SKIP_DOWNLOAD=1 npm install --no-fund --no-audit puppeteer@25.1.0",
    )
    .env({"PUPPETEER_EXECUTABLE_PATH": "/usr/local/bin/chromium-pw", "PUPPETEER_SKIP_DOWNLOAD": "1"})
    .add_local_file(str(SERVER / "browser.js"), "/app/server/browser.js", copy=True)
    .add_local_file(str(SERVER / "engineCache.js"), "/app/server/engineCache.js", copy=True)
    .add_local_file(str(SERVER / "visualCheck.js"), "/app/server/visualCheck.js", copy=True)
    .add_local_file(str(HERE / "gamecheck.mjs"), "/app/training-data/factory/gamecheck.mjs", copy=True)
)

FACTORY = "/app/training-data/factory"


def _read_jsonl(path):
    p = pathlib.Path(path)
    if not p.exists():
        return []
    out = []
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return out


@app.function(image=image, cpu=2.0, memory=2048, timeout=60 * 12, retries=0, max_containers=50,
              volumes={"/out": ws_vol})
def check_game(row: dict) -> dict:
    """gate, then (if clean) validate, for ONE kept game. Returns its gate row, goal rows and log lines."""
    raw = pathlib.Path(FACTORY) / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    slug = pathlib.Path(row["dir"]).name
    local = pathlib.Path("/tmp/ws")
    local.mkdir(parents=True, exist_ok=True)
    src = pathlib.Path("/out/workspaces") / slug
    if not src.exists():
        return {"repo": row["repo"], "gate": {"repo": row["repo"], "dir": row.get("dir"), "entry": row.get("entry"),
                "gateClean": False, "why": "workspace not on the volume"}, "goals": [], "log": []}
    if not (local / slug).exists():
        # local disk, not the network volume. Symlinks copied as links, dangling ones ignored:
        # three repos carry broken symlinks and a plain copytree died on them (Errno 2).
        shutil.copytree(str(src), str(local / slug), symlinks=True, ignore_dangling_symlinks=True)
    link = raw / "workspaces"
    if not link.exists():
        os.symlink(str(local), str(link))
    (raw / "workspaces_manifest.jsonl").write_text(json.dumps(row) + "\n", encoding="utf-8")
    for f in ("gate_check.jsonl", "game_goals.jsonl"):
        (raw / f).unlink(missing_ok=True)

    def node(mode, secs):
        try:
            p = subprocess.run(["node", f"{FACTORY}/gamecheck.mjs", mode], capture_output=True, text=True,
                               timeout=secs, cwd="/app")
            return p.stdout + p.stderr
        except subprocess.TimeoutExpired as e:
            out = e.stdout.decode(errors="replace") if isinstance(e.stdout, bytes) else (e.stdout or "")
            return f"{mode} TIMED OUT after {secs}s\n" + out

    log = node("gate", 120)
    gate = _read_jsonl(raw / "gate_check.jsonl")
    gate_row = gate[0] if gate else {"repo": row["repo"], "dir": row.get("dir"), "entry": row.get("entry"),
                                     "gateClean": False, "why": "gate produced no row: " + log[-200:]}
    goals = []
    if gate_row.get("gateClean"):
        log += node("validate", 60 * 10)
        goals = _read_jsonl(raw / "game_goals.jsonl")
    lines = [l for l in log.splitlines() if l.startswith(("clean ", "TRIPS ")) or row["repo"] in l]
    return {"repo": row["repo"], "gate": gate_row, "goals": goals, "log": lines[-4:]}


@app.local_entrypoint()
def main(manifest: str, limit: int = 0):
    rows = [r for r in _read_jsonl(manifest) if r.get("status") == "kept"]
    if limit:
        rows = rows[:limit]
    raw = pathlib.Path(manifest).parent
    gate_out, goals_out = raw / "gate_check.jsonl", raw / "game_goals.jsonl"
    print(f"{len(rows)} kept games -> gate + validate on Modal CPU", flush=True)
    per_goal, clean, done = {}, 0, 0
    with gate_out.open("w", encoding="utf-8") as g, goals_out.open("w", encoding="utf-8") as v:
        for res in check_game.map(rows, order_outputs=False, return_exceptions=True):
            done += 1
            if isinstance(res, Exception):
                print(f"  ! exception: {str(res)[:120]}", flush=True)
                continue
            g.write(json.dumps(res["gate"]) + "\n")
            g.flush()
            if res["gate"].get("gateClean"):
                clean += 1
            for goal in res["goals"]:
                v.write(json.dumps(goal) + "\n")
                per_goal[goal["goal"]] = per_goal.get(goal["goal"], 0) + 1
            v.flush()
            tag = f"{len(res['goals'])} goals" if res["gate"].get("gateClean") else "TRIPS: " + str(res["gate"].get("why", ""))[:80]
            print(f"  {done:>4}/{len(rows)} {res['repo']:<44} {tag}", flush=True)
    total = sum(per_goal.values())
    print(f"\n{clean}/{len(rows)} games pass the hub finish gate untouched; {total} validated goals {json.dumps(per_goal)}", flush=True)
    print(f"-> {gate_out}\n-> {goals_out}")
