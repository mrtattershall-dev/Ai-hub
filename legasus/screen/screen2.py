"""SCREEN-2 detectors - INV-A2 and INV-B2, implemented from PYTHON-EVIDENCE-CONTRACT.md.

    python legasus/screen/screen2.py <target-root> <out-dir>

Governing rule (contract): a syntactic property may generate a CANDIDATE; it may not establish
the semantic proposition. Where the proposition cannot be established, preserve UNKNOWN.

screen1.py is left untouched; it is frozen history.
"""
import ast
import json
import os
import sys

CHECK_PREFIXES = ("is_", "has_", "can_", "should_", "validate_", "check_", "verify_", "ensure_")
SKIP_DIRS = {"venv", "node_modules", "__pycache__", ".git", "tests", "test", ".venv", "site-packages"}

UNRESOLVED = object()   # distinct from every real value, including None


def resolve(node):
    """The contract's SUPPORTED EQUIVALENCE RELATION, deliberately narrow.

    Literal constants by value, plus the handful of trivially foldable forms. Everything else
    is UNRESOLVED and must push the verdict to UNKNOWN - it may never be guessed at.
    """
    if node is None:
        return None                                   # `return` with no value is None
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, (ast.List, ast.Tuple, ast.Set)):
        vals = [resolve(e) for e in node.elts]
        if any(v is UNRESOLVED for v in vals):
            return UNRESOLVED
        return (type(node).__name__, tuple(vals))
    if isinstance(node, ast.Dict) and not node.keys:
        return ("Dict", ())
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
        v = resolve(node.operand)
        return UNRESOLVED if v is UNRESOLVED else (not v)
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
        v = resolve(node.operand)
        return UNRESOLVED if v is UNRESOLVED or not isinstance(v, (int, float)) else -v
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "bool" \
            and len(node.args) == 1 and not node.keywords:
        v = resolve(node.args[0])
        return UNRESOLVED if v is UNRESOLVED else bool(v)
    return UNRESOLVED


def _own_returns(fn):
    """Returns belonging to THIS function - not to a nested def/lambda."""
    out = []

    def walk(node, top=True):
        for child in ast.iter_child_nodes(node):
            if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)) and not top:
                continue
            if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)) and top and child is not fn:
                continue
            if isinstance(child, ast.Return):
                out.append(child)
            walk(child, False)
    walk(fn)
    return out


def _classify_returns(fn):
    """Partition this function's returns into exceptional / ordinary / finally."""
    exceptional, in_finally = set(), set()
    for node in ast.walk(fn):
        if isinstance(node, ast.ExceptHandler):
            for r in [x for x in ast.walk(node) if isinstance(x, ast.Return)]:
                exceptional.add(id(r))
        if isinstance(node, ast.Try):
            for stmt in node.finalbody:
                for r in [x for x in ast.walk(stmt) if isinstance(x, ast.Return)]:
                    in_finally.add(id(r))
    rets = _own_returns(fn)
    exc = [r for r in rets if id(r) in exceptional]
    fin = [r for r in rets if id(r) in in_finally]
    ordinary = [r for r in rets if id(r) not in exceptional and id(r) not in in_finally]
    return exc, ordinary, fin


def inv_a2(fn):
    """VIOLATION / DISTINGUISHABLE / UNKNOWN, per the contract. No polarity is inferred."""
    exc, ordinary, fin = _classify_returns(fn)
    if not exc:
        return None                                    # no candidate
    if fin:
        return {"verdict": "UNKNOWN", "reason": "a return inside `finally` is neither exceptional nor ordinary"}
    if not ordinary:
        return {"verdict": "UNKNOWN", "reason": "no non-exceptional return to compare against; vacuous difference is not a finding"}

    exc_vals = [(r, resolve(r.value)) for r in exc]
    ord_vals = [(r, resolve(r.value)) for r in ordinary]
    # Identity established by ONE pair is enough for a violation.
    for er, ev in exc_vals:
        if ev is UNRESOLVED:
            continue
        for _, ov in ord_vals:
            if ov is UNRESOLVED:
                continue
            if type(ev) is type(ov) and ev == ov:
                return {"verdict": "VIOLATION", "line": er.lineno,
                        "reason": f"an except handler returns {ev!r}, identical to a value returned on a non-exceptional path"}
    if any(v is UNRESOLVED for _, v in exc_vals) or any(v is UNRESOLVED for _, v in ord_vals):
        return {"verdict": "UNKNOWN", "reason": "at least one returned value is outside the supported equivalence relation"}
    return {"verdict": "DISTINGUISHABLE", "reason": "every exceptional return differs from every ordinary return (NOT a claim of correctness)"}


