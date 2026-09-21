"""H-ADMISSION: transitive discharge fan-out of failure-coerced values.

Frozen against H-ADMISSION_PREREG.md (5276474).

If a failure coercion produced a TAGGED value instead of a bare one, every site
that consumes the value would have to discharge the tag, and every site that
merely FORWARDS it would propagate the obligation to its own consumers. This
measures that transitive set on real code.

Two deliberate bias choices, both away from the hypothesis:
  * the traversal cap is large and hitting it is recorded as DIFFUSE, so the cap
    can never manufacture concentration;
  * call sites are matched by name, which over-counts when a name is shared, and
    over-counting inflates fan-out. Unambiguous names are reported separately.
"""
import ast, hashlib, json, statistics, sys
from pathlib import Path

IN_DOMAIN = [True, False, 0, 0.0, "", [], (), {}]
CAP = 2000


def is_in_domain_const(node):
    if isinstance(node, ast.Constant):
        return any(type(node.value) is type(c) and node.value == c for c in IN_DOMAIN)
    if isinstance(node, (ast.List, ast.Tuple)) and not node.elts:
        return True
    if isinstance(node, ast.Dict) and not node.keys:
        return True
    return False


class Index:
    def __init__(self, root):
        self.root = Path(root)
        self.trees = {}
        self.funcs = {}          # name -> [(rel, def)]
        self.defs = []           # (rel, def)
        self.sites = {}          # callee name -> [(rel, call)]
        self.n_parsed = 0
        self._spans = {}
        self._hashes = set()
        self.n_dupe = 0

    EXCLUDE = {"venv", ".venv", "site-packages", "node_modules", "third_party",
               "build", "dist", ".git", "__pycache__"}

    def build(self):
        for p in self.root.rglob("*.py"):
            rel = str(p.relative_to(self.root))
            if any(part in self.EXCLUDE for part in p.relative_to(self.root).parts):
                continue          # vendored code is not the program under analysis
            try:
                src = p.read_text(encoding="utf-8", errors="replace")
                t = ast.parse(src)
            except Exception:
                continue
            # a target may contain a byte-identical copy of its own tree, which
            # doubles every definition and inflates fan-out. Count each once.
            h = hashlib.sha256(src.encode("utf-8", "replace")).hexdigest()
            if h in self._hashes:
                self.n_dupe += 1
                continue
            self._hashes.add(h)
            self.n_parsed += 1
            self.trees[rel] = t
            for node in ast.walk(t):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    self.funcs.setdefault(node.name, []).append((rel, node))
                    self.defs.append((rel, node))
                elif isinstance(node, ast.Call):
                    f = node.func
                    nm = f.id if isinstance(f, ast.Name) else (
                        f.attr if isinstance(f, ast.Attribute) else None)
                    if nm:
                        self.sites.setdefault(nm, []).append((rel, node))

    def enclosing(self, rel, lineno):
        # per-file span table built once; identical result to walking the tree
        spans = self._spans.get(rel)
        if spans is None:
            spans = [(n.lineno, n.end_lineno or n.lineno, n)
                     for n in ast.walk(self.trees[rel])
                     if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
            spans.sort(key=lambda s: s[0])
            self._spans[rel] = spans
        best = None
        for lo, hi, n in spans:
            if lo > lineno:
                break
            if lineno <= hi and (best is None or lo > best.lineno):
                best = n
        return best


def coerces(fdef):
    """Does this function return an ordinary-domain constant from an except handler?"""
    for node in ast.walk(fdef):
        if not isinstance(node, ast.ExceptHandler):
            continue
        for sub in ast.walk(node):
            if isinstance(sub, ast.Return) and sub.value is not None \
                    and is_in_domain_const(sub.value):
                return True
    return False


def forwards(call, fdef):
    """Does the enclosing function RETURN this call's value (tag propagates)?

    Direct `return f(...)`, or `x = f(...)` with a later `return x`.
    """
    if fdef is None:
        return None
    for node in ast.walk(fdef):
        if isinstance(node, ast.Return) and node.value is call:
            return fdef.name
    target = None
    for node in ast.walk(fdef):
        if isinstance(node, ast.Assign) and node.value is call:
            for t in node.targets:
                if isinstance(t, ast.Name):
                    target = t.id
    if target:
        for node in ast.walk(fdef):
            if isinstance(node, ast.Return) and isinstance(node.value, ast.Name) \
                    and node.value.id == target:
                return fdef.name
    return None


def fanout(idx, start_name):
    """Transitive discharge sites reachable from a coercing function."""
    seen_funcs = {start_name}
    frontier = [start_name]
    discharge = 0
    reached = set()
    capped = False
    while frontier:
        nm = frontier.pop()
        for rel, call in idx.sites.get(nm, []):
            if discharge >= CAP:
                capped = True
                break
            enc = idx.enclosing(rel, call.lineno)
            fwd = forwards(call, enc)
            if fwd and fwd not in seen_funcs:
                seen_funcs.add(fwd)
                frontier.append(fwd)
                reached.add((rel, fwd))
            elif not fwd:
                discharge += 1
                if enc is not None:
                    reached.add((rel, enc.name))
        if capped:
            break
    return dict(discharge_sites=discharge, reached_functions=len(reached),
                propagated_through=len(seen_funcs) - 1, capped=capped)


def summarize(rows, label, n_indexed):
    d = [r["discharge_sites"] for r in rows]
    if not d:
        print("%s: empty" % label)
        return {}
    d_sorted = sorted(d)
    p90 = d_sorted[int(0.9 * (len(d_sorted) - 1))]
    over20 = sum(1 for x in d if x > 20) / len(d)
    reach_frac = sorted(r["reached_functions"] / max(n_indexed, 1) for r in rows)
    p90_reach = reach_frac[int(0.9 * (len(reach_frac) - 1))]
    s = dict(label=label, n=len(d), median=statistics.median(d), mean=round(sum(d) / len(d), 2),
             p90=p90, max=max(d), frac_over_20=round(over20, 4),
             frac_zero=round(sum(1 for x in d if x == 0) / len(d), 3),
             p90_reach_fraction=round(p90_reach, 5),
             capped=sum(1 for r in rows if r["capped"]))
    print("%-34s n=%-5d median=%-5s mean=%-8s p90=%-5s max=%-6s >20=%-7s reach_p90=%-9s capped=%d"
          % (label, s["n"], s["median"], s["mean"], s["p90"], s["max"],
             s["frac_over_20"], s["p90_reach_fraction"], s["capped"]))
    return s


def main(root, out_path, limit):
    idx = Index(root)
    idx.build()
    n_funcs = len(idx.defs)
    print("indexed %d files (%d duplicate files skipped), %d function defs" % (idx.n_parsed, idx.n_dupe, n_funcs))

    coercing, plain = [], []
    for rel, fdef in idx.defs:
        (coercing if coerces(fdef) else plain).append((rel, fdef))
    print("coercing functions: %d    non-coercing: %d" % (len(coercing), len(plain)))

    # deterministic even-spaced draws; control matched on TREE and COUNT only
    def draw(pool, k):
        if len(pool) <= k:
            return pool
        step = len(pool) / k
        return [pool[int(i * step)] for i in range(k)]

    c_sample = draw(coercing, limit)
    p_sample = draw(plain, limit)

    rows = {"coercing": [], "control": []}
    for label, sample in (("coercing", c_sample), ("control", p_sample)):
        for rel, fdef in sample:
            r = fanout(idx, fdef.name)
            r.update(name=fdef.name, file=rel,
                     name_ambiguous=len(idx.funcs.get(fdef.name, [])) > 1)
            rows[label].append(r)

    print()
    res = {}
    res["coercing_all"] = summarize(rows["coercing"], "COERCING (all)", n_funcs)
    res["control_all"] = summarize(rows["control"], "CONTROL  (all)", n_funcs)
    cu = [r for r in rows["coercing"] if not r["name_ambiguous"]]
    pu = [r for r in rows["control"] if not r["name_ambiguous"]]
    print()
    res["coercing_unambiguous"] = summarize(cu, "COERCING (unambiguous names)", n_funcs)
    res["control_unambiguous"] = summarize(pu, "CONTROL  (unambiguous names)", n_funcs)

    json.dump({"root": root, "indexed_functions": n_funcs,
               "n_coercing": len(coercing), "n_plain": len(plain),
               "summary": res, "rows": rows},
              open(out_path, "w", encoding="utf-8"), indent=2)
    return res


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]))
