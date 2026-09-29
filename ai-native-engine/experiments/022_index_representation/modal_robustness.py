"""
RD-001.1 robustness pass: how trustworthy are the SOFT numbers (heapUsed memory,
wall-clock timings) the whole project keeps flagging? Each `node` subprocess is a
FRESH V8, so every run is an independent sample. Fan out ~60 fresh measurements
at a fixed N and report the distribution (mean / median / std / CV).

Run:  python -m modal run experiments/022_index_representation/modal_robustness.py
"""
import json
import subprocess
import pathlib
import modal

app = modal.App("engine-index-robustness")
node_image = modal.Image.debian_slim(python_version="3.11").apt_install("nodejs")
HERE = pathlib.Path(__file__).parent

N_FIXED = 50_000


@app.function(image=node_image, memory=8192, cpu=2.0, timeout=1200)
def run_repeats(source: str, N: int, reps: int, batch: int) -> list:
    """Run the experiment `reps` times as fresh node processes -> independent samples."""
    import shutil
    node_bin = shutil.which("node") or shutil.which("nodejs") or "nodejs"
    p = "/tmp/sweep.js"
    with open(p, "w") as f:
        f.write(source)
    samples = []
    for _ in range(reps):
        out = subprocess.run(
            [node_bin, "--expose-gc", p, str(N), "1"],
            capture_output=True, text=True, timeout=120,
        )
        lines = [l for l in out.stdout.splitlines() if l.strip().startswith("{")]
        if lines:
            samples.append(json.loads(lines[-1]))
    return samples


@app.local_entrypoint()
def main():
    source = (HERE / "sweep.js").read_text()
    BATCHES, REPS = 6, 12   # 6 parallel containers x 12 fresh runs = 72 samples
    args = [(source, N_FIXED, REPS, b) for b in range(BATCHES)]
    nested = list(run_repeats.starmap(args))
    samples = [s for batch in nested for s in batch]
    outpath = HERE / "robustness_results.json"
    outpath.write_text(json.dumps(samples, indent=2))
    print(f"collected {len(samples)} independent samples at N={N_FIXED:,}")
    print(f"saved -> {outpath}")