def inv_b2(fn):
    """PROVEN_FAILURE_UNREACHABLE / PROVEN_FAILURE_REACHABLE / UNKNOWN."""
    if not fn.name.startswith(CHECK_PREFIXES):
        return None                                    # name selects a CANDIDATE only
    rets = _own_returns(fn)
    if not rets:
        return None
    if any(isinstance(n, ast.Raise) for n in ast.walk(fn)):
        return {"verdict": "PROVEN_FAILURE_REACHABLE", "reason": "the function can raise"}
    vals = [(r, resolve(r.value)) for r in rets]
    if any(v is not UNRESOLVED and not v for _, v in vals):
        return {"verdict": "PROVEN_FAILURE_REACHABLE", "reason": "a literal falsey value is returned"}
    if any(v is UNRESOLVED for _, v in vals):
        return {"verdict": "UNKNOWN", "reason": "a returned expression's falsity cannot be established structurally"}
    return {"verdict": "PROVEN_FAILURE_UNREACHABLE", "line": rets[0].lineno,
            "reason": "every return is a truthy literal and the function cannot raise"}


REPORTABLE = {"VIOLATION", "PROVEN_FAILURE_UNREACHABLE"}


def main():
    root, out_dir = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
    os.makedirs(out_dir, exist_ok=True)
    files = parsed = 0
    unparseable, candidates, verdicts = [], [], {}
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            if not name.endswith(".py"):
                continue
            path = os.path.join(dirpath, name)
            rel = os.path.relpath(path, root).replace("\\", "/")
            files += 1
            try:
                src = open(path, "r", encoding="utf-8", errors="replace").read()
                tree = ast.parse(src)
            except Exception as e:  # noqa: BLE001 - an unparseable file is an OBSERVATION
                unparseable.append({"file": rel, "error": str(e)[:160]})
                continue
            parsed += 1
            for node in ast.walk(tree):
                if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    continue
                for inv, res in (("INV-A2", inv_a2(node)), ("INV-B2", inv_b2(node))):
                    if not res:
                        continue
                    key = f"{inv}:{res['verdict']}"
                    verdicts[key] = verdicts.get(key, 0) + 1
                    if res["verdict"] in REPORTABLE:
                        candidates.append({"invariant": inv, "verdict": res["verdict"], "file": rel,
                                           "function": node.name, "line": node.lineno,
                                           "flagged_line": res.get("line", node.lineno), "reason": res["reason"]})
    candidates.sort(key=lambda c: (c["file"], c["line"], c["invariant"]))
    result = {"target": root, "filesSeen": files, "filesParsed": parsed, "unparseable": unparseable,
              "verdictCounts": verdicts, "candidates": candidates,
              "note": "only VIOLATION and PROVEN_FAILURE_UNREACHABLE are reportable; UNKNOWN and "
                      "DISTINGUISHABLE are counted and never reported as findings"}
    with open(os.path.join(out_dir, "screen2.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    print(f"files seen {files}, parsed {parsed}, unparseable {len(unparseable)}")
    for k in sorted(verdicts):
        print(f"  {k}: {verdicts[k]}")
    print(f"reportable candidates: {len(candidates)}")
    print(f"-> {os.path.join(out_dir, 'screen2.json')}")


if __name__ == "__main__":
    main()
