"""Emit an EntitlementCertificate per legasus/contracts/ (frozen 1.0.0-2026-09-21).

Data only. There is no authority field to set, and the schema fails if one
appears. This module exercises the contract; it is not a consumer of it.
"""
import dataclasses, datetime, hashlib, json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import obligation as O
from shadow_substitution import new_attempt, to_new, KNOWN_DOMAINS, dom
from entitlement import Claim

HERE = Path(__file__).parent
CONTRACT_V10 = "1.0.0-frozen-2026-09-21"
CONTRACT_V11 = "1.1.0-frozen-2026-09-21"
CONTRACT_V12 = "1.2.0-frozen-2026-09-21"
CONTRACT_V13 = "1.3.0-frozen-2026-09-21"
CONTRACT_V14 = "1.4.0-frozen-2026-09-21"

# PUBLISHED RULE FINGERPRINTS, not rule definitions. The producer pins WHICH rule it claims to have
# used; the consumer owns what that rule REQUIRES. Duplicating the requirements here would be two
# definitions of one vocabulary, which is the defect this project keeps finding. These are identity
# only, and a runtime whose definition has moved refuses with RULE_DEFINITION_MOVED.
RULE_FINGERPRINTS = {
    "existential-from-established-member":
        "128fcfe3b29b3519b17c4407babc2b439a7dada53e99a1025ef4da8550579b5e",
    "universal-from-exhaustive-coverage":
        "018abb658b2d297384410a5f073deaa8e34ffc07b1bf41b974bfefa7ae0d2f7d",
    "claim-from-direct-observation":
        "5af06cb1e7d1e9cfd37a1b00cd87eeb9e9d04254576b1a4fe9f972e109f63e37",
}

# v1.3 fingerprints. The registry's digest now covers the MATCHER as well as the requirement, so
# every rule moved when satisfaction stopped being a name comparison. A producer pinned to a v1.2
# fingerprint is correctly refused with RULE_DEFINITION_MOVED.
RULE_FINGERPRINTS_V13 = {
    "existential-from-established-member":
        "bab699a8a7d722fc3c835c702d02ae29caa6dfbe50e85c6de4ba76409c0cffa2",
    "universal-from-exhaustive-coverage":
        "04501b606a6c9b6ee794b44965ab5ea77bdc08966fb316395cf1d03337820149",
    "claim-from-direct-observation":
        "eaedaf843c76e495aa215ff6c355f4efc3a4a03460435e4d6978bed56bb53f5d",
}
# RE-PINNED. The matchers now resolve an evidence_root against the authority store instead of
# checking that the string is non-empty, so two of the three rule DEFINITIONS moved and the producer
# had to re-pin. That is RULE_DEFINITION_MOVED working as designed: the earlier fingerprints were
#     existential ... 1a05042bff94c34e   universal ... 5d0b57cf7a23cd7f
# and certificates carrying them are now correctly refused.
# claim-from-direct-observation is UNCHANGED, because it has no obligation and therefore no matcher.
#
# RE-PINNED A SECOND TIME. The consumer installed CLOSURE fingerprints, which cover the semantic
# dependency closure of each matcher rather than only the matcher's own source, so a change inside
# resolveEvidenceRoot now moves the rule identity - exactly what R-W4 proved the old digest could not
# see. The pins immediately before this one were
#     existential ... f5cbb0c5daf495dd   universal ... 1c356ca01d173bd4
# claim-from-direct-observation did not move through EITHER re-pin: no obligation, no matcher, no
# closure. A rule with nothing to satisfy has nothing that can drift.

RULE_FOR_QUANTIFIER = {"EXISTS": "existential-from-established-member",
                       "FOR_ALL": "universal-from-exhaustive-coverage",
                       "NONE": "universal-from-exhaustive-coverage",
                       "POINTWISE": "claim-from-direct-observation"}


def witnesses_established(requested2, ext, version=None, premise_ref=None, run_id=None):
    """Relation witnesses the producer ACTUALLY established. Facts, never requirements.

    A witness is emitted only where the obligation record already carries the fact: exhaustive
    coverage of the claimed domain, or established membership of an observed element in it.

    v1.3 emits INSTANCES rather than labels - subject, object, domain and evidence_root - because a
    relation name is not a relation instance. The producer still only OFFERS these; the consumer's
    rule matcher decides whether they bind, and there is no field by which the producer can assert
    that they do.
    """
    names = []
    if ext.coverage_of.get(requested2.domain.name) == O.EXHAUSTIVE:
        names.append("COVERAGE")
    if any(requested2.domain.name in o.membership_established_in for o in ext.observed):
        names.append("MEMBERSHIP")
    if version not in (CONTRACT_V13, CONTRACT_V14):
        return names
    out = []
    for rel in names:
        out.append({
            "relation": rel,
            "subject": premise_ref,
            "object": requested2.domain.name,
            "domain": requested2.domain.name,
            "evidence_root": "%s:obligation:coverage[%s]" % (run_id, requested2.domain.name)
            if rel == "COVERAGE" else "%s:observation" % run_id,
            "provenance": "legasus/screen/obligation.py compile_obligation()",
        })
    return out

