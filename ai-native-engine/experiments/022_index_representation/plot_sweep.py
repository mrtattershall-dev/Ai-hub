"""Plot the RD-001.1 Modal scaling sweep: memory, read, incremental-update vs N.
Reads sweep_results.json, writes scaling_plots.png."""
import json
import pathlib
import matplotlib.pyplot as plt
import numpy as np

HERE = pathlib.Path(__file__).parent
data = json.loads((HERE / "sweep_results.json").read_text())
data.sort(key=lambda r: r["N"])

N        = np.array([r["N"] for r in data], dtype=float)
mapMB    = np.array([r["mapSetBytes"] for r in data]) / 1024 / 1024
csrMB    = np.array([r["csrBytes"] for r in data]) / 1024 / 1024
mapRead  = np.array([r["mapReadMs"] for r in data])
csrRead  = np.array([r["csrReadMs"] for r in data])
mapWrite = np.array([r["mapWriteMs"] for r in data])   # 40k O(1) edge ops
csrBuild = np.array([r["csrRebuildMs"] for r in data])  # one full rebuild = cost of ANY change

MAP_C, CSR_C = "darkred", "darkblue"
plt.rcParams.update({"font.size": 10, "axes.titlesize": 11})
fig, ax = plt.subplots(1, 3, figsize=(16.5, 5.2))
fig.suptitle("RD-001.1  index representation at scale  —  Map/Set vs CSR typed-array  (Modal, Node 18, N = 10k … 5M)",
             fontsize=13, y=1.00)

def style(a):
    a.grid(True, alpha=0.3)
    a.set_xlabel("entities  N  (log)")
    for s in ("top", "right"):
        a.spines[s].set_visible(False)

# --- Panel 1: MEMORY (log-log) ---------------------------------------------
a = ax[0]
a.loglog(N, mapMB, "o-", color=MAP_C, label="Map<int,Set<int>>  (core today)")
a.loglog(N, csrMB, "o-", color=CSR_C, label="CSR typed-array")
a.set_ylabel("index memory  (MB)")
a.set_title("MEMORY — Map/Set ≈ 10× larger, ~910 MB at 5M")
a.annotate("910 MB", (N[-1], mapMB[-1]), textcoords="offset points", xytext=(-38, 6), color=MAP_C)
a.annotate("97 MB", (N[-1], csrMB[-1]), textcoords="offset points", xytext=(-30, -14), color=CSR_C)
style(a); a.legend(loc="upper left", framealpha=0.9)

# --- Panel 2: READ latency (semilogx) --------------------------------------
a = ax[1]
a.semilogx(N, mapRead, "o-", color=MAP_C, label="Map/Set read")
a.semilogx(N, csrRead, "o-", color=CSR_C, label="CSR read")
# mark the cold-JIT outlier honestly
a.annotate("cold-JIT\noutlier", (N[0], csrRead[0]), textcoords="offset points", xytext=(6, -4),
           color=CSR_C, fontsize=8)
a.set_ylabel("read latency  (ms / 600k queries)")
a.set_title("READ — CSR flat (~28 ms); Map/Set degrades with N\n(CSR ~3.9× faster at 5M — cache locality)")
style(a); a.legend(loc="upper left", framealpha=0.9)

# --- Panel 3: INCREMENTAL UPDATE (semilogx) --------------------------------
a = ax[2]
a.semilogx(N, mapWrite, "o-", color=MAP_C, label="Map/Set: 40k O(1) edge ops")
a.semilogx(N, csrBuild, "o-", color=CSR_C, label="CSR: one full rebuild = cost of ANY change")
a.set_ylabel("update cost  (ms)")
a.set_title("UPDATE (decisive) — Map/Set FLAT; CSR rebuild LINEAR\n294 ms/commit at 5M → CSR unusable for the write path")
a.annotate("294 ms", (N[-1], csrBuild[-1]), textcoords="offset points", xytext=(-40, -4), color=CSR_C)
a.annotate("~12 ms (flat)", (N[-1], mapWrite[-1]), textcoords="offset points", xytext=(-70, 8), color=MAP_C)
style(a); a.legend(loc="upper left", framealpha=0.9)

fig.tight_layout(rect=[0, 0, 1, 0.97])
out = HERE / "scaling_plots.png"
fig.savefig(out, dpi=150, bbox_inches="tight")
print(f"saved -> {out}")

# print the computed crossover summary for the record
print("\nN, mapMB, csrMB, memRatio, mapRead, csrRead, readRatio, mapWrite, csrBuild")
for i in range(len(N)):
    print(f"{int(N[i]):>9,} | mem {mapMB[i]:7.1f}/{csrMB[i]:6.2f} ={mapMB[i]/csrMB[i]:4.1f}x | "
          f"read {mapRead[i]:6.1f}/{csrRead[i]:6.1f} | upd {mapWrite[i]:5.1f}/{csrBuild[i]:6.1f}")
