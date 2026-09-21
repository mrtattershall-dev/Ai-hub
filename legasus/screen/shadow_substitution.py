"""Shadow substitution: the new obligation compiler in the shadow path only.

Frozen against SUBSTITUTION_PREREG.md. `entitlement.gate_obligation` is NOT
modified; it is read for comparison and left in place as the specimen.
"""
import json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import entitlement as E
import obligation as O
from entitlement import Claim, Evidence, gate_derivation, gate_measurement, GateFinding
from shadow_wiring import degradation_chain, SETTLED, OPEN

QMAP = {"ABSENCE": O.NONE, "UNIVERSAL": O.FOR_ALL, "EXISTENTIAL": O.EXISTS,
        "OBSERVATIONAL_NEGATIVE": O.EXISTS, "OBSERVATIONAL": O.POINTWISE,
        "DISTINCTION": O.POINTWISE, "IDENTITY": O.POINTWISE}

# domain containment, declared once: everything the branch reasons over sits in a repository
CONTAINMENT = {"FUNCTION": ("MODULE", "PROGRAM", "REPOSITORY"),
               "FUNCTION_PARAMETER": ("FUNCTION", "MODULE", "PROGRAM", "REPOSITORY"),
               "MODULE": ("PROGRAM", "REPOSITORY"),
               "PROGRAM": ("REPOSITORY",),
               "SAMPLE": ("REPOSITORY",),
               "THIS_RUN": ("SAMPLE", "REPOSITORY")}


def dom(name):
    return O.Domain(name, contained_in=CONTAINMENT.get(name, ()))


def to_new(claim, ev):
    """Frozen mapping from the old evidence record to the new claim/extent model."""
    q = QMAP.get(claim.form, O.POINTWISE)
    c2 = O.Claim2(dom(claim.scope), q, claim.predicate)
    exhaustive = (ev.evidence_scope == claim.scope
                  and ev.domain_stated and ev.domain_size is not None
                  and ev.examined is not None and ev.examined >= ev.domain_size)
    cov = {ev.evidence_scope: O.EXHAUSTIVE if (ev.domain_stated and ev.domain_size
                                               and ev.examined >= ev.domain_size) else O.PARTIAL}
    if claim.scope not in cov:
        cov[claim.scope] = O.EXHAUSTIVE if exhaustive else O.UNKNOWN
    obs = [O.Observation("obs", membership_established_in=(ev.evidence_scope,),
                         predicate_established=True)]
    return c2, O.Extent(observed=obs, coverage_of=cov)


def new_gate_obligation(claim, ev):
    c2, ext = to_new(claim, ev)
    res = O.compile_obligation(c2, ext)
    return GateFinding(res.passed, "; ".join(res.unmet) or "obligations discharged"), c2, ext


def new_attempt(claim, ev):
    o, c2, ext = new_gate_obligation(claim, ev)
    d = gate_derivation(claim, ev)
    m = gate_measurement(claim, ev)
    licensed2 = None
    if not m.passed:
        licensed2 = O.Claim2(dom("THIS_RUN"), O.POINTWISE,
                             "%s emitted this result" % ev.instrument)
    elif not d.passed:
        licensed2 = None
    elif not o.passed:
        licensed2, _ = O.strongest_licensed(c2, ext)
    else:
        licensed2 = c2
    return o, d, m, licensed2, c2


STRENGTH = {O.POINTWISE: 0, O.EXISTS: 1, O.FOR_ALL: 2, O.NONE: 2}


def is_upward(requested, emitted):
    """Is `emitted` strictly stronger than `requested`? A8's falsifier."""
    if emitted is None:
        return False
    if STRENGTH[emitted.quantifier] > STRENGTH[requested.quantifier]:
        return True
    # a domain strictly CONTAINING the requested one is upward
    if emitted.domain.name != requested.domain.name and requested.domain.within(emitted.domain):
        return True
    return False


