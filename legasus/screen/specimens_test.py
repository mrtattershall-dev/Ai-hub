"""SPECIMEN PROTECTION — this test FAILS if a deliberate defect is repaired.

These defects are evidence. Each is the scored subject of at least one frozen
experiment, and repairing one destroys the result that rests on it. A cleanup
agent "improving the repository" would otherwise delete them silently.

DO NOT FIX THE FAILURES THIS TEST REPORTS. If a specimen must be retired, retire
the experiments that depend on it first, with tatte's decision on the record.
"""
import ast, sys
from pathlib import Path

HERE = Path(__file__).parent
fails = []


def src(name):
    return (HERE / name).read_text(encoding="utf-8")


# ---- Specimen #7: attribute NAME standing for function identity -------------
# Load-bearing for: IDENTITY-CENSUS, H-REFUSAL (site #7), H-DEFINED (S3),
#                   H-ORTHO (family F2), H-CLOSURE (the single moved verdict)
s = src("reach1.py")
if 'TRUSTED_TAILS = {"get"}' not in s:
    fails.append("SPECIMEN #7 REPAIRED: reach1.TRUSTED_TAILS no longer matches by bare name. "
                 "H-DEFINED's three indistinguishable pairs and H-CLOSURE's only moved verdict "
                 "both rest on this defect.")

# ---- Specimen #10: structural false split on empty collections --------------
# Load-bearing for: IDENTITY-CENSUS, H-REFUSAL (site #10)
h = src("hadmission.py")
tree = ast.parse(h)
fn = next((n for n in ast.walk(tree)
           if isinstance(n, ast.FunctionDef) and n.name == "is_in_domain_const"), None)
if fn is None:
    fails.append("SPECIMEN #10 REMOVED: is_in_domain_const no longer exists.")
else:
    body = ast.unparse(fn)
    if "ast.Constant" not in body:
        fails.append("SPECIMEN #10 REPAIRED: is_in_domain_const no longer keys on ast.Constant. "
                     "Python has no empty-set literal, so that keying is what makes set() "
                     "structurally unrepresentable - the false split H-REFUSAL scored.")
    if "ast.Call" in body:
        fails.append("SPECIMEN #10 REPAIRED: is_in_domain_const now admits constructor calls, "
                     "which removes the structural false split.")

# ---- Specimen: the scalar scope lattice ------------------------------------
# Load-bearing for: SHADOW-WIRING_RESULT (the inert E1 step), H-EXTENT (its motivation)
import importlib.util
spec = importlib.util.spec_from_file_location("ent", HERE / "entitlement.py")
ent = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ent)
order = ent.SCOPE_ORDER
if "SAMPLE" not in order or "FUNCTION" not in order:
    fails.append("SCOPE SPECIMEN REMOVED: SCOPE_ORDER no longer contains SAMPLE and FUNCTION.")
elif order.index("SAMPLE") >= order.index("FUNCTION"):
    fails.append("SCOPE SPECIMEN REPAIRED: SAMPLE is no longer ranked narrower than FUNCTION. "
                 "That inversion is what made the shadow run's E1 step inert, and "
                 "SHADOW-WIRING_RESULT depends on reproducing it.")

# ---- the specimens must also still be REACHED by their experiments ----------
for f, marker in (("H-DEFINED_RESULT.md", "indistinguishable"),
                  ("H-REFUSAL_RESULT.md", "frozenset"),
                  ("SHADOW-WIRING_RESULT.md", "INERT")):
    p = HERE / f
    if not p.exists():
        fails.append("RESULT MISSING: %s - a specimen's scored experiment was deleted." % f)
    elif marker not in p.read_text(encoding="utf-8"):
        fails.append("RESULT ALTERED: %s no longer records '%s'." % (f, marker))

print("specimen protection: %d defect(s) expected, %d violation(s)" % (3, len(fails)))
if fails:
    print()
    print("SPECIMEN PROTECTION FAILED - evidence has been destroyed or altered:")
    for x in fails:
        print("   - %s" % x)
    print()
    print("Do NOT 'fix' these findings. Restore the specimens, or retire their")
    print("experiments explicitly with tatte's decision recorded.")
    sys.exit(1)
print("all deliberate specimens intact; their scored results still reference them")
