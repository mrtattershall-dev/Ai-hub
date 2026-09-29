"""
RD-001.1 scaling sweep on Modal. Runs the ACTUAL Node.js index experiment
(Map/Set vs CSR) across N = 10k .. 5M on high-RAM CPU containers, in parallel,
and collects JSON results. Validates the flagged-untested large-N regime.

Run:  modal run experiments/022_index_representation/modal_sweep.py
Cost: CPU-only, a few container-minutes; well within the $30 budget.
"""
import json
import subprocess
import pathlib
import modal

app = modal.App("engine-index-scaling")

# Modal injects a Python runtime into the container, so the image needs BOTH
# Python (for Modal's harness) and Node (to run the zero-dep experiment).
node_image = modal.Image.debian_slim(python_version="3.11").apt_install("nodejs")

HERE = pathlib.Path(__file__).parent


@app.function(image=node_image, memory=32768, cpu=4.0, timeout=1800)
def run_point(source: str, N: int, trials: int) -> dict:
    """Write the experiment into the container and run it at one N."""
    import shutil
    node_bin = shutil.which("node") or shutil.which("nodejs") or "nodejs"
    p = "/tmp/sweep.js"
    with open(p, "w") as f:
        f.write(source)
    try:
        out = subprocess.run(
            [node_bin, "--max-old-space-size=28000", "--expose-gc", p, str(N), str(trials)],
            capture_output=True, text=True, timeout=1700,
        )
        lines = [l for l in out.stdout.splitlines() if l.strip().startswith("{")]
        if not lines:
            return {"N": N, "error": (out.stderr or out.stdout or "no output")[:300]}
        return json.loads(lines[-1])
    except Exception as e:  # OOM / timeout / crash — record, don't kill the sweep
        return {"N": N, "error": repr(e)[:300]}


@app.local_entrypoint()
def main():
    source = (HERE / "sweep.js").read_text()
    # (N, trials) — fewer trials at the largest N to bound time/cost.
    plan = [
        (10_000, 3), (50_000, 3), (100_000, 3), (500_000, 3),
        (1_000_000, 2), (2_000_000, 2), (5_000_000, 1),
    ]
    args = [(source, n, t) for (n, t) in plan]
    results = list(run_point.starmap(args))
    results.sort(key=lambda r: r["N"])
    outpath = HERE / "sweep_results.json"
    outpath.write_text(json.dumps(results, indent=2))
    print("=== RESULTS ===")
    print(json.dumps(results, indent=2))
    print(f"\nsaved -> {outpath}")
