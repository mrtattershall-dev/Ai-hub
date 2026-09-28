# BATCH-1 DEFINITION — two groups: the newly connected visual gate, and a first non-game domain

Frozen 2026-09-28, **before any page of this batch is generated.** Local, **$0**. No verified spend
authorization; Modal stays off.

## What this batch is for

    GROUP A  scoreboard-contract pages. Small, and its only job is to exercise the visual gate that was
             just connected to the retain path - on FRESH pages rather than the fixtures used to build it.
    GROUP B  ordinary HTML software: a list with a filter. **A NEW DOMAIN TEST, explicitly not a repeat
             of TRANSFER-3**, and its result is not comparable with TRANSFER-3's 3-of-8 eligibility rate.

**Why B is not a repeat.** TRANSFER-3's prompt, model, settings, eligibility rules and selection procedure
would all have to be preserved for a repeat, and B changes the prompt and the requirement shape
deliberately. Even a true repeat would give "a second small sample under comparable conditions", never a
trend. Both numbers here are small samples and are reported as such.

## GROUP A — scoreboard contract, visual gate BLOCKING

    pages          4, generated after this freeze
    prompt         the TRANSFER-3 template plus the layout the contract requires, verbatim:
                   "The canvas must be exactly 400 wide and 100 high. Draw with font 20px Arial and
                    fillStyle #000000. Draw 'Player A: <score>' at x=10 y=20 and 'Player B: <score>' at
                    x=290 y=20."
    model          qwen2.5-coder:1.5b, temperature 0.3, num_predict 2600, seed 7
    eligibility    the seven mechanical rules frozen in TRANSFER-3, UNCHANGED
    addition       the page-independent rule already in use: pressing the free trigger key returns every
                   piece of state to its load value
    visual         `visualContract.required = true`, layout and trace as hashed in GATE-2_MANIFEST.txt.
                   **Non-conformance here is a REQUIREMENT FAILURE**, because the task asked for that
                   layout.
    budget         12 attempt calls per page, 4 rounds, 3 seeds per round, 0 interventions permitted

## GROUP B — ordinary HTML software, a new domain

    pages          4, generated after this freeze
    prompt         a filterable list. No canvas, no game. The state seam and a document-level listener are
                   still required, because the harness needs somewhere to read state:
                   "A page listing five products, each with a name and a category. A text input with id
                    'filter' narrows the visible list to items whose name contains the typed text."
    addition       clicking a RESET control returns the list to showing every item
                   trigger: { kind: 'click', selector: '#reset' }
    visual         NO visual contract. Any visual result is reported as NOT EVALUATED and does not block.
    budget         same as group A

**A PRE-REGISTERED PREDICTION, so it cannot be presented as a discovery later.** `autoGuide.chooseSite`
declines any requirement whose `trigger.kind` is not `key`, by name, with `UNSUPPORTED_TRIGGER`. Group B's
trigger is a click. **I expect the policy to DECLINE on every group B page**, and that is the point: it
measures how far the current manager's assumptions reach into a domain that is not a keyboard-driven
canvas. A decline is a good failure - it names what it needed - and it is recorded as the result rather
than worked around by reshaping the task into a key press.

**If the policy declines, no adapter is written in this batch.** What group B produces is the list of
things a website adapter would have to supply, taken from what the policy said it needed.

## Handling of ineligible pages

Every generated page is kept with its `GENERATION-LOG.txt` and its eligibility verdict, whatever it is.
**The eligibility rate is reported per group**, separately from additions. Pages are tried in generation
order; the first eligible page in each group is the subject. Ineligibility never justifies reaching for a
page that looks easier.

## Reporting, and the principle this batch carries

    FUNCTIONAL and VISUAL outcomes are reported SEPARATELY for every page.
    An unsupported visual check is reported as NOT EVALUATED, never omitted and never read as a pass.
    Blocked-by-contract is counted apart from rejected and apart from refused.
    Baseline eligibility is reported apart from successful additions.
    Calls are reported per category - attempts, page generation, probes - and never summed into one number.

**And the principle that produced GATE-2's fix carries into everything after it: test what actually
SURVIVES the manager's decision, not whether a checker returns the right verdict.** `acceptanceDecision`
had 30 passing assertions while the runner never imported it. Every future adapter check must drive the
real retain path.

## What no outcome here can establish

- Nothing about a manager/adapter architecture, which does not exist yet.
- Nothing about the hub. **The hub-versus-narrow-harness trace stays a separate bounded investigation**,
  so a compatibility hypothesis is never confused with a result about new software tasks.
- Nothing general about websites, utilities or warehouse software from four pages of one shape.
