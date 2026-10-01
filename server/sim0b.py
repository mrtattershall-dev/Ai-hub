"""sim0b.py - SIM-0b harness: sim0.py with ONLY the seed prefix changed (SIM0 -> SIM0b). Frozen with SIM-0b_PREREG.md.

    python server/sim0.py <path-to-slot-main.py> <out.json>

The SUBJECT is a third-party slot machine with NO licence found. It is read from outside the repo,
pinned by sha256, and never copied. The ORACLE is exact arithmetic (frozen in the prereg); this
harness only GENERATES evidence by running the subject's own spin and payout functions.

World W = (sourceSha256, harnessPatches, symbol_count, seedScheme, n). Two patches, both recorded:
  P1 drop the module-level call statement(s) - the file calls main() on import, which blocks on input()
  P2 (W1 only) symbol_count["A"] = 3
"""
import ast, hashlib, json, random, sys, time

EXPECTED_SHA = "fae51974cccc4b5de94c5f932f2a1ea946fb3086f64c8482f94ecb974afac7f0"
THRESHOLD = 0.234250          # frozen: equal-z boundary between the exact RTPs
NS = (100, 1000, 10000, 70000)
R = 400
LINES, BET = 3, 1

def load(path):
    raw = open(path, "rb").read()
    sha = hashlib.sha256(raw).hexdigest()
    if sha != EXPECTED_SHA:
        raise SystemExit(f"REFUSED: subject sha256 {sha} is not the frozen {EXPECTED_SHA} - a different world")
    tree = ast.parse(raw.decode("utf-8"))
    dropped = [ast.unparse(n) for n in tree.body if isinstance(n, ast.Expr) and isinstance(n.value, ast.Call)]
    tree.body = [n for n in tree.body if not (isinstance(n, ast.Expr) and isinstance(n.value, ast.Call))]
    return sha, dropped, tree

def world(tree, a_count):
    ns = {}
    exec(compile(tree, "slot-subject", "exec"), ns)
    if a_count is not None:
        ns["symbol_count"]["A"] = a_count
    return ns

def replicate(ns, wname, n, r):
    random.seed(f"SIM0b|{wname}|{n}|{r}")       # the subject uses the module-global random
    spin, pay = ns["get_slot_machine_spin"], ns["check_winnings"]
    sc, sv = ns["symbol_count"], ns["symbol_value"]
    s = s2 = 0
    for _ in range(n):
        w, _ = pay(spin(3, 3, sc), LINES, BET, sv)
        s += w; s2 += w * w
    return s, s2

def main():
    path, out = sys.argv[1], sys.argv[2]
    sha, dropped, tree = load(path)
    worlds = {"W0": world(tree, None), "W1": world(tree, 3)}
    res = {"subjectSha256": sha, "patchP1_dropped": dropped, "threshold": THRESHOLD, "R": R, "ns": NS,
           "symbol_count": {k: dict(v["symbol_count"]) for k, v in worlds.items()},
           "seedScheme": "random.seed('SIM0b|<world>|<n>|<r>')", "cells": {}, "pooled": {}, "replay": {}}
    t0 = time.time()
    for wname, ns in worlds.items():
        for n in NS:
            rtps, ps, ps2 = [], 0, 0
            for r in range(R):
                s, s2 = replicate(ns, wname, n, r)
                rtps.append(s / (LINES * n)); ps += s; ps2 += s2
            truth = wname
            errors = sum(1 for x in rtps if (("W0" if x > THRESHOLD else "W1") != truth))
            res["cells"][f"{wname}|{n}"] = {"errors": errors, "R": R, "rtps": rtps}
            if n == NS[-1]:
                N = R * n
                mean = ps / N
                res["pooled"][wname] = {"spins": N, "rtp": mean / LINES, "varSpin": ps2 / N - mean * mean}
            print(f"{wname} n={n:>6}: {errors}/{R} misclassified  ({time.time()-t0:.0f}s)", flush=True)
    for r in range(10):                      # determinism of the world: same W, same seed -> same bytes
        a = replicate(worlds["W1"], "W1", 1000, r)
        res["replay"][str(r)] = {"equal": a[0] / (LINES * 1000) == res["cells"]["W1|1000"]["rtps"][r]}
    res["wallSeconds"] = time.time() - t0
    json.dump(res, open(out, "w"), indent=1)

if __name__ == "__main__":
    main()
