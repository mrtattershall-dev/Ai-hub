"""Apply the frozen selection procedure. Reports what the producer ALREADY records.

Nothing here modifies the producer. It reads the existing obligation/extent record for the six
frozen cases and asks, per the frozen rule, which relation facts are already fully carried.
"""
import json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import obligation as O
from shadow_substitution import to_new
from entitlement_conformance import CASES
from certificate import TARGET_OF

# Fixed by the registry, not extended here.
REQUIRED_RELATIONS = ("MEMBERSHIP", "COVERAGE")


def relation_facts(name, claim, ev):
    """Relation facts the producer already records for this case. No fact is invented."""
    requested2, ext = to_new(claim, ev)
    out = []
    domain = requested2.domain.name
    repo = TARGET_OF.get(ev.instrument)
    for i, sd in enumerate(ev.supporting_derivations):
        subject = "%s:derivation%d:premise0" % (name.split()[0].replace("'", "p"), i)
        if ext.coverage_of.get(domain) == O.EXHAUSTIVE:
            out.append(dict(relation="COVERAGE", subject=subject, object=domain, domain=domain,
                            repository=repo,
                            recorded_by="obligation.coverage[%s] == EXHAUSTIVE" % domain))
        for o in ext.observed:
            if domain in o.membership_established_in:
                out.append(dict(relation="MEMBERSHIP", subject=subject, object=domain, domain=domain,
                                repository=repo,
                                recorded_by="extent.observed[].membership_established_in"))
                break
    return out


def qualifies(fact, ev):
    """The frozen criteria, checked against what is ALREADY there."""
    missing = []
    for k in ("relation", "subject", "object", "domain", "repository"):
        if not fact.get(k):
            missing.append(k)
    if not ev.positive_control_fired:
        missing.append("an observation carrying evidential force")
    return missing


if __name__ == "__main__":
    rows = []
    print("%-30s %-11s %-34s %s" % ("case", "relation", "domain", "qualifies"))
    for name, (claim, ev, _) in CASES.items():
        for fact in relation_facts(name, claim, ev):
            if fact["relation"] not in REQUIRED_RELATIONS:
                continue
            missing = qualifies(fact, ev)
            print("%-30s %-11s %-34s %s" % (name[:30], fact["relation"], fact["domain"],
                                            "yes" if not missing else "no: " + ", ".join(missing)))
            rows.append(dict(case=name, **fact, missing=missing))

    ok = [r for r in rows if not r["missing"]]
    print()
    if not ok:
        print("SELECTION RESULT: N8 - no relation fact qualifies. The experiment terminates here.")
    else:
        first = ok[0]
        print("SELECTION RESULT: first qualifying fact, in fixture order:")
        print("   case       %s" % first["case"])
        print("   relation   %s(%s, %s)" % (first["relation"], first["subject"], first["object"]))
        print("   repository %s" % first["repository"])
        print("   recorded   %s" % first["recorded_by"])
    json.dump(rows, open(sys.argv[1], "w", encoding="utf-8"), indent=2, default=str)
