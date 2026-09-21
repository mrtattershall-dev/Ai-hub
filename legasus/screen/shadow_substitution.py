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


KNOWN_DOMAINS = [dom(n) for n in list(CONTAINMENT) + ["REPOSITORY"]]


def run_floor(ev):
    """Always licensed: a direct observation of what the instrument emitted.

    About the RUN, not the subject. Never a version of the request, never
    compared against subject-level claims. Satisfies no-silent-drop by being
    present at every step regardless of the gate vector.
    """
    return O.Claim2(dom("THIS_RUN"), O.POINTWISE, "%s emitted this result" % ev.instrument)


def new_attempt(claim, ev):
    """Returns (o, d, m, subject_claim, requested2, floor).

    subject_claim is the strongest RESTRICTION of the request the evidence
    discharges, or None. It is None whenever M or D fails: an incapable
    instrument or an open premise licenses nothing about the subject.
    """
    o, c2, ext = new_gate_obligation(claim, ev)
    d = gate_derivation(claim, ev)
    m = gate_measurement(claim, ev)
    if not m.passed or not d.passed:
        subject = None
    elif not o.passed:
        subject, _ = O.strongest_licensed(c2, ext, KNOWN_DOMAINS)
    else:
        subject = c2
    return o, d, m, subject, c2, run_floor(ev)


def not_licensed_by(requested, emitted):
    """R-1 / A8: an emitted subject claim must be licensed by its request."""
    if emitted is None:
        return False
    return O.compare(requested, emitted) != O.LICENSES


def weaker_or_equal(prev, cur):
    """A5 monotonicity on SUBJECT claims only, by the model's own compare().

    No rank, no special cases. Authority(E_{n+1}) subset-of Authority(E_n):
    once nothing is licensed nothing may reappear; otherwise the earlier claim
    must license the later, or they are the same claim.
    """
    if prev is None:
        return cur is None
    if cur is None:
        return True
    return prev == cur or O.compare(prev, cur) == O.LICENSES


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
        o, d, m, lic2, req2, floor = new_attempt(claim, ev)
        newvec = (o.passed, d.passed, m.passed)
        s = lambda v: "".join("P" if x else "F" for x in v)
        print("%-30s %-10s %-10s %-28s floor=%s" % (name[:30], s(old.vector()), s(newvec),
                                                     fmt(lic2), floor is not None))
        # W-4 carried into the substitution: the run floor is never absent
        if floor is None:
            fails.append("W-4 %s: run floor absent" % name)
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
        # A8 / R-1: anything emitted as a version of the request must be LICENSED by it
        if not_licensed_by(req2, lic2):
            fails.append("A8/R-1 on %s: emitted %s is not licensed by requested %s (%s)"
                         % (name, fmt(lic2), fmt(req2), O.compare(req2, lic2)))

    # ---- A4/A5 degradation chain, measured by compare(), no rank ----
    print("\nA4/A5  degradation chain under the NEW compiler (measured by compare(), no rank)")
    prev_lic, outputs = None, []
    for i, (name, claim, ev) in enumerate(degradation_chain()):
        o, d, m, lic2, req2, floor = new_attempt(claim, ev)
        s = "".join("P" if x else "F" for x in (o.passed, d.passed, m.passed))
        print("   %-34s vector=%s  subject=%-22s floor=%s" % (name, s, fmt(lic2), floor is not None))
        if floor is None:
            fails.append("W-4 %s: run floor absent" % name)
        if i > 0 and not weaker_or_equal(prev_lic, lic2):
            fails.append("A5 VIOLATION: %s is not weaker-or-equal to the previous step" % name)
        if not_licensed_by(req2, lic2):
            fails.append("A8/R-1 on %s: %s not licensed by %s" % (name, fmt(lic2), fmt(req2)))
        outputs.append(lic2)
        prev_lic = lic2
    # A4 / R-3: E1 is live iff the licensed OUTPUT changed between E0 and E1
    if fmt(outputs[0]) == fmt(outputs[1]):
        fails.append("A4 E1 is STILL INERT: %s -> %s" % (fmt(outputs[0]), fmt(outputs[1])))
    else:
        print("   A4/R-3 E1 is live: %s -> %s" % (fmt(outputs[0]), fmt(outputs[1])))
    ranks = [(n, fmt(x)) for n, x in zip([c[0] for c in degradation_chain()], outputs)]

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
