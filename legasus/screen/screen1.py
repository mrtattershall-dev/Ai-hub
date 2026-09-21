"""SCREEN-1 - evaluate two frozen invariants over a Python target's AST.

    python legasus/screen/screen1.py <target-root> <out-dir>

INV-A  a function whose EXCEPT handler returns a success value while the function also has an
       explicit failure return - the error path reports success.
INV-B  a check-named function with no reachable falsey return and no raise - a predicate that
       cannot fail.

Frozen in legasus/screen/SCREEN-1_PREREG.md (a3063ad) before any target source was read. Parses
only; nothing in the target is imported, executed or modified.
"""
import ast
import json
import os
import sys

CHECK_PREFIXES = ("is_", "has_", "can_", "should_", "validate_", "check_", "verify_", "ensure_")
SKIP_DIRS = {"venv", "node_modules", "__pycache__", ".git", "tests", "test", ".venv", "site-packages"}


def truthy_literal(node):
    """A return value that is a success sentinel by construction."""
    if isinstance(node, ast.Constant):
        return node.value is True or (isinstance(node.value, (int, float)) and node.value != 0 and node.value is not False)
    return False


def falsey_return(node):
    """A return that signals failure: False, None, bare return, or empty literal."""
    if node.value is None:
        return True
    v = node.value
    if isinstance(v, ast.Constant) and (v.value is False or v.value is None):
        return True
    return False


def returns_in(fn):
    out = []
    for n in ast.walk(fn):
        if isinstance(n, ast.Return):
            out.append(n)
    return out


def inv_a(fn, src_lines):
    """Except handler returning a success value while the function can also return failure."""
    handler_success = []
    for n in ast.walk(fn):
        if isinstance(n, ast.ExceptHandler):
            for r in [x for x in ast.walk(n) if isinstance(x, ast.Return)]:
                if truthy_literal(r.value):
                    handler_success.append(r)
    if not handler_success:
        return None
    has_failure_return = any(falsey_return(r) for r in returns_in(fn))
    if not has_failure_return:
        return None
    r = handler_success[0]
    return {
        "invariant": "INV-A",
        "function": fn.name,
        "line": fn.lineno,
        "flagged_line": r.lineno,
        "flagged_source": src_lines[r.lineno - 1].strip() if r.lineno - 1 < len(src_lines) else "",
    }


def inv_b(fn, src_lines):
    """Check-named function with no falsey return and no raise anywhere."""
    if not fn.name.startswith(CHECK_PREFIXES):
        return None
    rets = returns_in(fn)
    if not rets:
        return None
    if not any(truthy_literal(r.value) for r in rets):
        return None
    if any(falsey_return(r) for r in rets):
        return None
    if any(isinstance(n, ast.Raise) for n in ast.walk(fn)):
        return None
    return {
        "invariant": "INV-B",
        "function": fn.name,
        "line": fn.lineno,
        "flagged_line": rets[0].lineno,
        "flagged_source": src_lines[rets[0].lineno - 1].strip() if rets[0].lineno - 1 < len(src_lines) else "",
    }


def main():
    root, out_dir = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
    os.makedirs(out_dir, exist_ok=True)
    files, parsed, unparseable, candidates = 0, 0, [], []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn_name in filenames:
            if not fn_name.endswith(".py"):
                continue
            path = os.path.join(dirpath, fn_name)
            rel = os.path.relpath(path, root).replace("\\", "/")
            files += 1
            try:
                src = open(path, "r", encoding="utf-8", errors="replace").read()
                tree = ast.parse(src)
            except Exception as e:  # noqa: BLE001 - an unparseable file is an OBSERVATION
                unparseable.append({"file": rel, "error": str(e)[:160]})
                continue
            parsed += 1
            lines = src.splitlines()
            for node in ast.walk(tree):
                if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    continue
                for hit in (inv_a(node, lines), inv_b(node, lines)):
                    if hit:
                        hit["file"] = rel
                        candidates.append(hit)
    # Frozen ranking: file-path order, never interestingness.
    candidates.sort(key=lambda c: (c["file"], c["line"], c["invariant"]))
    result = {
        "target": root,
        "filesSeen": files,
        "filesParsed": parsed,
        "unparseable": unparseable,
        "counts": {
            "INV-A": sum(1 for c in candidates if c["invariant"] == "INV-A"),
            "INV-B": sum(1 for c in candidates if c["invariant"] == "INV-B"),
        },
        "candidates": candidates,
    }
    with open(os.path.join(out_dir, "screen1.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    print(f"files seen {files}, parsed {parsed}, unparseable {len(unparseable)}")
    print(f"INV-A candidates: {result['counts']['INV-A']}")
    print(f"INV-B candidates: {result['counts']['INV-B']}")
    print(f"-> {os.path.join(out_dir, 'screen1.json')}")


if __name__ == "__main__":
    main()
