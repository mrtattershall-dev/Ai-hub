"""H-NEUTRAL: does a NEUTRAL failure-coercion travel farther before detection?

Frozen against H-NEUTRAL_PREREG.md (ae9794b).

PREREGISTRATION DEFECT, found while building and resolved BEFORE measuring.
The prereg defines detection distance as "the first pipeline stage whose output
differs from the failure-free baseline". That phrase has two readings and I did
not pick one:

  ORACLE   baseline = the same run in which the failing operation SUCCEEDS and
           contributes its real value. Requires a counterfactual that, by
           construction, was never computed - the operation failed.
  OBSERVER baseline = the set of stage outputs producible by ANY failure-free
           execution. Detection = the observed output lies outside that set.

Both are measured and both are reported. Picking only the favourable one is the
apparatus failure this branch has committed six times. Note in advance that
ORACLE is expected to be flat (every coercion differs from a counterfactual that
contributed something), so if the asymmetry appears only under OBSERVER, the
honest statement is that it is observer-relative and NOT absolute.

Neutrality is computed algebraically, never assumed - see check_neutrality().
"""
import itertools, json, sys

INF = float("inf")


# ----------------------------------------------------------------- pipelines
def pipe_list(values):
    """stage1 partial after the failing item; stage2 aggregate; stage3 decision."""
    out = []
    s1 = None
    for i, v in enumerate(values):
        out.extend(v)
        if i == FAIL_IDX:
            s1 = tuple(out)
    return [s1, len(out), bool(out)]


def pipe_numeric(values):
    total = 0
    s1 = None
    for i, v in enumerate(values):
        total += v
        if i == FAIL_IDX:
            s1 = total
    return [s1, total, total > 100]


def pipe_conj(values):
    checks = []
    s1 = None
    for i, v in enumerate(values):
        checks.append(v)
        if i == FAIL_IDX:
            s1 = tuple(checks)
    return [s1, all(checks), "warn" if not all(checks) else "ok"]


def pipe_string(values):
    s = ""
    s1 = None
    for i, v in enumerate(values):
        s += v
        if i == FAIL_IDX:
            s1 = s
    return [s1, len(s), s.strip() != ""]


def pipe_index(values):
    """N3's second consumer: the SAME value, consumed by v[0] instead of extend."""
    out = []
    s1 = None
    for i, v in enumerate(values):
        out.append(v[0])          # raises IndexError on []
        if i == FAIL_IDX:
            s1 = tuple(out)
    return [s1, len(out), bool(out)]


FAIL_IDX = 1

PIPELINES = {
    "list":    dict(fn=pipe_list,    legit=[[], ["a"], ["b", "c"]], real=["b", "c"], filler=["a"],
                    op=lambda x, v: x + list(v), sample=[[], ["a"], ["b", "c"], ["z"]],
                    neutral=[], nonneutral=["__ERROR__"], indomain=["a"]),
    "numeric": dict(fn=pipe_numeric, legit=[0, 5, 40], real=40, filler=5,
                    op=lambda x, v: x + v, sample=[0, 5, 40, 7],
                    neutral=0, nonneutral=999999, indomain=5),
    "conj":    dict(fn=pipe_conj,    legit=[True, False], real=True, filler=True,
                    op=lambda x, v: x and v, sample=[True, False],
                    neutral=True, nonneutral=False, indomain=None),
    "string":  dict(fn=pipe_string,  legit=["", "a", "bc"], real="bc", filler="a",
                    op=lambda x, v: x + v, sample=["", "a", "bc", "z"],
                    neutral="", nonneutral="ERR", indomain="a"),
    "index":   dict(fn=pipe_index,   legit=[["a"], ["b", "c"]], real=["b", "c"], filler=["a"],
                    op=None, sample=None,
                    neutral=[], nonneutral=["__ERROR__"], indomain=None),
}


