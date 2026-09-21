"""H-LEAK: was `resolve`'s supported region fitted to the corpus its author saw?

Frozen against H-LEAK_PREREG.md. `resolve` is imported from the frozen screen2.py
and never modified. `ast.literal_eval` is the exposure-free control: an
independent implementation of nearly the same supported region, written with no
exposure to any of these corpora, so it absorbs corpus style.
"""
import ast, json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from screen2 import resolve, UNRESOLVED, SKIP_DIRS

CORPORA = {
    "odysseus": (r"C:\Users\tatte\odysseus", "HIGH"),
    "mpt":      (r"C:\Users\tatte\AppData\Local\Temp\screen2-target\mpt", "NONE (blinded)"),
    "pytorch":  (r"C:\Users\tatte\AppData\Local\Temp\stageb-target\pt", "NONE"),
}
EXTRA_SKIP = {"venv", ".venv", "site-packages", "node_modules", "third_party",
              "build", "dist", ".git", "__pycache__"}


def literal_covers(node):
    """The control resolver. Same node, independent supported region."""
    try:
        ast.literal_eval(node)
        return True
    except Exception:
        return False


def measure(root):
    root = Path(root)
    seen_hashes = set()
    total = resolved = lit = 0
    by_form_unres = {}
    for p in root.rglob("*.py"):
        parts = p.relative_to(root).parts
        if any(x in EXTRA_SKIP or x in SKIP_DIRS for x in parts):
            continue
        try:
            src = p.read_text(encoding="utf-8", errors="replace")
            tree = ast.parse(src)
        except Exception:
            continue
        h = hash(src)
        if h in seen_hashes:          # duplicated trees would double-count
            continue
        seen_hashes.add(h)
        for node in ast.walk(tree):
            if not (isinstance(node, ast.Return) and node.value is not None):
                continue
            total += 1
            r = resolve(node.value)
            if r is not UNRESOLVED:
                resolved += 1
            else:
                k = type(node.value).__name__
                by_form_unres[k] = by_form_unres.get(k, 0) + 1
            if literal_covers(node.value):
                lit += 1
    return dict(returns=total,
                resolve_cov=round(resolved / total, 5) if total else None,
                literal_cov=round(lit / total, 5) if total else None,
                top_unresolved_forms=sorted(by_form_unres.items(),
                                            key=lambda kv: -kv[1])[:5])


if __name__ == "__main__":
    out = {}
    for name, (root, exposure) in CORPORA.items():
        m = measure(root)
        m["exposure"] = exposure
        out[name] = m
        print("%-9s exposure=%-16s returns=%-7d resolve=%.4f  literal_eval=%.4f"
              % (name, exposure, m["returns"], m["resolve_cov"], m["literal_cov"]), flush=True)
        print("          top UNRESOLVED forms: %s" % m["top_unresolved_forms"], flush=True)

    o, p, mp = out["odysseus"], out["pytorch"], out["mpt"]
    gap_r = o["resolve_cov"] - p["resolve_cov"]
    gap_l = o["literal_cov"] - p["literal_cov"]
    print()
    print("L-1  resolve gap (odysseus - pytorch)      = %+.5f" % gap_r)
    print("     literal_eval gap (same corpora)       = %+.5f" % gap_l)
    print("     resolve gap LARGER than control?      = %s" % (gap_r > gap_l))
    print("     ratio resolve/control                 = %s"
          % (round(gap_r / gap_l, 3) if gap_l else "control gap is zero"))
    print()
    print("L-2  mpt resolve coverage %.4f lies between pytorch %.4f and odysseus %.4f"
          % (mp["resolve_cov"], p["resolve_cov"], o["resolve_cov"]))
    d_pt = abs(mp["resolve_cov"] - p["resolve_cov"])
    d_od = abs(mp["resolve_cov"] - o["resolve_cov"])
    print("     mpt patterns with: %s" % ("pytorch" if d_pt < d_od else "odysseus"))
    out["scoring"] = dict(gap_resolve=gap_r, gap_literal=gap_l,
                          L1_resolve_gap_larger=bool(gap_r > gap_l),
                          mpt_patterns_with=("pytorch" if d_pt < d_od else "odysseus"))
    json.dump(out, open(sys.argv[1], "w", encoding="utf-8"), indent=2)
