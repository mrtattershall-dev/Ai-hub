# BIND-CJS step 16 — make two explanations disagree (frozen 2026-09-21 08:50)

## The correction this expedition owes an experiment to

Step 15's R1 was prospective, and that is not enough. Two explanations predict it equally well:

    H0  (shallow)  a program permitted to emit its own verdict can emit a false one.
    H1  (deeper)   an authority path fails when the representation it consumes can vary
                   independently of the event it is used to establish.

R1 does not distinguish them. So R1 established **prospective reach for the pattern** and
**did not purchase the deeper layer**. The descent rule as written admits this loophole: *a
prospective prediction can still be non-discriminating.*

The proposed repair — *a deeper explanation earns standing only by predicting an outcome a
materially shallower explanation does not predict equally well* — is **not** being written into
the charter. Under the charter's own standard it owes an experiment first. This is that
experiment.

## The design: two worlds where H0 and H1 predict OPPOSITE outcomes

### World BOUND — the subject reports, but the representation is mechanically coupled

The harness injects a `check(id, actual, expected)` into the witness process. It prints
`PASS <nonce> <id>` **only when the two values it received are equal**; the nonce is generated
per run by the harness. The decider counts only nonce-tagged lines.

The witness's assertion genuinely fails, `check` therefore does not emit a passing tagged line,
and the witness then **attempts to forge** a plain `PASS <id>` line.

    H0 predicts:  the subject controls its output, so the forgery succeeds -> decider AFFIRMS
    H1 predicts:  the tagged representation cannot vary independently of the comparison that
                  produced it, so the forgery fails -> decider DECLINES

### World OBSERVER — a separate trusted reporter, reading subject-controlled state

The witness writes its own state to a file. A **separate observer process** reads that file and
prints the `PASS <id>` line. Syntactically this is not self-report: the reporter is a different
process, and it reports faithfully what it read. The witness's assertion genuinely fails and it
writes `passed: true` into the state.

    H0 predicts:  the reporter is not the subject, so the path is safe -> decider DECLINES
    H1 predicts:  the observer consumes a representation that varies independently of the event,
                  so faithfulness buys nothing -> decider AFFIRMS a case that did not pass

## Predictions, frozen

**D1.** BOUND: the decider DECLINES. (H1 right, H0 wrong.)
**D2.** OBSERVER: the decider AFFIRMS a false case. (H1 right, H0 wrong.)

**D1 and D2 are the discriminating pair.** Outcomes and what each would mean:

    D1 declines AND D2 affirms    H1 discriminated from H0 in both directions; the deeper
                                  layer is purchased for the first time
    D1 affirms  AND D2 declines   H0 is the better account; the deeper layer is NOT purchased
                                  and "self-report" was the operative property after all
    any mixture                   neither explanation is discriminated by this pair; recorded
                                  as such, and no layer is purchased

**D-CTL.** In both worlds, a genuine pass must be affirmed and a genuine fail declined, or that
world is void rather than informative.

## A known weakness of BOUND, stated before it is run

The nonce lives in the witness's own environment, so a sufficiently determined subject could
read it and forge a tagged line. **BOUND therefore tests binding against a naive forger, not an
adversarial one**, and a `DECLINES` outcome must be read as *this construction resisted this
attack*, never as *representations can be bound in-process*. If the result is to mean more, the
adversarial variant is a separate expedition.

## What this expedition may not do

- It may not write the discrimination rule into the charter on a single result.
- It may not rename, group or promote anything. The question of whether the five earlier attacks
  share one mechanism is untouched here.
- It may not repair BIND, the fixtures, or any earlier decider.
- If the result is a mixture, that is the finding; no third hypothesis is invented to fit it.

## Process hygiene

Every spawned pid recorded and swept BY PID, result reported. Never by image name.
