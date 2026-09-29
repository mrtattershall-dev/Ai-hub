"""How trustworthy are the soft numbers? 72 independent fresh-V8 samples @ N=50k.
Reports mean/median/std/CV per metric and plots the distributions."""
import json
import pathlib
import numpy as np
import matplotlib.pyplot as plt

HERE = pathlib.Path(__file__).parent
S = json.loads((HERE / "robustness_results.json").read_text())
n = len(S)

METRICS = [
    ("csrBytes",     "CSR memory (B)",       "exact byteLength — control"),
    ("mapSetBytes",  "Map/Set memory (B)",   "heapUsed delta — THE soft claim"),
    ("mapReadMs",    "Map/Set read (ms)",    "wall-clock"),
    ("csrReadMs",    "CSR read (ms)",        "wall-clock"),
    ("mapWriteMs",   "Map/Set update (ms)",  "wall-clock"),
    ("csrRebuildMs", "CSR rebuild (ms)",     "wall-clock"),
]

def stats(key):
    a = np.array([s[key] for s in S], dtype=float)
    m = a.mean(); sd = a.std(ddof=1)
    return dict(mean=m, median=np.median(a), std=sd, cv=100 * sd / m if m else 0.0,
                lo=a.min(), hi=a.max(), arr=a)

print(f"=== robustness: {n} independent fresh-V8 samples @ N=50,000 ===")
print(f"{'metric':<22}{'mean':>14}{'median':>14}{'std':>12}{'CV%':>8}{'min..max':>22}")
rows = {}
for key, label, _ in METRICS:
    st = stats(key); rows[key] = st
    rng = f"{st['lo']:.0f}..{st['hi']:.0f}" if 'Bytes' in key else f"{st['lo']:.1f}..{st['hi']:.1f}"
    fmt = (lambda v: f"{v:,.0f}") if 'Bytes' in key else (lambda v: f"{v:.2f}")
    print(f"{label:<22}{fmt(st['mean']):>14}{fmt(st['median']):>14}{fmt(st['std']):>12}{st['cv']:>7.1f}%{rng:>22}")

# ---------------------------------------------------------------------------
MAP_C, CSR_C = "darkred", "darkblue"
fig, ax = plt.subplots(1, 3, figsize=(16.5, 5.0))
fig.suptitle(f"RD-001.1 robustness — how soft are the soft numbers?  ({n} independent fresh-V8 samples, N=50k, Modal)",
             fontsize=13, y=1.00)

# Panel 1: CV% bar chart (the headline — noise level per metric)
a = ax[0]
labels = [m[1] for m in METRICS]
cvs = [rows[m[0]]["cv"] for m in METRICS]
colors = [CSR_C if "CSR" in m[1] else MAP_C for m in METRICS]
y = np.arange(len(labels))
a.barh(y, cvs, color=colors, alpha=0.85)
a.set_yticks(y); a.set_yticklabels(labels, fontsize=9); a.invert_yaxis()
a.axvline(5, color="black", linewidth=0.8, linestyle="--")
a.text(5.2, len(labels) - 0.4, "5% (trustworthy)", fontsize=8, color="black")
for i, v in enumerate(cvs):
    a.text(v + 0.3, i, f"{v:.1f}%", va="center", fontsize=8)
a.set_xlabel("coefficient of variation  (std / mean, %)")
a.set_title("noise per metric — memory is rock-solid,\ntimings are the soft ones")
a.grid(True, alpha=0.3, axis="x")
for s in ("top", "right"):
    a.spines[s].set_visible(False)

# Panel 2: Map/Set memory histogram (THE soft memory claim)
a = ax[1]
mm = rows["mapSetBytes"]; arr = mm["arr"] / 1e6
a.hist(arr, bins=18, color=MAP_C, alpha=0.8, edgecolor="white")
a.axvline(mm["mean"] / 1e6, color="black", linewidth=1)
a.set_xlabel("Map/Set index memory  (MB)")
a.set_ylabel("samples")
a.set_title(f"Map/Set memory: {mm['mean']/1e6:.2f} MB ± {mm['std']/1e6:.2f}  (CV {mm['cv']:.1f}%)\n"
            f"the 'soft' heapUsed number is actually tight")
a.grid(True, alpha=0.3)
for s in ("top", "right"):
    a.spines[s].set_visible(False)

# Panel 3: read-timing histograms (the genuinely noisy ones)
a = ax[2]
a.hist(rows["mapReadMs"]["arr"], bins=18, color=MAP_C, alpha=0.65, edgecolor="white", label=f"Map/Set read (CV {rows['mapReadMs']['cv']:.0f}%)")
a.hist(rows["csrReadMs"]["arr"], bins=18, color=CSR_C, alpha=0.65, edgecolor="white", label=f"CSR read (CV {rows['csrReadMs']['cv']:.0f}%)")
a.set_xlabel("read latency  (ms / 600k queries)")
a.set_ylabel("samples")
a.set_title("wall-clock timings spread wider —\nreport medians, trust trends not single points")
a.legend(fontsize=8, framealpha=0.9)
a.grid(True, alpha=0.3)
for s in ("top", "right"):
    a.spines[s].set_visible(False)

fig.tight_layout(rect=[0, 0, 1, 0.96])
out = HERE / "robustness_plots.png"
fig.savefig(out, dpi=150, bbox_inches="tight")
print(f"\nsaved -> {out}")