if __name__ == "__main__":
    fails, report = [], {}
    fmt = lambda c: "NOTHING" if c is None else "%s over %s" % (c.quantifier, c.domain.name)

    # ---- A1 candidate generation ----
    src = json.load(open("out/reach1/prospective2.json", encoding="utf-8"))["results"]
    print("A1 candidates: %d (the substitution never calls back into detection)" % len(src))
    if len(src) != 60:
        fails.append("A1 candidate count changed")

    # ---- the six shadow cases, old vector vs new vector ----
    from entitlement_conformance import CASES
    print("\nA2/A3/A6  old vs new gate vectors")
    print("%-30s %-10s %-10s %s" % ("case", "old", "new", "licensed (new)"))
    for name, (claim, ev, expected) in CASES.items():
        old = E.attempt(claim, ev)
        o, d, m, lic2, req2 = new_attempt(claim, ev)
        newvec = (o.passed, d.passed, m.passed)
        s = lambda v: "".join("P" if x else "F" for x in v)
        print("%-30s %-10s %-10s %s" % (name[:30], s(old.vector()), s(newvec), fmt(lic2)))
        # A2: anything the old model minted must still be mintable
        if old.entitled and not all(newvec):
            fails.append("A2 %s was mintable and no longer is" % name)
        # A3: every old O failure must still be refused or narrowed
        if not old.obligation.passed and o.passed and lic2 is not None \
                and lic2.domain.name == claim.scope:
            fails.append("A3 %s old O failure is now licensed unchanged" % name)
        # A6: multi-gate cases keep complete vectors
        if name.startswith(("F3'", "F5")) and sum(1 for x in newvec if not x) < 2:
            fails.append("A6 %s lost a gate failure" % name)
        # A8: never emit something stronger than requested
        if is_upward(req2, lic2):
            fails.append("A8 UPWARD REFORMULATION on %s: %s -> %s"
                         % (name, fmt(req2), fmt(lic2)))

    # ---- A4/A5 degradation chain ----
    print("\nA4/A5  degradation chain under the NEW compiler")
    prev = None
    ranks = []
    for name, claim, ev in degradation_chain():
        o, d, m, lic2, req2 = new_attempt(claim, ev)
        s = "".join("P" if x else "F" for x in (o.passed, d.passed, m.passed))
        r = (STRENGTH[lic2.quantifier] if lic2 else -1,
             0 if lic2 is None else (1 if lic2.domain.name != "THIS_RUN" else 0))
        print("   %-34s vector=%s  licensed=%-32s rank=%s" % (name, s, fmt(lic2), r))
        if prev is not None and r > prev:
            fails.append("A5 VIOLATION: %s strengthened the claim" % name)
        if is_upward(req2, lic2):
            fails.append("A8 UPWARD on %s" % name)
        prev = r
        ranks.append((name, r))
    # A4: E1 must no longer be inert
    if ranks[0][1] == ranks[1][1]:
        fails.append("A4 E1 is STILL INERT under the new compiler")
    else:
        print("   A4 E1 is live: rank moved %s -> %s" % (ranks[0][1], ranks[1][1]))

    # ---- A7 falsifier ----
    c0 = degradation_chain()[0]
    old0 = E.attempt(c0[1], c0[2])
    print("\nA7 falsifier on a wrong all-pass conclusion: %s"
          % E.candidate_missing_gate(old0, True))
    if not E.candidate_missing_gate(old0, True):
        fails.append("A7 falsifier did not fire")

    print()
    json.dump(dict(failures=fails, ranks=[(n, list(r)) for n, r in ranks]),
              open(sys.argv[1], "w", encoding="utf-8"), indent=2)
    if fails:
        print("SUBSTITUTION FAILED (%d)" % len(fails))
        for f in fails:
            print("   - %s" % f)
        sys.exit(1)
    print("SUBSTITUTION PASSED - A1..A8")
