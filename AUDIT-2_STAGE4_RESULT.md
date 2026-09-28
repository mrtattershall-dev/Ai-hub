# AUDIT-2 stage 4 — accumulating obligations

**The preservation advantage the architecture was built for did not appear.**

Stage 4 exists to test the central Legasus proposition: that as software accumulates established
behaviour, a bounded editor disturbs it less than a generator that rewrites everything. That is the
claim this audit was supposed to be able to support. It did not.

## The curve

`P(the new requirement passes AND every prior requirement still passes)`, per generation, over four
filter pages. Obligations grow 3 → 6 → 7.

| generation | obligations carried | arm A — Legasus | arm B — direct |
|---|---|---|---|
| G1 · clear-filter control | 3 | **4 / 4** (9 calls) | **4 / 4** (4 calls) |
| G2 · reset key | 6 | **3 / 3** (6 calls) | **3 / 3** (3 calls) |
| G3 · match count | 7 | **0 / 3** — not attempted | **3 / 3** (3 calls) |

**Regressions produced: 0 for both arms at every generation. Nothing restored, because nothing broke.**

Arm B rewrote the entire page three times in succession, with seven accumulated obligations on the
last pass, and disturbed none of them. Every generation on **one call**.

The predicted shape — direct degrading as history accumulates while the manager stays flat — is absent.
At this depth the curve is flat for both, and where it differs it differs **against** the manager.

## Arm A's G3 is a planner limitation, not a model failure

Zero calls. The model was never asked. `editPlanner` declined:

> this planner handles requirements triggered by a key press or a click; this one is
> `{"kind":"type","selector":"#lookup"}`

G3's trigger is typing, because a match count updates as the filter changes. The planner covers `key`
and `click` only. Declining rather than guessing is the behaviour I want from it — but the consequence
is that **the manager could not attempt a requirement the direct loop completed on its first try, on
three pages out of three**. That is a real cost of the manager, not a neutral abstention, and G1–G2 is
the only range where the two arms are comparable.

## e6: a requirement satisfied by the browser

e6's G2 was not emittable for either arm, and the reason is worth keeping. e6 uses
`<input type="search">`, and **Escape natively clears a search input in Chromium**, which fires
`input`, which redraws the list. The addition was already true before any model saw it, and the
emitter refused on exactly that ground.

Same class as page e2 — a requirement whose behavioural delta is already satisfied — reached by a far
more interesting route: the platform, not the page, supplies the behaviour.

## What this does and does not establish

**Establishes:** through three accumulating generations on this ladder, a 7B rewriting whole pages
preserved every established obligation. The preservation benefit the manager exists to provide was not
observable here, and the manager cost more calls at every comparable rung and could not attempt the
third.

**Does not establish:** that preservation never matters. Seven obligations over three generations is
shallow, and a flat curve at this depth is consistent both with "the effect does not exist" and with
"the ladder is too short to reach it." **That is a limit to state, not a defence to hide behind** —
and it does not soften the fact that the predicted effect failed to appear where it was looked for.

**Does not establish** anything about arm A at G3: a decline is not a failed attempt, and it is not
scored as one.

## Cost

Billing has now caught up on AUDIT-2's apps. Five `legasus-audit` rows today:

| app | cost | audit |
|---|---|---|
| ap-rO2u… | $0.22204 | AUDIT-1 run 1 |
| ap-3t1V… | $0.14074 | AUDIT-1 run 2 |
| ap-dZen… | $0.07312 | AUDIT-2 stage 3 arm A |
| ap-Fa2f… | $0.14475 | AUDIT-2 stage 3 arm B |
| ap-Uu1r… | $0.19923 | AUDIT-2 stage 4 |

**AUDIT-2 to date: $0.41710 of its $5 authorization.** AUDIT-1 closed at $0.36278, which is higher
than the $0.336 reported at the time — billing settled upward after the run, which is the lag that
makes a billing read unusable as a cap and the wall-clock watchdog the enforcement.

All `legasus-audit` apps confirmed stopped.

## What I would not do next

Lengthen the ladder specifically until the manager looks better. If a deeper benchmark is built it
should be built to answer the question, with its stopping rule fixed in advance, not tuned until the
architecture wins.
