"""Stage B case selection - executes the AST rule frozen in STAGE-B_PROTOCOL.md (fc5932f).

    python legasus/screen/case_select.py <target-root> <out-dir>

The rule, verbatim from the protocol:

  CANDIDATE DECISION  an `if` whose test contains a call to a project-local function whose return
                      value is not stored, and whose body performs a user-visible or control-flow
                      action (raise, return, log at warning/error, or a call whose name contains
                      warn/error/abort/skip/fallback)
  RANKING             file-path order, never interestingness
  CASE                the first 3 candidates

This script selects. It does not diagnose, and it reads no function body for semantics beyond
what the rule requires.
"""
import ast
import json
import os
import sys

SKIP_DIRS = {"venv", ".venv", "node_modules", "__pycache__", ".git", "third_party", "site-packages"}
ACTION_WORDS = ("warn", "error", "abort", "skip", "fallback")
LOG_LEVELS = ("warning", "error", "critical", "exception", "fatal")


import builtins

BUILTIN_NAMES = set(dir(builtins))


def called_name(node):
    f = node.func
    if isinstance(f, ast.Name):
        return f.id
    if isinstance(f, ast.Attribute):
        return f.attr
    return None


def project_local_call(node, local_funcs):
    """APPARATUS CORRECTION (fifth instance of the weakened-criterion pattern).

    The frozen rule says "a call to a PROJECT-LOCAL function". The first implementation asked
    only whether the called NAME appeared among names defined in the repo - a weaker proxy. In a
    repository this size, `len` and `match` are defined somewhere, so builtins and stdlib calls
    were admitted and the top three selections were `len()` and `re.match()`.

    Corrected to implement the frozen criterion: a BARE NAME call (not an attribute access on a
    module or object) whose name is defined in this repository and is not a Python builtin.
    The rule is unchanged; only its implementation is.
    """
    f = node.func
    if not isinstance(f, ast.Name):
        return None                       # `re.match(...)`, `self.foo(...)` - not a bare local call
    if f.id in BUILTIN_NAMES:
        return None                       # `len(...)` is a builtin regardless of shadowing
    return f.id if f.id in local_funcs else None


def body_is_action(body):
    """raise / return / a warning-or-error log / a call whose name carries an action word."""
    for stmt in body:
        for n in ast.walk(stmt):
            if isinstance(n, (ast.Raise, ast.Return)):
                return "raise" if isinstance(n, ast.Raise) else "return"
            if isinstance(n, ast.Call):
                nm = called_name(n)
                if not nm:
                    continue
                if nm.lower() in LOG_LEVELS:
                    return f"log.{nm}"
                if any(w in nm.lower() for w in ACTION_WORDS):
                    return f"call:{nm}"
    return None


def main():
    root, out_dir = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
    os.makedirs(out_dir, exist_ok=True)

    files = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            if name.endswith(".py"):
                files.append(os.path.join(dirpath, name))
    files.sort(key=lambda p: os.path.relpath(p, root).replace("\\", "/"))

    # Pass 1: every function defined anywhere in the tree = the project-local name set.
    local_funcs, parse_failures = {}, []
    trees = {}
    for path in files:
        rel = os.path.relpath(path, root).replace("\\", "/")
        try:
            src = open(path, "r", encoding="utf-8", errors="replace").read()
            t = ast.parse(src)
        except Exception as e:  # noqa: BLE001 - an unparseable file is an OBSERVATION
            parse_failures.append({"file": rel, "error": str(e)[:120]})
            continue
        trees[rel] = (t, src.splitlines())
        for n in ast.walk(t):
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)):
                local_funcs.setdefault(n.name, []).append((rel, n.lineno))

    # Pass 2: candidate decisions, in file-path order.
    candidates = []
    for rel in sorted(trees):
        tree, lines = trees[rel]
        for node in ast.walk(tree):
            if not isinstance(node, ast.If):
                continue
            calls = [c for c in ast.walk(node.test) if isinstance(c, ast.Call)]
            local = [c for c in calls if project_local_call(c, local_funcs)]
            if not local:
                continue
            action = body_is_action(node.body)
            if not action:
                continue
            fn = project_local_call(local[0], local_funcs)
            candidates.append({
                "file": rel, "line": node.lineno,
                "decision": lines[node.lineno - 1].strip()[:150] if node.lineno - 1 < len(lines) else "",
                "calledFunction": fn,
                "definedAt": local_funcs[fn][:3],
                "definitionSites": len(local_funcs[fn]),
                "bodyAction": action,
            })

    selected = candidates[:3]
    out = {"target": root, "filesScanned": len(files), "filesParsed": len(trees),
           "parseFailures": parse_failures[:20], "parseFailureCount": len(parse_failures),
           "localFunctionNames": len(local_funcs), "candidates": len(candidates), "selected": selected}
    json.dump(out, open(os.path.join(out_dir, "cases.json"), "w"), indent=2)
    print(f"files {len(files)}, parsed {len(trees)}, parse failures {len(parse_failures)}")
    print(f"local function names {len(local_funcs)}, candidate decisions {len(candidates)}")
    for i, c in enumerate(selected, 1):
        print(f"  [{i}] {c['file']}:{c['line']}  calls {c['calledFunction']}()  "
              f"(defined in {c['definitionSites']} place(s))  body={c['bodyAction']}")
        print(f"      {c['decision']}")
    print(f"-> {os.path.join(out_dir, 'cases.json')}")


if __name__ == "__main__":
    main()
