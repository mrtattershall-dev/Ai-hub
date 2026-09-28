# External applicability — E1..E6. Selection rule frozen 2026-09-21, BEFORE enumerating candidates.

## Why the rule is written first

The whole value of this experiment is that the obligation was **not chosen to fit**. So the
selection rule is frozen and committed before any candidate is enumerated, and the enumeration is
run mechanically afterwards and recorded whatever it produces.

## The selection rule, frozen

1. **Candidate tools.** A tool qualifies if and only if all hold:
   - it is **already installed and runnable** in this environment, without installing anything;
   - it was **not authored or modified** by me, by this project, or by the hub;
   - it emits a **per-item decision about source code** with a **machine-readable reason
     identifier** (a rule name, code or id — not free prose);
   - it runs **offline** on a file supplied to it.
2. **Ordering.** Sort qualifying tools **alphabetically by the executable or package name invoked**.
3. **Selection.** Take the **first** tool in that order.
4. **The obligation.** From that tool, take the check identified by the **first rule identifier in
   the tool's own documented order** (its own listing, alphabetical if it publishes no other order)
   — not a check chosen by me for convenience.
5. **Ties or emptiness.** If nothing qualifies, that is the result and is recorded as such; the
   experiment does not relax the rule to find a candidate.

**No step of this rule may be revised after the enumeration is run.** If the rule turns out to pick
something awkward, the awkwardness is the finding.

## What gets measured

| arm | required observation |
|---|---|
| **E1** selection | the enumeration is run mechanically and its output recorded, whatever it selects |
| **E2** expressibility | can the **current registry** express the selected obligation **as it stands**? Answer recorded before any extension is attempted |
| **E3** development case | if an extension is necessary, it is developed on **exactly one** case |
| **E4** held-out evaluation | the extension is evaluated on **separate, untouched** cases that were not looked at during E3 |
| **E5** useful acceptance | at least one case the external verifier **accepts** and Legasus also licenses, with the reasons compared |
| **E6** justified refusal | at least one case the external verifier **rejects**, where Legasus's refusal is consequential and its reason is compared to the verifier's |

## What is recorded for every case

    the verifier's decision and its reason identifier
    Legasus's decision and its reason
    translation effort          what had to be written to get from one to the other
    human steering              every place I chose something the rule did not determine
    mismatches                  decisions that differ, in either direction
    unsupported                 cases the registry cannot express at all

## Explicitly separate from the existing result

**The 0/15 result stands untouched.** It is about fifteen *historical* declarations sampled from
this project's own past, and nothing here changes it. This experiment is reported **separately**, and
a success here must never be added to that denominator or presented as improving it.

## The bar, and what is not the bar

**The bar:** one independently checked external obligation handled correctly, including a legitimate
acceptance (E5) and a consequential refusal (E6).

**Not the bar:** finding an unknown live defect in someone else's code. That is a further milestone
and is not a prerequisite for learning whether the framework transfers.

## Predictions, committed now

- **E2: I expect the answer to be NO.** The registry has three rules, all about existential and
  universal claims over a sampled domain with coverage witnesses. An external verifier's obligation
  is unlikely to be one of those three, and saying so now stops a later extension being reported as
  though the registry already reached.
- I expect **translation effort and human steering to be the dominant costs**, and I expect to be
  tempted to steer. Every instance gets recorded.
- I expect **E6 to be harder than E5**: producing a refusal that is *consequential* rather than
  merely a failure to express something.

## Forbidden

No relaxing the selection rule after enumeration. No choosing a second tool because the first is
inconvenient. No editing the external tool. **S6, F2, `COMPLETE`, `INVALIDATE` and the 0/15 result
are untouched.** The extension, if any, is developed on one case and evaluated on cases not looked
at first.
