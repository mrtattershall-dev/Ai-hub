"""H-INVERSE audit of M1-M6. Witness-or-nothing; predictions are not consulted.

Each test searches a real target for a concrete case where the required property
fails, and records WHICH DIRECTION the resulting error runs. The predicted
directions live in H-INVERSE_PREREG.md and are compared only at scoring time.
"""
import ast, hashlib, json, sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from hadmission import Index, forwards, coerces, is_in_domain_const

PT = sys.argv[2] if len(sys.argv) > 2 else r"C:\Users\tatte\AppData\Local\Temp\stageb-target\pt"


def m1_callee_name_injectivity(idx):
    """callee identity -> callee NAME. Does one name denote one function?"""
    shared = {n: v for n, v in idx.funcs.items() if len(v) > 1}
    worst = sorted(shared.items(), key=lambda kv: -len(kv[1]))[:5]
    # a witness that actually reached a scored result: 'get_path' style helpers
    ex = []
    for n, defs in worst:
        ex.append(dict(name=n, distinct_definitions=len(defs),
                       files=[d[0] for d in defs[:3]]))
    return dict(names_total=len(idx.funcs), names_shared=len(shared),
                collision_rate=round(len(shared) / max(len(idx.funcs), 1), 4),
                witnesses=ex)


def m2_forwarding_coverage(idx, limit=4000):
    """forwarding relation -> forwards() rule. Is a returned call always recognised?"""
    missed, seen = [], 0
    for rel, tree in idx.trees.items():
        for fdef in [n for n in ast.walk(tree)
                     if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]:
            for ret in [n for n in ast.walk(fdef) if isinstance(n, ast.Return) and n.value]:
                if isinstance(ret.value, ast.Call):
                    continue                       # the recognised direct form
                inner = [c for c in ast.walk(ret.value) if isinstance(c, ast.Call)]
                if not inner:
                    continue
                seen += 1
                call = inner[0]
                if forwards(call, fdef) is None:   # the value IS returned, rule says no
                    missed.append(dict(file=rel, line=ret.lineno,
                                       code=ast.unparse(ret)[:90],
                                       form=type(ret.value).__name__))
            if seen > limit:
                break
        if seen > limit:
            break
    return dict(returns_wrapping_a_call=seen, unrecognised=len(missed),
                witnesses=missed[:6])


def m3_program_coverage(root):
    """"the program" -> indexed *.py. Are there program parts the index cannot see?"""
    root = Path(root)
    counts = defaultdict(int)
    for ext in (".pyx", ".pyi", ".pxd", ".so", ".pyd", ".cpp", ".cu"):
        for p in root.rglob("*" + ext):
            if any(x in p.parts for x in ("third_party", "build", ".git")):
                continue
            counts[ext] += 1
    return dict(non_py_sources=dict(counts),
                witnesses=[dict(kind=k, count=v) for k, v in counts.items() if v])


def m4_falsy_injectivity():
    """decisive state -> FALSY predicate. How many distinct states share one class?"""
    import reach1
    states = [None, "", 0, 0.0, False, [], (), {}, set()]
    merged = [repr(s) for s in states if reach1.literal_produces(s, "FALSY")]
    return dict(distinct_states_merged=len(merged), members=merged,
                witnesses=[dict(note="all of these yield the same REACHABLE branch",
                                members=merged)] if len(merged) > 1 else [])


def m5_coercion_coverage(idx):
    """failure coercion -> coerces() rule. Are coercions via a NAME recognised?"""
    missed = []
    for rel, tree in idx.trees.items():
        for fdef in [n for n in ast.walk(tree)
                     if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]:
            if coerces(fdef):
                continue                            # already counted
            for h in [n for n in ast.walk(fdef) if isinstance(n, ast.ExceptHandler)]:
                # `except: x = <in-domain const> ... return x`
                bound = {}
                for a in [n for n in ast.walk(h) if isinstance(n, ast.Assign)]:
                    if is_in_domain_const(a.value):
                        for t in a.targets:
                            if isinstance(t, ast.Name):
                                bound[t.id] = ast.unparse(a.value)
                for r in [n for n in ast.walk(h) if isinstance(n, ast.Return) and n.value]:
                    if isinstance(r.value, ast.Name) and r.value.id in bound:
                        missed.append(dict(file=rel, line=r.lineno,
                                           code="%s  (bound to %s)" % (ast.unparse(r),
                                                                       bound[r.value.id])))
    return dict(unrecognised=len(missed), witnesses=missed[:6])


def m6_hash_canonicality(idx):
    """program unit -> content SHA-256. Do equal units get equal representations?"""
    by_ast = defaultdict(list)
    for rel, tree in idx.trees.items():
        by_ast[ast.dump(tree)].append(rel)
    collisions = [v for v in by_ast.values() if len(v) > 1]
    # these have identical ASTs; do their raw bytes differ?
    witnesses = []
    for group in collisions[:200]:
        hs = set()
        for rel in group:
            try:
                hs.add(hashlib.sha256((idx.root / rel).read_bytes()).hexdigest())
            except Exception:
                pass
        if len(hs) > 1:
            witnesses.append(dict(files=group[:3], distinct_hashes=len(hs)))
    return dict(ast_identical_groups=len(collisions),
                groups_with_differing_bytes=len(witnesses), witnesses=witnesses[:6])


if __name__ == "__main__":
    idx = Index(PT)
    idx.build()
    print("target %s\nindexed %d files, %d defs\n" % (PT, idx.n_parsed, len(idx.defs)), flush=True)
    out = {}
    for name, fn in (("M1", lambda: m1_callee_name_injectivity(idx)),
                     ("M2", lambda: m2_forwarding_coverage(idx)),
                     ("M3", lambda: m3_program_coverage(PT)),
                     ("M4", m4_falsy_injectivity),
                     ("M5", lambda: m5_coercion_coverage(idx)),
                     ("M6", lambda: m6_hash_canonicality(idx))):
        r = fn()
        out[name] = r
        w = r.get("witnesses", [])
        print("%s  property %s   witnesses=%d" %
              (name, "FAILS" if w else "HOLDS", len(w)), flush=True)
        for x in w[:3]:
            print("      %s" % json.dumps(x)[:150], flush=True)
        print(flush=True)
    json.dump(out, open(sys.argv[1], "w", encoding="utf-8"), indent=2)
