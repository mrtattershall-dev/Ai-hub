"""REACH-1: minimal proof closure for decisive-state reachability.

Frozen against REACH-1_PREREG.md (3c5b249). Records STRUCTURAL and COMPLEXITY
metrics separately so R1 (dissociation) can be tested. Three-valued verdict;
UNKNOWN never collapses to a settled value.
"""
import ast, json, sys
from pathlib import Path

# ---- frozen trusted-primitive list (prereg; nothing added after measurement) ----
TRUSTED_TAILS = {"get"}          # os.environ.get, dict.get
MAX_DEPTH = 8

BLOCK_DYNAMIC = "dynamic_dispatch"
BLOCK_ENV     = "environment"
BLOCK_EXTERN  = "external_call"
BLOCK_DEPTH   = "depth_cap"
BLOCK_NOSITE  = "no_call_site"
BLOCK_NODEF   = "omitted_no_default"
BLOCK_STAR    = "star_args"


def resolve_call_arg(call, k, pname, fdef):
    """How does this call site supply parameter k / pname?

    Returns (kind, node). Keyword arguments were ignored by the first version of
    this harness, which made every keyword-supplied value invisible.
    """
    for kw in call.keywords:
        if kw.arg == pname:
            return ("keyword", kw.value)
        if kw.arg is None:
            return ("star", None)          # **kwargs: cannot tell
    if any(isinstance(a, ast.Starred) for a in call.args):
        return ("star", None)
    if len(call.args) > k:
        return ("positional", call.args[k])
    if fdef is not None:
        params = [a.arg for a in fdef.args.args]
        ndef = len(fdef.args.defaults)
        if ndef and k < len(params) and k >= len(params) - ndef:
            return ("default", fdef.args.defaults[k - (len(params) - ndef)])
    return ("nodefault", None)


class Index:
    def __init__(self, root):
        self.root = Path(root)
        self.trees = {}
        self.srcs = {}
        self.funcs = {}
        self.n_parsed = 0
        self.n_failed = 0
        self._sites = {}

    def build(self):
        for p in self.root.rglob("*.py"):
            rel = str(p.relative_to(self.root))
            try:
                src = p.read_text(encoding="utf-8", errors="replace")
                t = ast.parse(src)
            except Exception:
                self.n_failed += 1
                continue
            self.n_parsed += 1
            self.trees[rel] = t
            self.srcs[rel] = src.splitlines()
            for node in ast.walk(t):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    self.funcs.setdefault(node.name, []).append((rel, node))
                elif isinstance(node, ast.Call):
                    f = node.func
                    nm = f.id if isinstance(f, ast.Name) else (
                        f.attr if isinstance(f, ast.Attribute) else None)
                    if nm:
                        self._sites.setdefault(nm, []).append((rel, node))

    def call_sites(self, fname):
        # single global pass built in build(); identical result, no per-name rescan
        return self._sites.get(fname, [])

    def line(self, rel, lineno):
        try:
            return self.srcs[rel][lineno - 1].strip()
        except Exception:
            return "<unavailable>"


def attr_tail(node):
    return node.attr if isinstance(node, ast.Attribute) else None


def enclosing_func(tree, lineno):
    best = None
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if node.lineno <= lineno <= (node.end_lineno or node.lineno):
                if best is None or node.lineno > best.lineno:
                    best = node
    return best


class Closure:
    def __init__(self):
        self.facts = []
        self.seen_keys = set()
        self.files = set()
        self.max_radius = 0
        self.edges = 0
        self.defs = 0
        self.blocking = set()
        self.trusted_terminal = False
        self.branches = []

    def fact(self, kind, rel, line, text, radius, is_def=False):
        key = (kind, rel, line, text)
        if key in self.seen_keys:
            return False
        self.seen_keys.add(key)
        self.facts.append({"kind": kind, "file": rel, "line": line,
                           "text": text, "radius": radius})
        self.files.add(rel)
        self.max_radius = max(self.max_radius, radius)
        self.edges += 1
        if is_def:
            self.defs += 1
        return True


def literal_produces(value, decisive):
    if decisive == "FALSY":
        return not bool(value)
    return None


