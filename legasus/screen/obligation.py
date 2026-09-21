"""Replacement obligation model: no scope rank.

Frozen against H-EXTENT_PREREG.md. The defective `entitlement.gate_obligation`
is left in place as a preserved specimen; this module does not modify it.

The obligation is compiled from

    claim domain  x  claim quantifier  x  observed extent  x  coverage evidence

A scalar rank cannot represent that, which is why there is none here.
"""
from dataclasses import dataclass, field
from typing import Optional

EXISTS, FOR_ALL, NONE, POINTWISE = "EXISTS", "FOR_ALL", "NONE", "POINTWISE"
PARTIAL, EXHAUSTIVE, UNKNOWN = "PARTIAL", "EXHAUSTIVE", "UNKNOWN"

LICENSES, DOES_NOT_LICENSE, INCOMPARABLE = "LICENSES", "DOES_NOT_LICENSE", "INCOMPARABLE"


@dataclass(frozen=True)
class Domain:
    name: str
    # domains form a containment relation, NOT an order by breadth
    contained_in: tuple = ()

    def within(self, other):
        return self.name == other.name or other.name in self.contained_in


@dataclass(frozen=True)
class Claim2:
    domain: Domain
    quantifier: str
    predicate: str


@dataclass
class Observation:
    ref: str
    membership_established_in: tuple = ()   # domains this element is PROVEN to belong to
    predicate_established: Optional[bool] = None


@dataclass
class Extent:
    observed: list = field(default_factory=list)
    coverage_of: dict = field(default_factory=dict)     # domain name -> PARTIAL/EXHAUSTIVE/UNKNOWN
    general_argument_for: tuple = ()                    # domain names covered by a general proof

    def coverage(self, domain):
        return self.coverage_of.get(domain.name, UNKNOWN)


@dataclass
class ObligationResult:
    passed: bool
    unmet: list


def compile_obligation(claim, ext):
    """Derive what is required, then check it. No ranks are consulted."""
    q, dom = claim.quantifier, claim.domain
    unmet = []

    if q in (EXISTS, POINTWISE):
        witnesses = [o for o in ext.observed
                     if o.predicate_established
                     and any(d == dom.name for d in o.membership_established_in)]
        if not witnesses:
            has_pred = any(o.predicate_established for o in ext.observed)
            if not has_pred:
                unmet.append("no observation with the predicate established")
            else:
                unmet.append("no observation with established membership in %s" % dom.name)
        return ObligationResult(not unmet, unmet)

    if q in (FOR_ALL, NONE):
        if dom.name in ext.general_argument_for:
            return ObligationResult(True, [])
        cov = ext.coverage(dom)
        if cov != EXHAUSTIVE:
            unmet.append("coverage of %s is %s, not EXHAUSTIVE" % (dom.name, cov))
        if q == FOR_ALL:
            bad = [o.ref for o in ext.observed if o.predicate_established is False]
            if bad:
                unmet.append("counterexamples observed: %s" % bad)
            if not ext.observed:
                unmet.append("no pointwise evidence")
        else:  # NONE
            found = [o.ref for o in ext.observed if o.predicate_established]
            if found:
                unmet.append("satisfying instances observed: %s" % found)
        return ObligationResult(not unmet, unmet)

    return ObligationResult(False, ["unknown quantifier %s" % q])


def compare(a, b):
    """Does claim `a` license claim `b`? Three-valued; there is no fallback order."""
    if not (a.domain.within(b.domain) or b.domain.within(a.domain)):
        return INCOMPARABLE
    if a.quantifier != b.quantifier:
        return INCOMPARABLE
    if a.quantifier == EXISTS:
        # a broader domain's existential does not license a narrower one's
        return LICENSES if b.domain.within(a.domain) and a.domain.name == b.domain.name \
            else (LICENSES if a.domain.within(b.domain) else DOES_NOT_LICENSE)
    if a.quantifier in (FOR_ALL, NONE):
        # a universal over a LARGER domain licenses one over a contained domain
        return LICENSES if b.domain.within(a.domain) else DOES_NOT_LICENSE
    return DOES_NOT_LICENSE


def strongest_licensed(claim, ext):
    """The strongest claim this extent licenses, derived - not tabulated."""
    res = compile_obligation(claim, ext)
    if res.passed:
        return claim, res
    if claim.quantifier == EXISTS:
        # fall back to the domain in which membership IS established
        for o in ext.observed:
            if not o.predicate_established:
                continue
            for dname in o.membership_established_in:
                return Claim2(Domain(dname), EXISTS, claim.predicate), res
        return None, res
    if claim.quantifier in (FOR_ALL, NONE):
        # fall back to a domain that IS exhaustively covered
        for dname, cov in ext.coverage_of.items():
            if cov == EXHAUSTIVE:
                cand = Claim2(Domain(dname), claim.quantifier, claim.predicate)
                if compile_obligation(cand, ext).passed:
                    return cand, res
        return None, res
    return None, res
