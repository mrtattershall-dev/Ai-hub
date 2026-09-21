"""Conformance gate for entitlement.py. Must pass before anything is claimed.

Reproduces the H-ORTHO matrix, both two-gate cases, the downward compilations,
and an ABLATION showing each gate is non-redundant on a recorded case.
"""
import dataclasses, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from entitlement import (Claim, Evidence, attempt, candidate_missing_gate,
                         gate_obligation, gate_derivation, gate_measurement,
                         EntitlementAttempt, GateFinding)

SETTLED = [dict(premises_decidable=True, premises_settled=True)]
OPEN = [dict(premises_decidable=False, premises_settled=False)]

CASES = {
    "F1 StageB case3": (
        Claim("EXISTENTIAL", "input breaking validate_cuda", "PROGRAM", "stageb"),
        Evidence(evidence_scope="FUNCTION", domain_stated=True, domain_size=1, examined=1,
                 supporting_derivations=SETTLED, positive_control_fired=True,
                 instrument="stageb diagnosis"),
        (False, True, True)),
    "F2 REACH-1 get_path": (
        Claim("EXISTENTIAL", "falsy value reaching the guard", "FUNCTION_PARAMETER", "reach1"),
        Evidence(evidence_scope="FUNCTION_PARAMETER", domain_stated=True, domain_size=1, examined=1,
                 supporting_derivations=OPEN, positive_control_fired=True,
                 instrument="reach1 tracer"),
        (True, False, True)),
    "F3 SCREEN-1 as stated": (
        Claim("EXISTENTIAL", "candidate finding", "THIS_RUN", "screen1"),
        Evidence(evidence_scope="THIS_RUN", domain_stated=True, domain_size=546, examined=546,
                 supporting_derivations=SETTLED, positive_control_fired=False,
                 instrument="SCREEN-1 detectors"),
        (True, True, False)),
    "F4 REACH-1 R2": (
        Claim("UNIVERSAL", "closure extends beyond the function body", "SAMPLE", "reach1"),
        Evidence(evidence_scope="SAMPLE", domain_stated=True, domain_size=60, examined=60,
                 supporting_derivations=SETTLED, positive_control_fired=True,
                 instrument="reach1 tracer"),
        (True, True, True)),
    "F3' SCREEN-1 counterfactual": (
        Claim("ABSENCE", "defect", "REPOSITORY", "screen1"),
        Evidence(evidence_scope="THIS_RUN", domain_stated=True, domain_size=546, examined=546,
                 supporting_derivations=SETTLED, positive_control_fired=False,
                 instrument="SCREEN-1 detectors"),
        (False, True, False)),
    "F5 richness run": (
        Claim("DISTINCTION", "H-INFO discriminated from H-RICH", "SAMPLE", "hinfo"),
        Evidence(evidence_scope="SAMPLE", domain_stated=True, domain_size=3, examined=3,
                 supporting_derivations=[dict(premises_decidable=True, premises_settled=False)],
                 positive_control_fired=False, instrument="hinfo harness"),
        (True, False, False)),
}

fails = []

print("=== gate matrix ===")
print("%-30s %-6s %-6s %-6s %-9s %s" % ("case", "O", "D", "M", "entitled", "expected"))
atts = {}
for name, (claim, ev, expected) in CASES.items():
    a = attempt(claim, ev)
    atts[name] = a
    got = a.vector()
    ok = got == expected
    if not ok:
        fails.append("%s: got %s expected %s" % (name, got, expected))
    print("%-30s %-6s %-6s %-6s %-9s %s %s" % (
        name[:30], "PASS" if got[0] else "FAIL", "PASS" if got[1] else "FAIL",
        "PASS" if got[2] else "FAIL", a.entitled, expected, "" if ok else "<-- MISMATCH"))

print()
print("=== downward compilation ===")
for name in ("F1 StageB case3", "F3 SCREEN-1 as stated", "F3' SCREEN-1 counterfactual",
             "F2 REACH-1 get_path"):
    lic = atts[name].licensed
    print("%-30s -> %s" % (name[:30],
          "NOTHING licensed about the subject" if lic is None
          else "%s: %s  [scope %s]" % (lic.form, lic.predicate, lic.scope)))

# the incapable instrument must license a claim about ITS OUTPUT, never the world
lic = atts["F3' SCREEN-1 counterfactual"].licensed
if lic is None or lic.scope != "THIS_RUN" or "emitted" not in lic.predicate:
    fails.append("counterfactual downgrade did not reduce to an instrument-output claim")

print()
print("=== structural rule: no scalar cause anywhere ===")
banned = {"reason", "cause", "root_cause", "primary"}
found = set()
for cls in (EntitlementAttempt, GateFinding, Claim, Evidence):
    for f in dataclasses.fields(cls):
        if f.name in banned:
            found.add("%s.%s" % (cls.__name__, f.name))
print("   banned fields present: %s" % (sorted(found) or "none"))
if found:
    fails.append("scalar cause field present: %s" % sorted(found))

print()
print("=== ablation: is each gate non-redundant? ===")
ABLATE = {"O": ("F1 StageB case3", gate_obligation),
          "D": ("F2 REACH-1 get_path", gate_derivation),
          "M": ("F3 SCREEN-1 as stated", gate_measurement)}
for g, (case, _) in ABLATE.items():
    claim, ev, _ = CASES[case]
    a = attempt(claim, ev)
    others = [v for k, v in zip("ODM", a.vector()) if k != g]
    admitted_without_g = all(others)
    print("   remove %s -> %-28s would be ADMITTED: %s" % (g, case[:28], admitted_without_g))
    if not admitted_without_g:
        fails.append("gate %s appears redundant: %s still refused without it" % (g, case))

print()
print("=== architecture's own falsifier ===")
print("   candidate_missing_gate(F4, known_wrong=False) = %s"
      % candidate_missing_gate(atts["F4 REACH-1 R2"], False))
print("   candidate_missing_gate(F4, known_wrong=True)  = %s"
      % candidate_missing_gate(atts["F4 REACH-1 R2"], True))
if not candidate_missing_gate(atts["F4 REACH-1 R2"], True):
    fails.append("falsifier does not fire on a wrong conclusion passing all gates")

print()
if fails:
    print("CONFORMANCE FAILED (%d)" % len(fails))
    for f in fails:
        print("   - %s" % f)
    sys.exit(1)
print("CONFORMANCE PASSED - %d cases, matrix + downgrades + structure + ablation + falsifier"
      % len(CASES))