def trace(idx, expr, rel, scope, decisive, cl, radius, depth, seen):
    if depth > MAX_DEPTH:
        cl.blocking.add(BLOCK_DEPTH)
        cl.branches.append("UNKNOWN")
        return

    line = getattr(expr, "lineno", 0)

    if isinstance(expr, ast.Constant):
        cl.fact("literal", rel, line, repr(expr.value), radius, is_def=True)
        v = literal_produces(expr.value, decisive)
        cl.branches.append("REACHABLE" if v else ("UNREACHABLE" if v is False else "UNKNOWN"))
        return

    # `a or b` -- the constraint that made validate_cuda's EMPTY unreachable
    if isinstance(expr, ast.BoolOp) and isinstance(expr.op, ast.Or):
        fallback = expr.values[-1]
        cl.fact("or_fallback", rel, line, ast.unparse(expr)[:120], radius, is_def=True)
        cl.trusted_terminal = True
        fb_falsy = isinstance(fallback, ast.Constant) and not fallback.value
        if decisive == "FALSY" and not fb_falsy:
            cl.branches.append("UNREACHABLE")
            return
        for v in expr.values:
            trace(idx, v, rel, scope, decisive, cl, radius, depth + 1, seen)
        return

    if isinstance(expr, ast.Call):
        f = expr.func
        if isinstance(f, ast.Attribute):
            if attr_tail(f) in TRUSTED_TAILS:
                cl.fact("trusted_primitive", rel, line, ast.unparse(expr)[:120], radius, is_def=True)
                cl.trusted_terminal = True
                if decisive == "FALSY" and len(expr.args) < 2:
                    cl.branches.append("REACHABLE")   # .get() with no default yields None
                elif decisive == "FALSY":
                    trace(idx, expr.args[1], rel, scope, decisive, cl, radius, depth + 1, seen)
                else:
                    cl.blocking.add(BLOCK_ENV)
                    cl.branches.append("UNKNOWN")
                return
            cl.blocking.add(BLOCK_DYNAMIC)
            cl.fact("blocked_attr_call", rel, line, ast.unparse(expr)[:120], radius)
            cl.branches.append("UNKNOWN")
            return
        if isinstance(f, ast.Name):
            targets = idx.funcs.get(f.id, [])
            if not targets:
                cl.blocking.add(BLOCK_EXTERN)
                cl.fact("blocked_extern_call", rel, line, ast.unparse(expr)[:120], radius)
                cl.branches.append("UNKNOWN")
                return
            for trel, tdef in targets[:3]:
                if (trel, tdef.name) in seen:
                    continue
                seen.add((trel, tdef.name))
                cl.fact("callee_def", trel, tdef.lineno, "def " + tdef.name, radius + 1, is_def=True)
                rets = [n for n in ast.walk(tdef) if isinstance(n, ast.Return) and n.value]
                if not rets:
                    cl.blocking.add(BLOCK_EXTERN)
                    cl.branches.append("UNKNOWN")
                    continue
                for r in rets:
                    trace(idx, r.value, trel, tdef, decisive, cl, radius + 1, depth + 1, seen)
            return
        cl.blocking.add(BLOCK_DYNAMIC)
        cl.branches.append("UNKNOWN")
        return

    if isinstance(expr, ast.Name):
        nm = expr.id
        assigns = []
        if scope is not None:
            for node in ast.walk(scope):
                if isinstance(node, ast.Assign):
                    for t in node.targets:
                        if isinstance(t, ast.Name) and t.id == nm:
                            assigns.append(node)
                elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name) \
                        and node.target.id == nm and node.value:
                    assigns.append(node)
        if assigns:
            for a in assigns:
                cl.fact("assignment", rel, a.lineno, idx.line(rel, a.lineno)[:120], radius, is_def=True)
                trace(idx, a.value, rel, scope, decisive, cl, radius, depth + 1, seen)
            return
        params = [] if scope is None else [a.arg for a in scope.args.args]
        if nm in params:
            k = params.index(nm)
            ndef = len(scope.args.defaults)
            if ndef and k >= len(params) - ndef:
                d = scope.args.defaults[k - (len(params) - ndef)]
                cl.fact("param_default", rel, getattr(d, "lineno", scope.lineno),
                        ast.unparse(d)[:80], radius, is_def=True)
                trace(idx, d, rel, scope, decisive, cl, radius, depth + 1, seen)
            sites = idx.call_sites(scope.name)
            if not sites:
                cl.blocking.add(BLOCK_NOSITE)
                cl.branches.append("UNKNOWN")
                return
            for srel, call in sites[:6]:
                kind, node = resolve_call_arg(call, k, nm, scope)
                if kind in ("positional", "keyword"):
                    cl.fact("call_site_" + kind, srel, call.lineno,
                            idx.line(srel, call.lineno)[:120], radius + 1)
                    sc = enclosing_func(idx.trees[srel], call.lineno)
                    trace(idx, node, srel, sc, decisive, cl, radius + 1, depth + 1, seen)
                elif kind == "default":
                    cl.fact("call_site_defaulted", srel, call.lineno,
                            idx.line(srel, call.lineno)[:120], radius + 1, is_def=True)
                    trace(idx, node, srel, scope, decisive, cl, radius + 1, depth + 1, seen)
                elif kind == "star":
                    cl.blocking.add(BLOCK_STAR)
                    cl.fact("call_site_star", srel, call.lineno,
                            idx.line(srel, call.lineno)[:120], radius + 1)
                    cl.branches.append("UNKNOWN")
                else:
                    cl.blocking.add(BLOCK_NODEF)
                    cl.fact("call_site_nodefault", srel, call.lineno,
                            idx.line(srel, call.lineno)[:120], radius + 1)
                    cl.branches.append("UNKNOWN")
            return
        cl.blocking.add(BLOCK_DYNAMIC)
        cl.fact("unresolved_name", rel, line, nm, radius)
        cl.branches.append("UNKNOWN")
        return

    if isinstance(expr, (ast.Subscript, ast.Attribute)):
        cl.blocking.add(BLOCK_DYNAMIC)
        cl.fact("blocked_access", rel, line, ast.unparse(expr)[:120], radius)
        cl.branches.append("UNKNOWN")
        return

    cl.blocking.add(BLOCK_DYNAMIC)
    cl.branches.append("UNKNOWN")


