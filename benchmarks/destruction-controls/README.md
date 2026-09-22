# Calibration controls for the hub's two preservation predicates

Five hand-written replay scenarios with their expected outcomes fixed before they were first run.
They exist because pass 1 of the step 4 attribution used a discriminator that had never been shown to
fire, and reported its silence as a measurement.

The hub has **two** preservation predicates, not one:

    removal     agent.js ~3475   lostDefs / lostExports   a name that existed is gone
    duplicate   agent.js ~3505   defCounts                a name's COUNT grew (1 -> 2, 1 -> 28)

`lostDefs` compares name *sets*, so definition multiplication is invisible to it. The two predicates
are disjoint in practice: across 78 set G scenarios they never co-occurred.

## RUNNING THEM

    node <hub>/measurements/replay/replay-run.mjs preservation-predicates.jsonl --all \
         --hub <hub>/server/index.js --out out.jsonl

Each scenario starts an isolated hub (own port, workspace, queue, runs, traces) with a mock model
serving recorded replies. Nothing live is touched; no model and no GPU are involved.

`replay-run.mjs` as shipped detects only the removal refusal, and detects it by regex over the
**prompts** served to the model. That channel is lossy: the duplicate refusal message is long enough
that it does not survive into the prompt text, so it reads as 0 while the refusal actually fired.
`add-steps-detectors.mjs` writes a patched copy that reads both refusals from the run's **steps**,
which is the authoritative channel for these events. Use it, not the prompt channel.

    node add-steps-detectors.mjs <dir containing a copy of replay-run.mjs>

## preservation-predicates.jsonl — the write/edit route

    ctl-DUP-POSITIVE      write_file makes foo go 1 -> 2       duplicate refusal FIRES, file unchanged
    ctl-NEGATIVE          write_file adds a genuinely new def  BOTH predicates silent, write lands
    ctl-REMOVE-POSITIVE   write_file drops an existing def     removal refusal FIRES, file unchanged

The negative is not optional. Without it a predicate that refuses everything passes both positives,
and sensitivity and specificity are orthogonal. The two positives also prove the predicates do not
cross-fire: the duplicate case leaves the removal counter at 0 and vice versa.

## append-route.jsonl — the same effect by a different route

    ctl-APPEND-DUP   append_file makes foo go 1 -> 2, the SAME corruption ctl-DUP-POSITIVE refuses
                     PREDICTED and OBSERVED: no refusal, the duplication LANDS (def foo x2)
    ctl-APPEND-NEW   append_file adds a genuinely new def
                     no refusal, and nothing to refuse - the write lands correctly

`beforeSrc` is captured at `agent.js:3392` only for

    (tool === 'write_file' || tool === 'edit_file') && /\.(py|c?js|mjs)$/i.test(args.path)

so `append_file` has no before-image and **both** refusals are gated off. `agent.js:3431` says
"append_file is an edit too, and needs the same checks" and does add `quickCheck` and
`duplicateNote` — both advisory. `markerRefusal` at `agent.js:578` guards one file, the workspace
boundary marker; it is a single-file interdiction, not a preservation check.

`ctl-APPEND-NEW` is what makes the pair a measurement rather than an anecdote: the route is not
refusing everything and is not broken. It is specifically blind to the corruption the other route
refuses.

## WHAT THESE CONTROLS ARE FOR

A regression suite for both predicates that can fail. If `ctl-DUP-POSITIVE` ever stops firing, the
predicate aimed at set G's actual corruption mode has been lost. If `ctl-APPEND-DUP` ever starts
refusing, the append route has been brought under the predicates and the demonstrated bypass is
closed — which is a change worth noticing deliberately rather than discovering later.
