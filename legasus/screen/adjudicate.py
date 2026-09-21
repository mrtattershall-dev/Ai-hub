"""Extract, for each SCREEN-2 candidate, the evidence needed to apply the frozen S4 rule.

    python legasus/screen/adjudicate.py <screen2.json> <target-root> <out.txt>

The rule (frozen by tatte after the first five were read): a candidate SURVIVES only if the
source establishes the proposition the invariant reports - for INV-A2, that the matched ordinary
return is an ESTABLISHED SUCCESS outcome, not merely a non-exceptional one. Ambiguity is
UNKNOWN and never enters the precision denominator.

This script does not adjudicate. It gathers the ordinary returns that matched, with context, so
adjudication is done against source rather than against the candidate's summary line.
"""
import ast
import json
import sys

sys.path.insert(0, __file__.rsplit("\\", 1)[0].rsplit("/", 1)[0])
from screen2 import resolve, _classify_returns, UNRESOLVED  # noqa: E402  frozen detector, reused not modified


def main():
    cands = json.load(open(sys.argv[1], encoding="utf-8"))["candidates"]
    root, out_path = sys.argv[2], sys.argv[3]
    # Dedup BEFORE the denominator, per the rule.
    seen, uniq = set(), []
    for c in cands:
        k = (c["file"], c["function"], c["line"], c["invariant"])
        if k in seen:
            continue
        seen.add(k)
        uniq.append(c)
    out = [f"candidates raw {len(cands)}  deduped {len(uniq)}", ""]
    for i, c in enumerate(uniq, 1):
        src = open(f"{root}/{c['file']}", encoding="utf-8", errors="replace").read()
        lines = src.splitlines()
        tree = ast.parse(src)
        fn = next((n for n in ast.walk(tree)
                   if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == c["function"]
                   and n.lineno == c["line"]), None)
        if fn is None:
            out.append(f"[{i}] {c['file']}::{c['function']} - FUNCTION NOT RELOCATED")
            continue
        exc, ordinary, _ = _classify_returns(fn)
        shared = resolve(next(r for r in exc if r.lineno == c["flagged_line"]).value)
        matches = [r for r in ordinary if resolve(r.value) is not UNRESOLVED
                   and type(resolve(r.value)) is type(shared) and resolve(r.value) == shared]
        out.append(f"[{i}] {c['file']}:{c['line']} {c['function']}()  shared value: {shared!r}")
        out.append(f"     exceptional return at line {c['flagged_line']}")
        for m in matches:
            lo = max(0, m.lineno - 5)
            ctx = [f"       {n+1:>5}| {lines[n].rstrip()[:110]}" for n in range(lo, m.lineno)]
            out.append(f"     ORDINARY return at line {m.lineno}, preceded by:")
            out.extend(ctx)
        out.append("")
    open(out_path, "w", encoding="utf-8").write("\n".join(out))
    print(f"raw {len(cands)}, deduped {len(uniq)} -> {out_path}")


if __name__ == "__main__":
    main()