def verdict(cl):
    if "REACHABLE" in cl.branches:
        return "REACHABLE"
    if "UNKNOWN" in cl.branches or not cl.branches:
        return "UNKNOWN"
    return "UNREACHABLE"


def run_case(idx, case):
    rel, fname = case["file"], case["func"]
    tree = idx.trees.get(rel)
    cl = Closure()
    if tree is None:
        cl.blocking.add("file_unparsed")
        cl.branches.append("UNKNOWN")
        fdef = None
    else:
        fdef = next((n for n in ast.walk(tree)
                     if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
                     and n.name == fname), None)
    if fdef is not None:
        cl.fact("decision_site", rel, fdef.lineno, "def " + fname, 0)
    if fdef is not None and case["decisive"] in ("ENVIRONMENT", "EXCEPTION"):
        # decisive state is not in the value domain: no value trace can settle it
        cl.blocking.add(BLOCK_ENV)
        cl.branches.append("UNKNOWN")
    elif fdef is not None:
        params = [a.arg for a in fdef.args.args]
        if case["param"] not in params:
            cl.blocking.add(BLOCK_NOSITE)
            cl.branches.append("UNKNOWN")
        else:
            k = params.index(case["param"])
            sites = idx.call_sites(fname)
            if not sites:
                cl.blocking.add(BLOCK_NOSITE)
                cl.branches.append("UNKNOWN")
            for srel, call in sites[:6]:
                kind, node = resolve_call_arg(call, k, case["param"], fdef)
                if kind in ("positional", "keyword"):
                    cl.fact("call_site_" + kind, srel, call.lineno,
                            idx.line(srel, call.lineno)[:120], 1)
                    sc = enclosing_func(idx.trees[srel], call.lineno)
                    trace(idx, node, srel, sc, case["decisive"], cl, 1, 1, set())
                elif kind == "default":
                    cl.fact("call_site_defaulted", srel, call.lineno,
                            idx.line(srel, call.lineno)[:120], 1, is_def=True)
                    trace(idx, node, srel, fdef, case["decisive"], cl, 1, 1, set())
                elif kind == "star":
                    cl.blocking.add(BLOCK_STAR)
                    cl.fact("call_site_star", srel, call.lineno,
                            idx.line(srel, call.lineno)[:120], 1)
                    cl.branches.append("UNKNOWN")
                else:
                    cl.blocking.add(BLOCK_NODEF)
                    cl.fact("call_site_nodefault", srel, call.lineno,
                            idx.line(srel, call.lineno)[:120], 1)
                    cl.branches.append("UNKNOWN")
    beyond = any(f["file"] != rel for f in cl.facts) or cl.max_radius > 0
    return {"id": case["id"], "verdict": verdict(cl),
            "radius": cl.max_radius, "files": len(cl.files),
            "defs": cl.defs, "edges": cl.edges,
            "blocking": sorted(cl.blocking),
            "trusted_terminal": cl.trusted_terminal,
            "beyond_locality": beyond,
            "n_facts": len(cl.facts), "facts": cl.facts[:40]}


if __name__ == "__main__":
    root, spec, out = sys.argv[1], sys.argv[2], sys.argv[3]
    idx = Index(root)
    idx.build()
    cases = json.load(open(spec, encoding="utf-8"))
    res = [run_case(idx, c) for c in cases]
    # prereg invariant: UNKNOWN is a result and must carry the reason it was reached.
    naked = [r["id"] for r in res if r["verdict"] == "UNKNOWN" and not r["blocking"]]
    assert not naked, "UNKNOWN without a blocking kind (%d): %s" % (len(naked), naked[:5])
    json.dump({"root": root, "parsed": idx.n_parsed, "unparsed": idx.n_failed,
               "results": res}, open(out, "w", encoding="utf-8"), indent=2)
    print("indexed %d files (%d unparsed)" % (idx.n_parsed, idx.n_failed))
    hdr = "%-30s %-12s %-7s %-6s %-5s %-6s %-8s %-7s %s"
    print(hdr % ("case", "verdict", "radius", "files", "defs", "edges", "trusted", "beyond", "blocking"))
    for r in res:
        print(hdr % (r["id"][:30], r["verdict"], r["radius"], r["files"], r["defs"],
                     r["edges"], r["trusted_terminal"], r["beyond_locality"],
                     ",".join(r["blocking"]) or "-"))