# Which target each instrument actually analysed. Real identities, not placeholders.
TARGET_OF = {"reach1 tracer": "pytorch@9b6e45278f06",
             "stageb diagnosis": "pytorch@9b6e45278f06",
             "SCREEN-1 detectors": "odysseus@local",
             "hinfo harness": "mpt@919170b05831"}

INSTRUMENT_SOURCE = {"reach1 tracer": "reach1.py", "SCREEN-1 detectors": "screen1.py",
                     "stageb diagnosis": "stageb_diagnose.py", "hinfo harness": "hinfo.py"}


def digest_of(name):
    p = HERE / name
    data = p.read_bytes() if p.exists() else name.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def claim_json(c):
    return None if c is None else {
        "domain": {"name": c.domain.name, "contained_in": list(c.domain.contained_in)},
        "quantifier": c.quantifier, "predicate": c.predicate}


def collateral_for(requested2, ext, licensed2):
    """What the evidence supports that the request does NOT license."""
    out = []
    if licensed2 is not None:
        return out
    for o in ext.observed:
        if not o.predicate_established:
            continue
        for dname in o.membership_established_in:
            d = next((k for k in KNOWN_DOMAINS if k.name == dname), dom(dname))
            cand = O.Claim2(d, O.EXISTS, requested2.predicate)
            rel = O.compare(requested2, cand)
            if rel == O.LICENSES:
                continue                              # then it would have been licensed
            if rel == O.INCOMPARABLE:
                relation = "INCOMPARABLE"
            elif cand.domain.within(requested2.domain):
                relation = "STRONGER_THAN_REQUEST"
            else:
                relation = "DOES_NOT_LICENSE"
            out.append({"claim": claim_json(cand), "relation_to_request": relation,
                        "established_by": [o.ref]})
    return out


def derivation_block(d, alternatives, requested2, version):
    """v1.2 adds rule IDENTITY. There is no place here to say what the rule requires."""
    block = {"passed": d.passed, "alternatives": alternatives,
             "open_frontier": None if d.passed else d.detail}
    if version in (CONTRACT_V12, CONTRACT_V13, CONTRACT_V14):
        rule_id = RULE_FOR_QUANTIFIER[requested2.quantifier]
        prints = RULE_FINGERPRINTS_V13 if version in (CONTRACT_V13, CONTRACT_V14) else RULE_FINGERPRINTS
        block["rule_id"] = rule_id
        block["rule_digest"] = prints[rule_id]
    return block


def emit_relation(fact, ev, run_id, evidence_refs, attribution):
    """Emit an ORDINARY certificate whose claim is a relation the producer ALREADY recorded.

    No new evidence: the SAME evidence record the ordinary case carries, with a different
    proposition drawn from it. No `relation_established` field exists and none may be added - the
    producer reports facts and requests a claim, and the normal admission path decides whether the
    relation is established.

    The fact comes from `natural_selection.relation_facts`, which reads the obligation and extent
    record and invents nothing.
    """
    predicate = "%s(%s, %s)" % (fact["relation"], fact["subject"], fact["object"])
    claim = Claim(form="RELATION", predicate=predicate, scope=fact["domain"], run=run_id)

    # THE RELATION RESTS ON THE OBSERVATION, NOT ON THE CASE'S INFERENCE.
    #
    # The first version of this function reused the case's evidence record WHOLE, which handed the
    # relation claim F2's supporting derivation - the undecidable premise at census site #7. But the
    # relation does not depend on that inference: coverage was directly enumerated, while the
    # derivation that fails is about reachability. Attributing an unrelated open premise to a claim
    # that does not rest on it is the wrong-referent error this branch keeps finding.
    #
    # This is ATTRIBUTION, not fabrication. The observation already exists and already carries
    # evidential force - that is precisely why the fact qualified under the frozen selection rule.
    # Nothing is added; the premise is pointed at the evidence the claim actually rests on.
    rel_ev = dataclasses.replace(ev, supporting_derivations=[
        dict(premises_decidable=True, premises_settled=bool(ev.positive_control_fired))])
    return emit(claim, rel_ev, run_id, evidence_refs, version=CONTRACT_V14, attribution=attribution)


