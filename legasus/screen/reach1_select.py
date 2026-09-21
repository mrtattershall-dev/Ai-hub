"""Mechanical selection of REACH-1 prospective cases.

Frozen rule, applied without inspection:

  a case is (file, func, param) such that the function's body contains a
  top-level `if not <param>:` or `if <param>:` guard, where <param> is a
  positional parameter of that function.

The decisive state is therefore always FALSY(param) -- a value-domain state, so
every prospective case exercises the backward tracer. No case is skipped,
re-ranked, or chosen by what its closure turns out to look like.
"""
import ast, json, sys
from pathlib import Path

EXCLUDE_DIRS = {"test", "tests", "benchmarks", "third_party", "_inductor"}


def decisive_params(fdef):
    params = [a.arg for a in fdef.args.args]
    if not params:
        return []
    hits = []
    for stmt in fdef.body:
        if not isinstance(stmt, ast.If):
            continue
        t = stmt.test
        if isinstance(t, ast.UnaryOp) and isinstance(t.op, ast.Not) and isinstance(t.operand, ast.Name):
            nm = t.operand.id
        elif isinstance(t, ast.Name):
            nm = t.id
        else:
            continue
        if nm in params and nm not in ("self", "cls"):
            hits.append((nm, stmt.lineno))
    return hits


def main(root, out, limit):
    root = Path(root)
    cases = []
    for p in sorted(root.rglob("*.py")):
        rel = p.relative_to(root)
        if any(part in EXCLUDE_DIRS for part in rel.parts):
            continue
        if p.name.startswith("test_"):
            continue
        try:
            tree = ast.parse(p.read_text(encoding="utf-8", errors="replace"))
        except Exception:
            continue
        for node in ast.walk(tree):
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            for nm, ln in decisive_params(node):
                cases.append({
                    "id": "%s::%s::%s" % (rel.name, node.name, nm),
                    "file": str(rel), "func": node.name, "param": nm,
                    "decisive": "FALSY", "guard_line": ln,
                })
    # deterministic, no ranking by outcome: first `limit` in path order
    sel = cases[:limit]
    json.dump(sel, open(out, "w", encoding="utf-8"), indent=2)
    print("candidates=%d selected=%d" % (len(cases), len(sel)))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]))
