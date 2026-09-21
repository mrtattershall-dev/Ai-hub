"""H-CLOSURE: separate correctness-by-accident from justified correctness.

reach1.py is a preserved specimen and is NOT modified. Perturbations are runtime
rebindings of single rules. Frontier status is read off premise decidability,
established independently by H-DEFINED, never off perturbation sensitivity.
"""
import ast, json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import reach1

PT = r"C:\Users\tatte\AppData\Local\Temp\stageb-target\pt"


def run_arm(idx, cases, label):
    res = [reach1.run_case(idx, c) for c in cases]
    return {r["id"]: r for r in res}


def main(out_path):
    idx = reach1.Index(PT)
    idx.build()
    cases = json.load(open("screen/reach1_prospective.json", encoding="utf-8"))
    print("indexed %d files, %d cases\n" % (idx.n_parsed, len(cases)), flush=True)

    base = run_arm(idx, cases, "BASE")

    # ---- ARM OPEN-PERT: the rule whose premise is UNDECIDABLE at the site refuses
    saved = reach1.TRUSTED_TAILS
    reach1.TRUSTED_TAILS = set()
    openp = run_arm(idx, cases, "OPEN-PERT")
    reach1.TRUSTED_TAILS = saved

    # ---- ARM CTRL-PERT: a rule whose premise is DECIDABLE refuses (the control)
    real_trace = reach1.trace

    def trace_no_or(idx_, expr, rel, scope, decisive, cl, radius, depth, seen):
        if isinstance(expr, ast.BoolOp) and isinstance(expr.op, ast.Or):
            cl.blocking.add("ctrl_perturbation")
            cl.branches.append("UNKNOWN")
            return
        return real_trace(idx_, expr, rel, scope, decisive, cl, radius, depth, seen)

    reach1.trace = trace_no_or
    ctrl = run_arm(idx, cases, "CTRL-PERT")
    reach1.trace = real_trace

    # ---- frontier status, fixed INDEPENDENTLY of any perturbation ----
    settled = [i for i, r in base.items() if r["verdict"] != "UNKNOWN"]
    open_frontier = [i for i in settled
                     if any(f["kind"] == "trusted_primitive" for f in base[i]["facts"])]
    closed_frontier = [i for i in settled if i not in open_frontier]

    moved_open = [i for i in settled if openp[i]["verdict"] != base[i]["verdict"]]
    moved_ctrl = [i for i in settled if ctrl[i]["verdict"] != base[i]["verdict"]]

    print("settled verdicts in BASE          : %d" % len(settled))
    print("  frontier OPEN   (undecidable premise used) : %d" % len(open_frontier))
    print("  frontier CLOSED                            : %d" % len(closed_frontier))
    print()
    print("CL-1  moved under OPEN-PERT       : %d" % len(moved_open))
    print("      set equals the OPEN set?    : %s" % (set(moved_open) == set(open_frontier)))
    for i in moved_open:
        print("        %-44s %s -> %s" % (i[:44], base[i]["verdict"], openp[i]["verdict"]))
    print()
    print("CL-3  moved under CTRL-PERT       : %d  (decidable premise; NOT openness)"
          % len(moved_ctrl))
    print("      control is inert?           : %s" % (len(moved_ctrl) == 0))
    print("      overlap with OPEN set       : %d" % len(set(moved_ctrl) & set(open_frontier)))

    out = dict(settled=len(settled), open_frontier=open_frontier,
               closed_frontier_n=len(closed_frontier),
               moved_open=moved_open, moved_ctrl=moved_ctrl,
               cl1_exact=bool(set(moved_open) == set(open_frontier)),
               open_facts={i: [f for f in base[i]["facts"] if f["kind"] == "trusted_primitive"]
                           for i in open_frontier},
               base_verdicts={i: base[i]["verdict"] for i in settled})
    json.dump(out, open(out_path, "w", encoding="utf-8"), indent=2)


if __name__ == "__main__":
    main(sys.argv[1])
