"""
modal_rungoals.py - rungoals.mjs on Modal: every goal gets its own CPU container running the REAL hub.

    # a dry run with a scripted model inside each container (CPU only, no GPU anywhere):
    MSYS_NO_PATHCONV=1 python -m modal run factory/modal_rungoals.py \
        --goals factory/raw/game_goals.jsonl --label dry --mock <script.json> --limit 2

    # real traces against a deployed model endpoint (the GPU is the endpoint, not these containers):
    MSYS_NO_PATHCONV=1 python -m modal run factory/modal_rungoals.py \
        --goals factory/raw/game_goals.jsonl --label base14b --base https://<endpoint> --model coder14b

WHY
---
Trace generation is ~1,200 hub runs (validated goals x two models). On the laptop that is one hub
at a time - tonight's 14B runs took ~40 s a goal on simpler work - so a day or more, and the
laptop is also running the fuzzer. Each run is independent, so each gets a container: the hub, its
browser and the grader all run there, and only the model calls leave, to the GPU endpoint.

WHAT GOES INTO THE IMAGE - AN ALLOWLIST
---------------------------------------
server/ holds hub.json with provider API keys, run logs, traces and backups. None of that may
reach a remote image, so the server copy is an allowlist: top-level .js / .mjs / .py source plus
package.json and package-lock.json, and nothing else (no subdirectories, no hub.json*, no *.bak,
no tests). Each container writes its own throwaway hub.json pointing only at the model URL, exactly
as rungoals.mjs does locally. shared/engines.js ships because gameVerify.js imports it; the asset
library does not ship at all (the hub creates an empty assets/ and game goals do not use it).

The output layout is rungoals.mjs's: <out>/<label>/results.jsonl + <id>.run.json, so
tochat.mjs reads either. Resume-safe: goals already in results.jsonl are skipped.
Ephemeral `modal run` app: it stops when the run ends.
"""
import json
import os
import pathlib
import shutil
import socket
import subprocess
import tempfile
import threading
import time
import urllib.request

import modal

HERE = pathlib.Path(__file__).parent
REPO = HERE.parent.parent
SERVER = REPO / "server"
SHARED = REPO / "shared"


def _server_ignore(p: pathlib.Path) -> bool:
    """True = EXCLUDE. Only the hub's own top-level source reaches the image."""
    if len(p.parts) != 1:
        return True                      # node_modules, agent-runs, agent-traces, testdata, .engine-cache ...
    n = p.name
    if n.startswith("hub.json") or ".bak" in n or ".pre" in n or n.endswith(".test.mjs") or n.startswith("."):
        return True
    return not (p.suffix in {".js", ".mjs", ".py"} or n in {"package.json", "package-lock.json"})


app = modal.App("hub-rungoals")
ws_vol = modal.Volume.from_name("harvest-ws-out", create_if_missing=False)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ca-certificates", "curl", "fonts-liberation", "build-essential", "python3")
    .pip_install("playwright==1.47.0")
    .run_commands(
        "playwright install --with-deps chromium",
        "ln -sf \"$(ls -d /root/.cache/ms-playwright/chromium-*/chrome-linux/chrome | head -1)\" /usr/local/bin/chromium-pw",
        "curl -fsSL https://deb.nodesource.com/setup_22.x | bash -",
        "apt-get install -y nodejs",
        "mkdir -p /app/server /app/shared /app/assets /app/training-data/factory",
    )
    .env({"PUPPETEER_EXECUTABLE_PATH": "/usr/local/bin/chromium-pw", "PUPPETEER_SKIP_DOWNLOAD": "1"})
    # dependencies first (their own layer, rebuilt only when the lockfile changes); node-pty has no
    # Linux prebuild, so build-essential + python3 above let `npm ci` compile it.
    .add_local_file(str(SERVER / "package.json"), "/app/server/package.json", copy=True)
    .add_local_file(str(SERVER / "package-lock.json"), "/app/server/package-lock.json", copy=True)
    .run_commands("cd /app/server && npm ci --omit=dev --no-fund --no-audit")
    .add_local_dir(str(SHARED), "/app/shared", copy=True, ignore=lambda p: p.name.startswith("."))
    .add_local_dir(str(SERVER), "/app/server", copy=True, ignore=_server_ignore)
    .add_local_file(str(HERE / "gamecheck.mjs"), "/app/training-data/factory/gamecheck.mjs", copy=True)
)

TERMINAL = {"done", "error", "stopped", "interrupted", "failed", "awaiting_approval"}


def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def _http(url, body=None, timeout=180):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"},
                                 method="POST" if body is not None else "GET")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode() or "{}")


