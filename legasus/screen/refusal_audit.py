"""H-REFUSAL audit of census sites #10 and #13. Witness-or-nothing.

#10  hadmission.is_in_domain_const : does the rule entail the asserted relation
     "this returned constant inhabits the ordinary result domain"?
#13  hneutral repr comparison      : does repr equality entail observational identity
     over the values the harness actually handles?

A site scores UNJUSTIFIED only if a concrete witness is exhibited.
"""
import ast, json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from hadmission import is_in_domain_const, Index          # the rule under audit, unmodified

# semantically empty / ordinary-domain values written as constructor calls
CTOR_EQUIV = {"list": "[]", "dict": "{}", "tuple": "()", "str": '""',
              "int": "0", "float": "0.0", "bool": "False", "set": "set()",
              "frozenset": "frozenset()"}


def site10(roots):
    """Search real targets for except-handlers returning an ordinary-domain value
    that the rule classifies as NOT in-domain."""
    witnesses, counted = [], 0
    for root in roots:
        idx = Index(root)
        idx.build()
        for rel, tree in idx.trees.items():
            for node in ast.walk(tree):
                if not isinstance(node, ast.ExceptHandler):
                    continue
                for sub in ast.walk(node):
                    if not (isinstance(sub, ast.Return) and sub.value is not None):
                        continue
                    v = sub.value
                    if is_in_domain_const(v):
                        counted += 1
                        continue
                    # constructor call with no arguments -> the same value as a literal
                    if isinstance(v, ast.Call) and isinstance(v.func, ast.Name) \
                            and v.func.id in CTOR_EQUIV and not v.args and not v.keywords:
                        witnesses.append(dict(root=Path(root).name, file=rel, line=sub.lineno,
                                              code=ast.unparse(v),
                                              equivalent_literal=CTOR_EQUIV[v.func.id],
                                              kind="FALSE_SPLIT"))
                    # bool(<const>) -> resolve() folds this; is_in_domain_const does not
                    elif isinstance(v, ast.Call) and isinstance(v.func, ast.Name) \
                            and v.func.id == "bool" and len(v.args) == 1 \
                            and isinstance(v.args[0], ast.Constant):
                        witnesses.append(dict(root=Path(root).name, file=rel, line=sub.lineno,
                                              code=ast.unparse(v),
                                              equivalent_literal=repr(bool(v.args[0].value)),
                                              kind="FALSE_SPLIT"))
    return counted, witnesses


def site13():
    """Is repr equality faithful over the values hneutral actually handles?"""
    import hneutral as H
    domain = []
    for name, spec in H.PIPELINES.items():
        for v in spec["legit"]:
            domain.append((name, v))
        for k in ("neutral", "nonneutral", "indomain", "real", "filler"):
            if spec.get(k) is not None:
                domain.append((name, spec[k]))
    false_merge, false_split = [], []
    for i in range(len(domain)):
        for j in range(i + 1, len(domain)):
            (pi, a), (pj, b) = domain[i], domain[j]
            if pi != pj:
                continue                       # values from different pipelines never meet
            same_repr = repr(a) == repr(b)
            try:
                same_val = bool(a == b) and type(a) is type(b)
            except Exception:
                same_val = False
            if same_repr and not same_val:
                false_merge.append((pi, repr(a), repr(b)))
            if same_val and not same_repr:
                false_split.append((pi, repr(a), repr(b)))
            # the Python trap the rule would hit if bool and int ever met in one
            # pipeline. The first version of this probe fired on True vs True,
            # which is not a witness; require genuinely different types.
            if type(a) is not type(b) and a == b:
                false_split.append((pi, repr(a), repr(b), "cross-type =="))
    return false_merge, false_split


if __name__ == "__main__":
    roots = [r"C:\Users\tatte\AppData\Local\Temp\stageb-target\pt", r"C:\Users\tatte\odysseus"]
    counted, w10 = site10(roots)
    print("SITE #10  is_in_domain_const")
    print("   handlers the rule DID count as in-domain returns : %d" % counted)
    print("   witnesses it classified as NOT in-domain          : %d" % len(w10))
    for x in w10[:12]:
        print("      %-10s %-52s %-14s == %s" % (x["root"], (x["file"][:44] + ":" + str(x["line"])),
                                                 x["code"], x["equivalent_literal"]))
    fm, fs = site13()
    print()
    print("SITE #13  repr standing for value")
    print("   false merges (equal repr, different value) : %d" % len(fm))
    print("   false splits (equal value, different repr) : %d" % len(fs))
    for x in (fm + fs)[:8]:
        print("      %s" % (x,))
    json.dump({"site10": {"counted": counted, "witnesses": w10},
               "site13": {"false_merge": fm, "false_split": fs}},
              open(sys.argv[1], "w", encoding="utf-8"), indent=2)
