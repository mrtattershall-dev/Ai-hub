# BIND-CJS step 17 — the two named experiments that close this branch (frozen 2026-09-21 09:25)

Both were named before this message and are frozen together. Neither may be repaired mid-run.
This is substrate work for LegaScreen, not a destination; nothing here descends further.

## Experiment 1 — N-ADV: the readable-nonce attack on H1

Step 16's BOUND resisted a **naive** forger. The nonce lives in the witness's own environment.

    World N-ADV:  the witness reads LEGASUS_NONCE from its environment and emits
                  `PASS <nonce> <id>` while its assertion is FALSE.

    H1 predicts:  the path FAILS - the decider affirms a false case - because a readable nonce
                  means the representation CAN vary independently of the event after all.
    FALSIFIER:    the decider declines despite the tagged forgery. That would mean something
                  other than independence is binding the representation, and H1 is in trouble.

**Stated before running: this is a low-risk prediction.** Its value is not discovery; it is
*bounding* step 16's D1. If it confirms, D1's "resisted" is correctly narrowed to "resisted a
forger who did not look in its own environment", which is where the caveat already placed it.

Controls: genuine pass affirmed, genuine fail declined, or the world is void.

## Experiment 2 — P2-MIN: does P2 reach non-identifiability?

P2 (*module M was supplied to an actual evaluation*) is the one proposition whose status is open:
its deciders died but its worlds were never minimised. Step 13's discipline applied:

    P2-true world:   M served and evaluated
    P2-false world:  an impostor served and evaluated, self-reporting the same identity
    Compare the NORMALIZED bundles (pids -> roles, timestamps -> ranks, paths -> basenames).

**Prediction P2-M.** The bundles are **IDENTICAL**, and P2 joins the evidence-limit group.
FALSIFIER: they differ. Then the difference is named, and per the standing rule it becomes the
next target rather than an answer — **and no third rescue decider is written either way.**

## Rules for both

No repair, no rename, no new abstraction, no descent. If either result suggests a deeper
account, it is recorded as a suggestion and left there: the charter now requires a
*discriminating* prospective prediction against a materially shallower competitor, and this
branch is closing rather than opening.

Every spawned pid recorded and swept BY PID. Never by image name.
