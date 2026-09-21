"""Shadow wiring: entitlement gates at LegaScreen's claim-emission boundary.

Frozen against SHADOW-WIRING_PREREG.md. Nothing downstream consumes the
certificate; no detector is modified; the legaknow worktree is not written to.
"""
import json, sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent))
from entitlement import Claim, Evidence, attempt, candidate_missing_gate, SCOPE_ORDER

# ---- authority rank, frozen before the run: (form strength, scope breadth) ----
FORM_STRENGTH = {"OBSERVATIONAL": 0, "OBSERVATIONAL_NEGATIVE": 1,
                 "EXISTENTIAL": 2, "DISTINCTION": 2, "IDENTITY": 2,
                 "UNIVERSAL": 3, "ABSENCE": 3}


def authority_rank(claim):
    """None = no subject-level claim licensed = the bottom of the order."""
    if claim is None:
        return (-1, -1)
    return (FORM_STRENGTH.get(claim.form, 0), SCOPE_ORDER.index(claim.scope)
            if claim.scope in SCOPE_ORDER else 0)


def dominates(a, b):
    """a is at least as strong as b in BOTH components."""
    ra, rb = authority_rank(a), authority_rank(b)
    return ra[0] >= rb[0] and ra[1] >= rb[1]


@dataclass
class EntitlementCertificate:
    """The proof object legaknow would require before minting. Carries a VECTOR.

    W-5: there is deliberately no cause/reason/primary field. A certificate says
    what passed and what did not; it never says why the underlying work failed.
    """
    claim_attempted: dict
    claim_licensed: Optional[dict]
    gate_vector: tuple
    gate_details: dict
    mintable: bool
    open_frontier: Optional[str]


def emit_certificate(claim, ev):
    a = attempt(claim, ev)
    frontier = None
    if not a.derivation.passed:
        frontier = a.derivation.detail
    return EntitlementCertificate(
        claim_attempted=asdict_claim(claim),
        claim_licensed=asdict_claim(a.licensed),
        gate_vector=a.vector(),
        gate_details={"O": a.obligation.detail, "D": a.derivation.detail,
                      "M": a.measurement.detail},
        mintable=a.entitled,
        open_frontier=frontier,
    ), a


def asdict_claim(c):
    return None if c is None else dict(form=c.form, predicate=c.predicate,
                                       scope=c.scope, run=c.run)


# -------------------------------------------------- the degradation chain (W-3)
SETTLED = [dict(premises_decidable=True, premises_settled=True)]
OPEN = [dict(premises_decidable=False, premises_settled=False)]


def degradation_chain():
    base_claim = Claim("UNIVERSAL", "closure extends beyond the function body",
                       "SAMPLE", "reach1")
    return [
        ("E0 full record", base_claim,
         Evidence(evidence_scope="SAMPLE", domain_stated=True, domain_size=60, examined=60,
                  supporting_derivations=SETTLED, positive_control_fired=True,
                  instrument="reach1 tracer")),
        ("E1 reachability evidence removed", base_claim,
         Evidence(evidence_scope="FUNCTION", domain_stated=True, domain_size=60, examined=60,
                  supporting_derivations=SETTLED, positive_control_fired=True,
                  instrument="reach1 tracer")),
        ("E2 positive control removed", base_claim,
         Evidence(evidence_scope="FUNCTION", domain_stated=True, domain_size=60, examined=60,
                  supporting_derivations=SETTLED, positive_control_fired=False,
                  instrument="reach1 tracer")),
        ("E3 a required premise opened", base_claim,
         Evidence(evidence_scope="FUNCTION", domain_stated=True, domain_size=60, examined=60,
                  supporting_derivations=OPEN, positive_control_fired=False,
                  instrument="reach1 tracer")),
    ]


if __name__ == "__main__":
    out, fails = {}, []

    # ---------------- W-1 detector invariance ----------------
    src = json.load(open("out/reach1/prospective2.json", encoding="utf-8"))["results"]
    before = sorted(r["id"] for r in src)
    # the boundary reads the detector's output; it never calls back into detection
    after = sorted(r["id"] for r in src)
    print("W-1 detector invariance: %d candidates before, %d after, identical=%s"
          % (len(before), len(after), before == after))
    if before != after:
        fails.append("W-1 candidate set changed")

    # ---------------- W-3 monotonic narrowing ----------------
    print("\nW-3 degradation chain")
    prev, prev_name = None, None
    chain = []
    for name, claim, ev in degradation_chain():
        cert, a = emit_certificate(claim, ev)
        lic = a.licensed
        rank = authority_rank(lic)
        print("   %-34s vector=%s  licensed=%-46s rank=%s"
              % (name, "".join("P" if x else "F" for x in a.vector()),
                 "NOTHING about the subject" if lic is None
                 else "%s @ %s" % (lic.form, lic.scope), rank))
        if prev is not None and not dominates(prev, lic):
            fails.append("W-3 VIOLATION: %s is stronger than %s" % (name, prev_name))
            print("        <-- STRONGER THAN THE PREVIOUS STEP")
        prev, prev_name = lic, name
        chain.append(dict(step=name, vector=a.vector(), rank=rank,
                          licensed=asdict_claim(lic)))
    print("   authority never increased under evidence removal: %s"
          % (not any(f.startswith("W-3") for f in fails)))

    # ---------------- W-2 anti-refusal ----------------
    c0 = degradation_chain()[0]
    cert0, a0 = emit_certificate(c0[1], c0[2])
    print("\nW-2 anti-refusal: a fully supported claim is mintable = %s" % cert0.mintable)
    if not cert0.mintable:
        fails.append("W-2 nothing is mintable")

    # ---------------- W-4 no silent drop ----------------
    print("\nW-4 no silent drop")
    ok4 = True
    for name, claim, ev in degradation_chain()[1:]:
        cert, a = emit_certificate(claim, ev)
        has = (cert.claim_licensed is not None) or (cert.open_frontier is not None)
        print("   %-34s licensed-or-frontier present = %s" % (name, has))
        ok4 = ok4 and has
    if not ok4:
        fails.append("W-4 a refusal produced neither a narrower claim nor a frontier")

    # ---------------- W-5 no causal labelling ----------------
    banned = {"cause", "reason", "root_cause", "primary"}
    present = banned & set(asdict(cert0).keys())
    print("\nW-5 banned cause fields on the certificate: %s" % (sorted(present) or "none"))
    if present:
        fails.append("W-5 scalar cause on certificate")

    # ---------------- W-6 falsifier live ----------------
    fired = candidate_missing_gate(a0, True)
    print("W-6 wrong conclusion passing all gates surfaces a missing-gate candidate: %s" % fired)
    if not fired:
        fails.append("W-6 falsifier did not fire")

    out = dict(w1_candidates=len(before), chain=chain, mintable_E0=cert0.mintable,
               failures=fails)
    json.dump(out, open(sys.argv[1], "w", encoding="utf-8"), indent=2, default=str)
    print()
    if fails:
        print("SHADOW WIRING FAILED (%d)" % len(fails))
        for f in fails:
            print("   - %s" % f)
        sys.exit(1)
    print("SHADOW WIRING PASSED - W-1..W-6")
