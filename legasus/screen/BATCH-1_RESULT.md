# BATCH-1 — live enforcement demonstrated, a task-definition conflict found, and a concrete website-adapter requirement

2026-09-28, **$0**, local, `qwen2.5-coder:1.5b`. Definition frozen at `78d15d3` before any page was
generated. 8 pages generated, all `doneReason: stop`, all kept with their logs.

## BASELINE ELIGIBILITY, reported per group and apart from additions

    GROUP A  scoreboard contract     3 of 4 qualified
      a1-scores    ELIGIBLE     state {"playerAScore":0,"playerBScore":0}, responds to a and b
      a2-tally     ELIGIBLE
      a3-points    ELIGIBLE
      a4-counter   INELIGIBLE   NO_EXISTING_BEHAVIOUR

    GROUP B  HTML filter list       0 of 4 qualified UNDER THIS PROBE

**Group B's zero must be read narrowly: "0 qualified under this probe", NOT "all four applications
failed."** The four break into two kinds:

    KNOWN BASELINE DEFECTS, 2 of 4
      b2-inventory   SCRIPT_DOES_NOT_PARSE at line 20
      b1-products    the state seam throws at load - `products is not defined`
    UNSUPPORTED BY THE PROBE AS IT THEN WAS, 2 of 4
      b3-contacts    reported NO_EXISTING_BEHAVIOUR, because the probe only pressed bare keydowns and
                     never typed into an input.
      b4-tasks       same.

> **CORRECTION, 2026-09-28.** This record originally called b3 and b4 WORKING FILTERS that the probe
> could not see. **That was wrong, and I inferred it from the presence of an `input` listener without
> reading what the handler does.** The observation-selection layer built afterwards types into their
> inputs properly and reports NO_CHANGE_OBSERVED - correctly, because BOTH FILTERS ARE NO-OPS:
>
>     b3-contacts  computes the MATCHING contacts, then removes `hidden` from matching ones that lack
>                  it and adds `hidden` to matching ones that have it. It never hides the non-matching.
>     b4-tasks     the same shape, toggling a `completed` class on the matching items only.
>
> So the honest reading of group B is: **two pages with known baseline defects, and two pages whose
> filters do nothing - none of which the original probe could have told apart.** The instrument was a
> real limitation; the conclusion I drew from it about these two pages was an overstatement. Seeing a
> listener establishes RESPONSIVENESS AT MOST, and here not even that.

## THE WEBSITE-ADAPTER REQUIREMENT, now concrete rather than guessed

What group B established is exactly what a website adapter must supply, and none of it is speculative:

    TYPE      set the value of an input and dispatch the events the page actually listens for
              (`input`, `change`), not only `keydown` on the document
    CLICK     dispatch real clicks at named selectors
    INSPECT   read state from the DOM - which rows are visible, what text they contain - rather than
              requiring a single `window.app.state()` seam that a filtering page has no reason to expose
    ELIGIBILITY  "at least one probed key changes the state" is the wrong question for a website. The
              right one is "at least one supported interaction changes the observable result."

## THE PRE-REGISTERED PREDICTION WAS NOT TESTED

I predicted the policy would decline every group B page with `UNSUPPORTED_TRIGGER`, its trigger being a
click. **It never got there.** No group B page was eligible, so the batch stopped one step earlier and the
policy was never asked. The prediction stands untested, not confirmed.

## GROUP A — the visual gate blocked a candidate on a live run

Subject: `a1-scores`, the first eligible page in the declared order. It conforms to the contract layout
exactly - 400x100, 20px Arial, `#000000`, at (10,20) and (290,20) - so the prompt's layout clause worked.
`a2` and `a3` are 300x150: `LAYOUT_DOES_NOT_CONFORM`, reported as **not evaluated**, never as passes.

    calls                 6 of 12
    accepted              0
    BLOCKED by contract   1        <- counted apart from rejected and from refused
    refused               5        (EMPTY)
    protected failures    0        restored 0        interventions 0

**The blocked attempt, seed 1, round 1:**

    functional   PASS - play 1 to 7, protected PASS, acceptance disposition RETAIN
    visual       REQUIREMENT_FAILURE_WRONG_DISPLAY - 4 steps mismatched
    render       RENDER_AGREES (advisory)
    outcome      BLOCKED_BY_VISUAL_CONTRACT - it did NOT survive

**This is the thing GATE-2 was wired for, happening on a real run rather than a fixture: a candidate the
functional gate accepted and marked RETAIN was stopped from being kept.**

### The block does NOT mean the addition introduced the defect

It did not. The addition is correct:

    playerAScore = 0;
    playerBScore = 0;
    drawScoreboard();

**The baseline mismatched 5 of 5 visual steps. The candidate mismatched 4. The one step it fixed is the
reset step it was asked to add.** Every remaining mismatch is a pre-existing defect of the generated page:

    it never draws at load          - no `drawScoreboard()` call outside the handler, so the canvas is
                                      blank at step 0
    `updateScoreboard()` increments BOTH players regardless of which key was pressed, so `a` yields
                                      {1,1} where the contract requires "Player A: 1, Player B: 0"

A reset-only addition leaves both untouched, correctly - it was never asked to fix them.

## A TASK-DEFINITION CONFLICT, and it is mine

**The protected set and the visual contract demand opposite things, and no candidate can satisfy both.**

    PROTECTED (must be preserved)   pressing `a` leaves {"playerAScore":1,"playerBScore":1}
    VISUAL CONTRACT (must be shown) after `a` the display reads Player A: 1, Player B: 0

The protected set is built from OBSERVATION of the baseline, so it faithfully preserves the baseline's
incorrect both-increment behaviour. The visual contract is written from the REQUIREMENT, which asks for
independent increments. **A candidate is therefore asked to preserve and to correct the same behaviour at
once.**

**This is a task-definition conflict, not a model failure and not a gate failure.** Group A's run was
unwinnable by construction, and no outcome from it can say anything about the policy's ability to build.
What it can and does show is that the decision rule governs retention live.

**The general lesson:** a protected set derived from observation preserves whatever the baseline does,
including its bugs. When a task also carries a contract describing what the baseline SHOULD do, the two
can contradict. A manager needs to detect that before spending calls on it - the conflict is mechanically
checkable, by running the contract against the baseline and comparing what it requires with what the
protected set pins.

## What this establishes

- **Established:** the GATE-2 decision controls what survives, on a live run. A functionally accepted
  candidate with disposition RETAIN was blocked by a required visual contract and did not survive.
- **Established:** the layout clause in a generator prompt can produce a conforming page - 1 of 4 did,
  exactly.
- **Established:** the current probe cannot evaluate input-driven web pages, and the adapter requirement
  that follows is specific.

## What this does NOT establish

- **Nothing about the policy's ability to build on group A**, because the task was contradictory.
- **Nothing about the four group B applications' quality** - two have known defects, two were not judged.
- **Nothing about websites generally**, from four pages of one shape.
- **Nothing about the hub.** The hub-versus-narrow-harness trace remains a separate bounded investigation.

## Call accounting, separate and unsummed

    addition attempt calls      6 of 12       (group A subject only)
    page generation calls       8             this batch
    browser probe runs         ~30            eligibility, observation, task emission, visual checks
    oracle calls                0
    interventions by a person   0
    dollars                     0
