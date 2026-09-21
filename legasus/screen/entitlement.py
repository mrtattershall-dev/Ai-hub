"""Currently demonstrated entitlement gates.

    Entitled(C)  =>  O(C) AND D(C) AND M(C)

The converse is NOT earned. Passing all three is a necessary condition on this
branch's evidence, never a sufficient one.

Three design rules, each from a demonstrated failure:

  1. The gates are PEERS. None owns or reinterprets another's internals.
  2. The gate vector is NEVER collapsed into a causal diagnosis. A single failure
     can trip two gates (H-ORTHO's SCREEN-1 counterfactual and richness case), so
     "which gate failed" does not identify a cause. There is deliberately no
     `reason` or `cause` field anywhere in this module.
  3. A refused claim returns the STRONGEST claim the evidence does license, not
     just a refusal. Blocking without a downgrade forces the reasoning engine to
     rediscover the missing connection.
"""
from dataclasses import dataclass, field
from typing import Optional

# ---------------------------------------------------------------- claim algebra
SCOPE_ORDER = ["THIS_RUN", "SAMPLE", "FUNCTION_PARAMETER", "FUNCTION",
               "MODULE", "PROGRAM", "REPOSITORY", "WORLD"]

UNIVERSAL_FORMS = {"UNIVERSAL", "ABSENCE"}


def scope_rank(s):
    return SCOPE_ORDER.index(s) if s in SCOPE_ORDER else len(SCOPE_ORDER)


@dataclass(frozen=True)
class Claim:
    form: str                  # EXISTENTIAL | UNIVERSAL | ABSENCE | DISTINCTION | IDENTITY
    predicate: str
    scope: str
    run: Optional[str] = None


@dataclass
class Evidence:
    """Fields are partitioned by which gate may read them. No gate reads another's."""
    # --- obligation namespace ---
    evidence_scope: str = "THIS_RUN"
    domain_stated: bool = False
    domain_size: Optional[int] = None
    examined: Optional[int] = None
    # --- derivation namespace ---
    supporting_derivations: list = field(default_factory=list)   # {premises_decidable, premises_settled}
    # --- measurement namespace ---
    positive_control_fired: bool = False
    instrument: str = "unnamed instrument"


@dataclass
class GateFinding:
    passed: bool
    detail: str


@dataclass
class EntitlementAttempt:
    claim: Claim
    obligation: GateFinding
    derivation: GateFinding
    measurement: GateFinding
    licensed: Optional[Claim]        # strongest claim the evidence does license

    @property
    def entitled(self):
        return self.obligation.passed and self.derivation.passed and self.measurement.passed

    def vector(self):
        return (self.obligation.passed, self.derivation.passed, self.measurement.passed)


# ------------------------------------------------------------------- the gates
def gate_obligation(claim, ev):
    """Reads the claim and the obligation namespace ONLY.

    Evaluates the requested semantic jump, not the evidence-generating event.
    SCREEN-1 is the demonstration: identical measurement, different claim,
    different verdict.
    """
    if scope_rank(claim.scope) > scope_rank(ev.evidence_scope):
        return GateFinding(False, "claimed scope %s exceeds evidence scope %s"
                           % (claim.scope, ev.evidence_scope))
    if claim.form in UNIVERSAL_FORMS:
        if not ev.domain_stated:
            return GateFinding(False, "%s claim without a stated domain" % claim.form)
        if ev.domain_size is None or ev.examined is None:
            return GateFinding(False, "%s claim without stated coverage" % claim.form)
        if ev.examined < ev.domain_size:
            return GateFinding(False, "%s claim over %d of %d domain members"
                               % (claim.form, ev.examined, ev.domain_size))
    return GateFinding(True, "evidence topology licenses the claim as stated")


def gate_derivation(claim, ev):
    """Reads the derivation namespace ONLY.

    Entitlement is a property of a derivation, not of the closure: one settled
    supporting derivation suffices even if another branch has an open premise.
    (H-CLOSURE: two of three open-frontier cases were over-determined.)
    """
    ok = [d for d in ev.supporting_derivations
          if d.get("premises_decidable") and d.get("premises_settled")]
    if not ok:
        return GateFinding(False, "no supporting derivation with settled, decidable premises")
    return GateFinding(True, "%d supporting derivation(s) settled" % len(ok))


def gate_measurement(claim, ev):
    """Reads the measurement namespace ONLY."""
    if not ev.positive_control_fired:
        return GateFinding(False, "%s has not demonstrated capability for this observation"
                           % ev.instrument)
    return GateFinding(True, "positive control fired for %s" % ev.instrument)


# ------------------------------------------------------- downward compilation
def strongest_licensed(claim, ev, o, d, m):
    """The strongest claim the current evidence DOES license.

    This is the part that makes refusal useful: it tells the reasoning engine
    exactly how far reality currently permits it to go, so the remaining
    obligation is visible rather than rediscovered.
    """
    if not m.passed:
        # An incapable instrument licenses a claim about its OUTPUT, never about
        # the world. This is the SCREEN-1 lesson in one line.
        return Claim(form="OBSERVATIONAL",
                     predicate="%s emitted this result" % ev.instrument,
                     scope="THIS_RUN", run=claim.run)
    if not d.passed:
        # Nothing about the subject is licensed; the open premise is the frontier.
        return None
    if not o.passed:
        narrowed_scope = ev.evidence_scope
        if claim.form in UNIVERSAL_FORMS:
            return Claim(form="OBSERVATIONAL_NEGATIVE",
                         predicate="no %s was observed" % claim.predicate,
                         scope=narrowed_scope, run=claim.run)
        return Claim(form=claim.form, predicate=claim.predicate,
                     scope=narrowed_scope, run=claim.run)
    return claim


def attempt(claim, ev):
    o = gate_obligation(claim, ev)
    d = gate_derivation(claim, ev)
    m = gate_measurement(claim, ev)
    return EntitlementAttempt(claim, o, d, m, strongest_licensed(claim, ev, o, d, m))


# ------------------------------------------------- the architecture's own falsifier
def candidate_missing_gate(att, known_wrong):
    """wrong conclusion AND all gates pass  ->  a gate is missing.

    The architecture carries its own falsification condition rather than having
    new dimensions invented for it.
    """
    return bool(known_wrong and att.entitled)
