"""
modal_harvest_ws.py - harvest_workspaces.mjs, one repo per Modal CPU container.

    MSYS_NO_PATHCONV=1 python -m modal run factory/modal_harvest_ws.py \
        --list-file factory/repos_wide_clonable.json \
        --manifest factory/raw/workspaces_manifest.jsonl [--offset 0] [--limit 0] [--maxmb 3]

    then pull the kept games down (gitignored destination):
    MSYS_NO_PATHCONV=1 python -m modal volume get harvest-ws-out /workspaces factory/raw/

WHY
---
On the laptop the harvest runs one repo at a time, ~21 s each (clone, boot up to three pages in
headless Chrome, screenshot, copy): ~1,030 repos is ~6 hours. Every repo is independent, so this
is the modal_harvest.py argument again - CPU work, cheap per container, and many containers.
tatte, 2026-09-11: "Do the whole 1000 repos on cpu".

ONE HARVESTER, NOT TWO
----------------------
Each container runs the SAME harvest_workspaces.mjs as the laptop, in its --one mode, so the
boot rules (zero page errors, stays on the local server, canvas drawn) cannot drift between the
two paths. Inside a container there is no hub checkout, so the script falls back to plain
puppeteer and fetches CDN engines straight from the network.

Rows stream back as containers finish and are appended to the LOCAL manifest immediately, so a
dropped connection loses nothing and a rerun skips every repo already recorded. This is an
ephemeral `modal run` app: it stops when the run ends. No GPU anywhere.
"""
import json
import pathlib
import subprocess

import modal

HERE = pathlib.Path(__file__).parent

app = modal.App("hub-harvest-ws")
out_vol = modal.Volume.from_name("harvest-ws-out", create_if_missing=True)

# node 22 + git; Chromium AND its system libraries from playwright (the same path
# modal_chromium.py runs on - far less fragile than guessing apt package names); then puppeteer
# with its own Chrome download SKIPPED, pointed at playwright's Chromium instead. The first build
# failed inside `npm install --silent puppeteer` - the download step is the moving part, so it is
# removed rather than retried, and the install is no longer silent.
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ca-certificates", "curl", "fonts-liberation")
    .pip_install("playwright==1.47.0")
    .run_commands(
        "playwright install --with-deps chromium",
        "ln -sf \"$(ls -d /root/.cache/ms-playwright/chromium-*/chrome-linux/chrome | head -1)\" /usr/local/bin/chromium-pw",
        "/usr/local/bin/chromium-pw --version",
        "curl -fsSL https://deb.nodesource.com/setup_22.x | bash -",
        "apt-get install -y nodejs",
        "mkdir -p /app/factory",
        "cd /app && npm init -y >/dev/null 2>&1",
        "cd /app && PUPPETEER_SKIP_DOWNLOAD=1 npm install --no-fund --no-audit puppeteer@25.1.0",
    )
    .env({"PUPPETEER_EXECUTABLE_PATH": "/usr/local/bin/chromium-pw", "PUPPETEER_SKIP_DOWNLOAD": "1"})
    .add_local_file(str(HERE / "harvest_workspaces.mjs"), "/app/factory/harvest_workspaces.mjs", copy=True)
)


@app.function(
    image=image,
    cpu=1.0,
    memory=2048,
    timeout=60 * 6,
    retries=0,
    max_containers=50,
    volumes={"/out": out_vol},
)
def harvest_one(repo: dict) -> dict:
    """One repo through harvest_workspaces.mjs --one. Returns its manifest row."""
    name = repo["name"]
    try:
        p = subprocess.run(
            ["node", "/app/factory/harvest_workspaces.mjs", "--one", name,
             "--license", str(repo.get("license") or ""), "--stars", str(repo.get("stars") or 0),
             "--mb", str(repo.get("mb") or 0), "--dest", "/out/workspaces", "--work", "/tmp/hw"],
            capture_output=True, text=True, timeout=60 * 5, cwd="/app",
        )
    except Exception as e:  # noqa: BLE001
        return {"repo": name, "license": repo.get("license"), "stars": repo.get("stars"), "mb": repo.get("mb"),
                "status": "error", "error": f"container: {str(e)[:160]}"}
    row = None
    for line in p.stdout.splitlines():
        if line.startswith("ROW "):
            try:
                row = json.loads(line[4:])
            except json.JSONDecodeError:
                pass
    if row is None:
        row = {"repo": name, "license": repo.get("license"), "stars": repo.get("stars"), "mb": repo.get("mb"),
               "status": "error", "error": ((p.stderr or "") + (p.stdout or ""))[-240:]}
    if row.get("status") == "kept":
        out_vol.commit()
    return row


@app.function(image=image, volumes={"/out": out_vol}, timeout=60 * 10)
def pack() -> dict:
    """Tar the volume's /workspaces into ONE file on the volume.

    `modal volume get` on the whole directory failed on Windows part-way ("Output path ...
    already exists") after ~93 of ~300 folders, leaving empty directories behind. One archive is
    one download, and extraction happens locally where it can be checked.

        MSYS_NO_PATHCONV=1 python -m modal run factory/modal_harvest_ws.py::pack
        MSYS_NO_PATHCONV=1 python -m modal volume get harvest-ws-out /workspaces.tgz factory/raw/
    """
    out_vol.reload()
    p = subprocess.run(["tar", "-czf", "/out/workspaces.tgz", "-C", "/out", "workspaces"], capture_output=True, text=True)
    out_vol.commit()
    count = len([d for d in pathlib.Path("/out/workspaces").iterdir() if d.is_dir()])
    size = pathlib.Path("/out/workspaces.tgz").stat().st_size if p.returncode == 0 else 0
    return {"ok": p.returncode == 0, "workspaces": count, "bytes": size, "stderr": (p.stderr or "")[-300:]}


@app.local_entrypoint()
def main(list_file: str, manifest: str, offset: int = 0, limit: int = 0, maxmb: float = 3):
    data = json.loads(pathlib.Path(list_file).read_text(encoding="utf-8"))
    pool = [r for r in data["permissive"] if r.get("mb", 0) <= maxmb]
    mpath = pathlib.Path(manifest)
    done = set()
    if mpath.exists():
        for line in mpath.read_text(encoding="utf-8").splitlines():
            if line.strip():
                try:
                    done.add(json.loads(line)["repo"])
                except (json.JSONDecodeError, KeyError):
                    pass
    batch = pool[offset:offset + limit] if limit else pool[offset:]
    batch = [r for r in batch if r["name"] not in done]
    print(f"{len(pool)} permissive repos <= {maxmb} MB | {len(done)} already in the manifest | this run: {len(batch)}", flush=True)
    counts = {}
    with mpath.open("a", encoding="utf-8") as f:
        for row in harvest_one.map(batch, order_outputs=False, return_exceptions=True):
            if isinstance(row, Exception):
                counts["exception"] = counts.get("exception", 0) + 1
                continue
            f.write(json.dumps(row) + "\n")
            f.flush()
            counts[row.get("status", "?")] = counts.get(row.get("status", "?"), 0) + 1
            if row.get("status") == "kept":
                print(f"  + {row['repo']} [{row.get('license')}] {row.get('entry')} "
                      f"{'animated' if row.get('animated') else 'static'} | {row.get('jsCount')} js", flush=True)
    print(json.dumps(counts), flush=True)
    print("\n  MSYS_NO_PATHCONV=1 python -m modal volume get harvest-ws-out /workspaces factory/raw/")