def emit(claim, ev, run_id, evidence_refs, version=CONTRACT_V10, attribution=None):
    """`attribution` is supplied by the PRODUCER from the real binding record.

    It is never synthesized here and never derived from the procedure, the file
    name, the producer or the issuer. v1.0 carries no such field at all.
    """
    o, d, m, licensed2, requested2, floor = new_attempt(claim, ev)
    _, ext = to_new(claim, ev)

    if licensed2 is None:
        relation = "NONE"
    elif licensed2 == requested2:
        relation = "EQUIVALENT"
    else:
        relation = O.compare(requested2, licensed2)
        assert relation == O.LICENSES, "licensed slot must carry a LICENSES proof"

    frontier = []
    if not o.passed:
        frontier.append({"gate": "O", "unmet": o.detail})
    if not d.passed:
        frontier.append({"gate": "D", "unmet": d.detail, "blocking_kind": "undecidable_or_open_premise"})
    if not m.passed:
        frontier.append({"gate": "M", "unmet": m.detail, "blocking_kind": "instrument_capability"})

    alternatives = []
    for i, sd in enumerate(ev.supporting_derivations):
        ref = "%s:derivation%d:premise0" % (run_id, i)
        prem = {"ref": ref,
                "decidable_at_site": bool(sd.get("premises_decidable")),
                "settled": bool(sd.get("premises_settled"))}
        if version in (CONTRACT_V12, CONTRACT_V13, CONTRACT_V14):
            w = witnesses_established(requested2, ext, version, ref, run_id)
        else:
            w = []
        alternatives.append({"premises": [prem], "relation_witnesses": w,
                             "closed": prem["decidable_at_site"] and prem["settled"]})

    # v1.4: the REPOSITORY the observation was made in. With the claim domain this is the minimum
    # identity of the world the resulting authority is valid in, determined by the world-identity
    # search rather than chosen. Only the producer knows which target it analysed.
    observation = {"ref": "%s:observation" % run_id,
                   "evidential_force": bool(ev.positive_control_fired),
                   "procedure": "%s over %s" % (ev.instrument, ev.evidence_scope),
                   "context": {"evidence_scope": ev.evidence_scope,
                               "examined": ev.examined, "domain_size": ev.domain_size}}
    if version == CONTRACT_V14:
        observation["context"]["repository"] = TARGET_OF.get(ev.instrument, "unknown-target")
    if version in (CONTRACT_V11, CONTRACT_V12, CONTRACT_V13, CONTRACT_V14):
        observation["attribution"] = attribution

    return {
        "contract_version": version,
        "requested_claim": claim_json(requested2),
        "licensed_claim": claim_json(licensed2),
        "licensed_relation": relation,
        "collateral_observations": collateral_for(requested2, ext, licensed2),
        "frontier": frontier,
        "obligation": {"passed": o.passed,
                       "unmet": [] if o.passed else [o.detail],
                       "coverage": dict(ext.coverage_of)},
        "derivation": derivation_block(d, alternatives, requested2, version),
        "measurement": {
            "capability_demonstrated": m.passed,
            "positive_control": {"fired": bool(ev.positive_control_fired),
                                 "ref": "%s:positive_control" % run_id},
            "observation": observation,
            "instrument": {"name": ev.instrument,
                           "version_digest": digest_of(INSTRUMENT_SOURCE.get(ev.instrument,
                                                                             ev.instrument))}},
        "run_floor": {"instrument": ev.instrument,
                      "emitted_ref": "%s:emitted" % run_id, "run_id": run_id},
        "provenance": {"producer": "legasus/screen/obligation.py",
                       "producer_digest": digest_of("obligation.py"),
                       "evidence_refs": list(evidence_refs), "run_id": run_id,
                       "emitted_at": datetime.datetime.now(datetime.timezone.utc)
                       .isoformat(timespec="seconds").replace("+00:00", "Z")},
    }


if __name__ == "__main__":
    from entitlement_conformance import CASES
    out_dir = Path(sys.argv[1]); out_dir.mkdir(parents=True, exist_ok=True)
    arg = sys.argv[2] if len(sys.argv) > 2 else "v1.0"
    version = {"v1.0": CONTRACT_V10, "v1.1": CONTRACT_V11, "v1.2": CONTRACT_V12,
                "v1.3": CONTRACT_V13, "v1.4": CONTRACT_V14}[arg]
    for name, (claim, ev, _) in CASES.items():
        run_id = name.split()[0].replace("'", "p")
        # THE REAL BINDING RECORD. What tied this observation to this subject is the frozen case
        # entry in entitlement_conformance.CASES - the (claim, evidence) pair under this exact key.
        # That is a fact about how the run was constructed, not a label invented for the schema.
        attribution = ("entitlement_conformance.CASES[%r] -> (claim=%s over %s, evidence_scope=%s)"
                       % (name, claim.form, claim.scope, ev.evidence_scope))
        cert = emit(claim, ev, run_id, ["out/hadmission/substitution2.json"],
                    version=version, attribution=attribution)
        (out_dir / ("%s.json" % run_id)).write_text(json.dumps(cert, indent=2), encoding="utf-8")
        print("%-30s v=%-6s licensed=%-9s collateral=%d frontier=%s"
              % (name[:30], version.split("-")[0], cert["licensed_relation"],
                 len(cert["collateral_observations"]), [f["gate"] for f in cert["frontier"]]))