def _start_mock(script):
    """An Ollama-shaped scripted model, inside the container (dry runs only). Planner calls - the
    hub's plan-first gate sends exactly [system, user] - get a plan; then the script in order; then
    lone finishes with distinct thoughts so the repeat detector does not stop the run."""
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    queue = list(script)
    count = {"k": 0}

    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def _send(self, obj):
            b = json.dumps(obj).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(b)))
            self.end_headers()
            self.wfile.write(b)

        def do_GET(self):
            self._send({"ok": True, "engine": "mock", "model": "mock", "lora": None, "models": []})

        def do_POST(self):
            n = int(self.headers.get("Content-Length") or 0)
            try:
                msgs = json.loads(self.rfile.read(n) or b"{}").get("messages", [])
            except Exception:  # noqa: BLE001
                msgs = []
            if "/api/chat" not in self.path:
                return self._send({"ok": True})
            if len(msgs) == 2:
                text = "Plan: read the game, make the change the goal asks for, test it in the browser, then finish."
            elif queue:
                text = queue.pop(0)
            else:
                count["k"] += 1
                text = f"THOUGHT: the change is in place and tested ({count['k']})\nACTION: finish"
            self._send({"model": "mock", "message": {"role": "assistant", "content": text}, "done": True})

    port = _free_port()
    srv = ThreadingHTTPServer(("127.0.0.1", port), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{port}"


def goal_id(g: dict) -> str:
    import re
    return re.sub(r"[^\w.-]", "__", g["repo"]) + "__" + g["goal"]


@app.function(image=image, cpu=2.0, memory=4096, timeout=60 * 20, retries=0, max_containers=20,
              volumes={"/out": ws_vol})
def run_goal(g: dict, base: str = "", model: str = "coder14b", label: str = "run", mock_script: list = None) -> dict:
    t0 = time.time()
    rec = {"id": goal_id(g), "label": label, "model": model, "repo": g["repo"], "license": g.get("license"),
           "sha": g.get("sha"), "goal": g["goal"], "entry": g["entry"]}
    slug = pathlib.Path(g["dir"]).name
    root = pathlib.Path(tempfile.mkdtemp(prefix="rungoal-"))
    ws = root / "workspace"
    src = pathlib.Path("/out/workspaces") / slug
    if not src.exists():
        rec.update(status="harness-error", error="workspace not on the volume", verdict={"pass": False, "why": "no workspace"})
        rec["pass"] = False
        return {"record": rec, "run": None}
    shutil.copytree(str(src), str(ws), symlinks=True, ignore_dangling_symlinks=True)
    if mock_script:
        base = _start_mock(mock_script)
        model = "mock"
    (root / "hub.json").write_text(json.dumps({"api_keys": {"ollama": {"base_url": base, "model": model}},
                                               "history": [], "settings": {}}), encoding="utf-8")
    port = _free_port()
    env = {**os.environ, "PORT": str(port), "HUB_DB": str(root / "hub.json"),
           "AGENT_WORKSPACE": str(ws), "AGENT_QUEUE_FILE": str(root / "queue.json"),
           "AGENT_RUNS_DIR": str(root / "runs"), "RUN_INDEX": str(root / "index.jsonl"),
           "AGENT_TRACES_DIR": str(root / "traces"), "AGENT_SUPERVISOR": "0", "AGENT_APPROVAL_MODE": "build",
           "HUB_TOKEN": "", "AGENT_MAX_AUTO_STARTS": "400", "AGENT_MAX_STEPS": "30", "AGENT_MAX_MINUTES": "8",
           "MODEL_FIRST_BYTE_S": "600", "MODEL_STALL_S": "90", "MODEL_TIMEOUT_S": "1800"}
    log = open(root / "hub.log", "w")
    hub = subprocess.Popen(["node", "/app/server/index.js"], env=env, stdout=log, stderr=subprocess.STDOUT, cwd="/app/server")
    api = f"http://127.0.0.1:{port}/api"
    run_text = None
    try:
        for _ in range(240):
            try:
                urllib.request.urlopen(api + "/auth/hint", timeout=2)
                break
            except Exception:  # noqa: BLE001
                time.sleep(0.25)
        s = _http(api + "/agent/start", {"goal": g["text"]})
        if not s.get("runId"):
            raise RuntimeError("start failed: " + json.dumps(s)[:160])
        run = None
        deadline = time.time() + 12 * 60
        while time.time() < deadline:
            try:
                run = _http(api + "/agent/" + s["runId"])
            except Exception:  # noqa: BLE001
                run = None
            if run and run.get("status") in TERMINAL and run.get("busy") is not True:
                break
            time.sleep(3)
        rec["runId"] = s["runId"]
        rec["status"] = (run or {}).get("status", "timeout")
        rec["steps"] = len((run or {}).get("steps") or [])
        rec["modelCalls"] = (run or {}).get("modelCalls")
        rec["finishBlocks"] = (run or {}).get("finishBlocks") or 0
        rec["forcedFinish"] = rec["finishBlocks"] >= 3
        rf = root / "runs" / (s["runId"] + ".json")
        if rf.exists():
            run_text = rf.read_text(encoding="utf-8")
            rec["runFile"] = rec["id"] + ".run.json"
    except Exception as e:  # noqa: BLE001
        rec["status"] = "harness-error"
        rec["error"] = str(e)[:200]
    finally:
        hub.terminate()
        try:
            hub.wait(timeout=10)
        except Exception:  # noqa: BLE001
            hub.kill()
        log.close()
    # Grade the workspace the run left behind - the same CLI the laptop uses.
    try:
        p = subprocess.run(["node", "/app/training-data/factory/gamecheck.mjs", "check", str(ws), g["entry"], g["goal"]],
                           capture_output=True, text=True, timeout=180, cwd="/app")
        last = (p.stdout or "").strip().splitlines()[-1] if (p.stdout or "").strip() else ""
        rec["verdict"] = json.loads(last) if last.startswith("{") else {"pass": False, "why": "no verdict: " + (p.stderr or "")[-160:]}
    except Exception as e:  # noqa: BLE001
        rec["verdict"] = {"pass": False, "why": "grader error: " + str(e)[:160]}
    rec["pass"] = rec["verdict"].get("pass") is True
    rec["secs"] = round(time.time() - t0)
    tail = (root / "hub.log").read_text(errors="replace")[-600:] if (root / "hub.log").exists() else ""
    return {"record": rec, "run": run_text, "hubLogTail": tail if rec.get("status") == "harness-error" else ""}


@app.local_entrypoint()
def main(goals: str, label: str, base: str = "", model: str = "coder14b", out: str = "",
         offset: int = 0, limit: int = 0, mock: str = ""):
    rows = [json.loads(l) for l in pathlib.Path(goals).read_text(encoding="utf-8").splitlines() if l.strip()]
    rows = rows[offset:offset + limit] if limit else rows[offset:]
    outdir = pathlib.Path(out or (HERE / "raw" / "traces")) / label
    outdir.mkdir(parents=True, exist_ok=True)
    results = outdir / "results.jsonl"
    done = set()
    if results.exists():
        for l in results.read_text(encoding="utf-8").splitlines():
            if l.strip():
                try:
                    done.add(json.loads(l)["id"])
                except (json.JSONDecodeError, KeyError):
                    pass
    todo = [g for g in rows if goal_id(g) not in done]
    script = json.loads(pathlib.Path(mock).read_text(encoding="utf-8")) if mock else None
    if not base and not script:
        raise SystemExit("give --base <model endpoint> or --mock <script.json>")
    print(f"{len(rows)} goals | {len(done)} already recorded for '{label}' | this run: {len(todo)} | "
          f"{'MOCK model in each container' if script else model + ' @ ' + base}", flush=True)
    passed = finished = 0
    with results.open("a", encoding="utf-8") as f:
        for res in run_goal.map(todo, kwargs={"base": base, "model": model, "label": label, "mock_script": script},
                                order_outputs=False, return_exceptions=True):
            finished += 1
            if isinstance(res, Exception):
                print(f"  ! exception: {str(res)[:160]}", flush=True)
                continue
            rec = res["record"]
            if res.get("run"):
                (outdir / rec["runFile"]).write_text(res["run"], encoding="utf-8")
            f.write(json.dumps(rec) + "\n")
            f.flush()
            if rec.get("pass"):
                passed += 1
            why = (rec.get("verdict") or {}).get("why") or rec.get("error") or ""
            print(f"  {finished:>4}/{len(todo)} {'PASS' if rec.get('pass') else 'fail'} {rec['id'][:56]:<56} "
                  f"{str(rec.get('status')):<12} steps {rec.get('steps', '-')} blocks {rec.get('finishBlocks', '-')} "
                  f"{rec.get('secs')}s | {why[:70]}", flush=True)
            if res.get("hubLogTail"):
                print("     hub log: " + res["hubLogTail"].replace("\n", " | ")[-300:], flush=True)
    print(f"\n{passed}/{finished} passed -> {results}", flush=True)