def check_neutrality(spec, value):
    """The tautology guard, executed: is `value` algebraically neutral for this op?

    Returns True/False/None(op not defined). Never consults any pipeline output.
    """
    op, sample = spec["op"], spec["sample"]
    if op is None:
        return None
    try:
        return all(op(x, value) == x for x in sample)
    except Exception:
        return False


def run(spec, values):
    try:
        return spec["fn"](values), None
    except Exception as e:
        return None, type(e).__name__


def producible(spec, n):
    """Stage-output sets reachable by ANY failure-free assignment of legitimate values."""
    sets = [set(), set(), set()]
    for combo in itertools.product(spec["legit"], repeat=n):
        outs, err = run(spec, list(combo))
        if err:
            continue
        for k in range(3):
            sets[k].add(repr(outs[k]))
    return sets


def distances(spec, coerced, n=3):
    """(oracle_distance, observer_distance, terminal_note)."""
    base_vals = [spec["filler"]] * n
    base_vals[FAIL_IDX] = spec["real"]
    base_out, base_err = run(spec, base_vals)

    fail_vals = list(base_vals)
    fail_vals[FAIL_IDX] = coerced
    fail_out, fail_err = run(spec, fail_vals)

    if fail_err:
        return 1, 1, "raised " + fail_err
    if base_err:
        return None, None, "baseline raised " + base_err

    oracle = INF
    for k in range(3):
        if repr(fail_out[k]) != repr(base_out[k]):
            oracle = k + 1
            break

    sets = producible(spec, n)
    observer = INF
    for k in range(3):
        if repr(fail_out[k]) not in sets[k]:
            observer = k + 1
            break
    return oracle, observer, "no exception"


def responsive(spec, n=3):
    """Does the pipeline's output depend on the failing slot at all?

    A pipeline that ignores it would report INF for every arm and look like a
    clean H-NEUTRAL confirmation while testing nothing. Asserted, not assumed.
    """
    seen = set()
    for v in spec["legit"]:
        vals = [spec["filler"]] * n
        vals[FAIL_IDX] = v
        outs, err = run(spec, vals)
        seen.add(err if err else repr(outs))
    return len(seen) > 1


def main(out_path):
    rows = []
    for name, spec in PIPELINES.items():
        assert responsive(spec), "pipeline %s ignores the failing slot" % name
        for arm, key in (("neutral", "neutral"), ("non-neutral", "nonneutral"),
                         ("exploratory-in-domain", "indomain")):
            v = spec[key]
            if v is None:
                continue
            neu = check_neutrality(spec, v)
            o, ob, note = distances(spec, v)
            rows.append(dict(pipeline=name, arm=arm, value=repr(v),
                             algebraically_neutral=neu,
                             coercion_equals_success=(repr(v) == repr(spec["real"])),
                             oracle_distance=(None if o is None else (o if o != INF else "INF")),
                             observer_distance=(None if ob is None else (ob if ob != INF else "INF")),
                             note=note))

    # ---- tautology guard: the frozen labels must match the COMPUTED algebra ----
    for r in rows:
        if r["arm"] == "neutral" and r["algebraically_neutral"] is not None:
            assert r["algebraically_neutral"] is True, \
                "prereg labelled %s/%s neutral but the algebra says otherwise" % (r["pipeline"], r["value"])
        if r["arm"] == "non-neutral" and r["algebraically_neutral"] is not None:
            assert r["algebraically_neutral"] is False, \
                "prereg labelled %s/%s non-neutral but it IS neutral" % (r["pipeline"], r["value"])

    json.dump(rows, open(out_path, "w", encoding="utf-8"), indent=2)
    hdr = "%-9s %-22s %-13s %-9s %-9s %-9s %s"
    print(hdr % ("pipeline", "arm", "value", "neutral?", "oracle", "observer", "note"))
    for r in rows:
        print(hdr % (r["pipeline"], r["arm"], r["value"][:13], str(r["algebraically_neutral"]),
                     str(r["oracle_distance"]), str(r["observer_distance"]), r["note"]))
    return rows


if __name__ == "__main__":
    main(sys.argv[1])
