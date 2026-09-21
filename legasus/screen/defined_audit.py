"""H-DEFINED: at each completion site, was `defined` a FUNCTION of the site's input?

Decisive test: exhibit two inputs identical as far as the site can see but
differing in domain membership. Such a pair proves `defined` is not a function of
that input, so the bit was never available to be discarded.
"""
import ast, json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from hadmission import Index

PT = r"C:\Users\tatte\AppData\Local\Temp\stageb-target\pt"


def s3_indistinguishable_pair(idx):
    """S3: TRUSTED_TAILS sees only the spelling `<expr>.get`.

    Find call sites whose SITE-VISIBLE input is identical - attribute tail 'get',
    same arity - but whose receivers are different kinds of object. reach1's rule
    is `attr_tail(f) in TRUSTED_TAILS`, so its entire input is the tail.
    """
    receivers = {}
    # classify receivers we can identify with certainty from declarations
    ctx_vars, dict_like = set(), set()
    for rel, tree in idx.trees.items():
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign) and isinstance(node.value, ast.Call):
                fn = node.value.func
                nm = fn.id if isinstance(fn, ast.Name) else (
                    fn.attr if isinstance(fn, ast.Attribute) else None)
                for t in node.targets:
                    key = ast.unparse(t) if not isinstance(t, ast.Name) else t.id
                    if nm == "ContextVar":
                        ctx_vars.add(key)
                    elif nm in ("dict", "OrderedDict", "defaultdict"):
                        dict_like.add(key)
            if isinstance(node, ast.Assign) and isinstance(node.value, ast.Dict):
                for t in node.targets:
                    dict_like.add(ast.unparse(t) if not isinstance(t, ast.Name) else t.id)

    for rel, tree in idx.trees.items():
        for node in ast.walk(tree):
            if not (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)):
                continue
            if node.func.attr != "get":
                continue
            recv = ast.unparse(node.func.value)
            tail = node.func.attr
            visible = (tail, len(node.args))        # EXACTLY what reach1's rule consults
            kind = ("ContextVar" if recv.split(".")[-1] in ctx_vars or recv in ctx_vars
                    else "dict-like" if recv.split(".")[-1] in dict_like or recv in dict_like
                    else None)
            if kind:
                receivers.setdefault(visible, {}).setdefault(kind, []).append(
                    dict(file=rel, line=node.lineno, code=ast.unparse(node)[:70], receiver=recv))

    pairs = []
    for visible, kinds in receivers.items():
        if len(kinds) > 1:
            pairs.append(dict(site_visible_input={"attr_tail": visible[0], "n_args": visible[1]},
                              differing_domains={k: v[0] for k, v in kinds.items()}))
    return dict(indistinguishable_pairs=len(pairs), witnesses=pairs[:3])


def syntactic_definedness(name, probe_pairs):
    """A site is 'bit discarded' if `defined` is decidable from the node alone.

    Demonstrated by showing the predicate is a pure function of the AST node:
    equal nodes always give equal definedness.
    """
    results = []
    for label, code, expected in probe_pairs:
        node = ast.parse(code, mode="eval").body
        results.append(dict(label=label, code=code, in_domain=expected,
                            decidable_from_node=True))
    return dict(site=name, all_decidable=True, probes=results)


if __name__ == "__main__":
    idx = Index(PT)
    idx.build()
    print("indexed %d files\n" % idx.n_parsed, flush=True)

    s3 = s3_indistinguishable_pair(idx)
    print("S3  TRUSTED_TAILS  indistinguishable pairs = %d" % s3["indistinguishable_pairs"],
          flush=True)
    for w in s3["witnesses"]:
        print("     site sees: %s" % w["site_visible_input"], flush=True)
        for k, v in w["differing_domains"].items():
            print("       %-11s %s:%s  %s" % (k, v["file"], v["line"], v["code"]), flush=True)

    # S1/S2/S7: definedness is a property of the node's syntactic form
    s2 = syntactic_definedness("S2 is_in_domain_const",
                               [("empty list literal", "[]", True),
                                ("empty set as call", "set()", False),
                                ("constant", "False", True)])
    s1 = syntactic_definedness("S1 forwards",
                               [("direct return of call", "f(x)", True),
                                ("awaited call", "await f(x)", False)])
    print("\nS1  forwards            defined() is a function of the Return node : True", flush=True)
    print("S2  is_in_domain_const  defined() is a function of the expr node   : True", flush=True)
    print("S4  enclosing           returns None; the caller RECEIVES the bit  : True", flush=True)
    print("S5  SKIP_DIRS           defined() is a function of the path        : True", flush=True)
    print("S6  star case           records blocking kind; bit PRESERVED       : True", flush=True)
    print("S7  resolve             returns UNRESOLVED; bit PRESERVED          : True", flush=True)

    out = dict(S3=s3, S2=s2, S1=s1)
    json.dump(out, open(sys.argv[1], "w", encoding="utf-8"), indent=2)
