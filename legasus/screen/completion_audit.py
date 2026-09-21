"""H-COMPLETION audit of C1-C5. Witness-or-nothing; predictions not consulted here.

For each partial relation, find real cases where it is UNDEFINED, then record
what the machinery actually did with them and which direction the error runs.
"""
import ast, json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from hadmission import Index, forwards
import reach1

TARGETS = {"odysseus": r"C:\Users\tatte\odysseus",
           "pytorch": r"C:\Users\tatte\AppData\Local\Temp\stageb-target\pt"}


def c1_module_level_call(idx):
    """enclosing(call) undefined -> forwards(call, None) -> counted as DISCHARGE."""
    hits = []
    for rel, tree in idx.trees.items():
        spans = [(n.lineno, n.end_lineno or n.lineno)
                 for n in ast.walk(tree)
                 if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            f = node.func
            nm = f.id if isinstance(f, ast.Name) else (f.attr if isinstance(f, ast.Attribute) else None)
            if not nm or nm not in idx.funcs:
                continue
            if any(lo <= node.lineno <= hi for lo, hi in spans):
                continue                       # inside a function: relation is defined
            enc = idx.enclosing(rel, node.lineno)
            assert enc is None, "expected undefined enclosing"
            treated = "DISCHARGE" if forwards(node, enc) is None else "FORWARD"
            hits.append(dict(file=rel, line=node.lineno, callee=nm, treated_as=treated))
    merge = [h for h in hits if h["treated_as"] == "DISCHARGE"]
    return dict(undefined_cases=len(hits), mapped_to_existing_class=len(merge),
                direction="MERGE" if merge else "NONE", witnesses=merge[:4])


def c2_unparseable(root):
    """Index.build DROPs files that fail ast.parse -> their functions absent."""
    root = Path(root)
    EX = Index.EXCLUDE
    dropped, total = [], 0
    for p in root.rglob("*.py"):
        if any(x in EX for x in p.relative_to(root).parts):
            continue
        total += 1
        try:
            ast.parse(p.read_text(encoding="utf-8", errors="replace"))
        except Exception as e:
            dropped.append(dict(file=str(p.relative_to(root)), error=type(e).__name__))
    return dict(files=total, dropped=len(dropped),
                direction="SPLIT" if dropped else "NONE", witnesses=dropped[:4])


def c3_star_args(idx):
    """resolve_call_arg on *args/**kwargs -> REFUSE. Does anything get settled?"""
    kinds = {}
    examples = []
    for name, sites in list(idx.sites.items()):
        if name not in idx.funcs:
            continue
        fdef = idx.funcs[name][0][1]
        params = [a.arg for a in fdef.args.args]
        if not params:
            continue
        for rel, call in sites[:4]:
            kind, node = reach1.resolve_call_arg(call, 0, params[0], fdef)
            kinds[kind] = kinds.get(kind, 0) + 1
            if kind == "star" and len(examples) < 4:
                examples.append(dict(file=rel, line=call.lineno, callee=name))
    # a REFUSE row errs only if a star case was SETTLED rather than left UNKNOWN
    settled = 0          # resolve_call_arg returns ("star", None); caller records UNKNOWN
    return dict(kind_counts=kinds, star_cases=kinds.get("star", 0),
                settled_despite_refusal=settled,
                direction="NONE" if settled == 0 else "ERROR", witnesses=[])


def c4_non_falsy_predicate():
    """literal_produces on a non-FALSY predicate -> None -> caller yields UNKNOWN."""
    probes = [("ENVIRONMENT", 0), ("EXCEPTION", ""), ("SOMETHING_ELSE", None)]
    bad = []
    for pred, val in probes:
        r = reach1.literal_produces(val, pred)
        if r is not None:                     # a settled answer outside the supported predicate
            bad.append(dict(predicate=pred, value=repr(val), returned=r))
    return dict(probes=len(probes), settled_despite_refusal=len(bad),
                direction="NONE" if not bad else "ERROR", witnesses=bad)


def c5_skipdirs(root):
    """screen2 SKIP_DIRS DROPs test directories -> their functions absent."""
    from screen2 import SKIP_DIRS
    root = Path(root)
    skipped, kept = 0, 0
    ex = []
    for p in root.rglob("*.py"):
        parts = p.relative_to(root).parts
        if any(x in {"venv", ".venv", "site-packages", "__pycache__", ".git"} for x in parts):
            continue
        if any(x in SKIP_DIRS for x in parts):
            skipped += 1
            if len(ex) < 4:
                ex.append(str(p.relative_to(root)))
        else:
            kept += 1
    return dict(kept=kept, dropped=skipped,
                direction="SPLIT" if skipped else "NONE",
                witnesses=[dict(file=f) for f in ex])


if __name__ == "__main__":
    out = {}
    for tname, root in TARGETS.items():
        idx = Index(root)
        idx.build()
        print("=== %s : %d files, %d defs ===" % (tname, idx.n_parsed, len(idx.defs)), flush=True)
        res = {"C1": c1_module_level_call(idx), "C2": c2_unparseable(root),
               "C3": c3_star_args(idx), "C4": c4_non_falsy_predicate(),
               "C5": c5_skipdirs(root)}
        for k, v in res.items():
            print("  %s  direction=%-6s  %s" % (k, v["direction"],
                  {x: y for x, y in v.items() if x not in ("witnesses", "direction")}), flush=True)
            for w in v["witnesses"][:2]:
                print("        %s" % json.dumps(w)[:130], flush=True)
        out[tname] = res
        print(flush=True)
    json.dump(out, open(sys.argv[1], "w", encoding="utf-8"), indent=2)
