# The host/core boundary pattern (recorded 2026-09-22, hub @ 3f5a8ff)

A named pattern, not a result. It explains a recurring CLASS of failure and explicitly does
not explain several others, which are listed below so the pattern cannot quietly absorb them.

## The pattern

> A recurring class of Legasus failures arose because authoritative execution facts were
> either absent, degraded, or reconstructed after crossing the host/core boundary. `agent.js`
> repeatedly exposed that boundary because it currently owns much of the hub's operational
> reality.

## The strongest sentence, and the architectural correction it carries

> **The existing trace is not the missing governance interface; it is evidence that the host
> already knows how to produce records. The governance interface should PRECEDE the training
> projection, not consume it.**

LegaCore must NOT consume `saveTrace()` output. That would repeat the 2026-09-19 mistake in a
subtler form: taking a lossy representation built for one purpose and asking another subsystem
to reconstruct reality from it.

                     agent.js / host
                          |
                   authoritative event
                          |
              +-----------+-----------+
              v                       v
      TRAINING PROJECTION      GOVERNANCE PROJECTION
        (saveTrace-like)          (LegaCore input)
              v                       v
       fine-tuning corpus      evidence / obligations

`saveTrace()` becomes a projection, not the authoritative record. This preserves the existing
training system while stopping the training schema from defining what LegaCore may know.

    Produce reality once. Derive purpose-specific views from it.
    Training must not define execution truth.
    LegaCore must not reconstruct execution truth.
    The UI must not define execution truth.

## Precedent: this was already discovered on 2026-09-19, against EXTERNAL producers

Commit `cf6dffd` — *"r4: the external-producer boundary - stop reenacting an authority Legasus
can simply run"*:

    doctest truth              Legasus reconstruction
    want = "integer\n"    ->   "integer"            information destroyed
    example identity      ->   module|source        identity destroyed
    failure semantics     ->   a local vocabulary   semantics approximated

> LEGASUS HAD PLACED ITSELF INSIDE THE TRUTH-PRODUCING MECHANISM WHEN IT ONLY NEEDED TO BE AN
> EVIDENCE CONSUMER.
>
> REASON AT THE BOUNDARY WHERE AUTHORITY ORIGINATES; ADAPT EVIDENCE RATHER THAN REENACTING THE
> AUTHORITY BEHIND IT.

Generalised the same day in `e668baf`: *"AUTHORITY CANNOT BE CREATED BY DESTROYING INFORMATION
- four defects turn out to be one law."*

The 09-19 fix was NOT to reconnect to a host. It was to **run the real producer and record what
it said.** The hub-shaped analogue therefore requires the hub to BE a producer of these facts.
Today it is one only partially — measured below.

## Measured: the host already produces a record, aimed at the wrong consumer

`saveTrace()` (agent.js) emits per run:

    { ts, id, status, goal, plan,        run lineage
      finishKind,                        verdict
      provider, model, source,           ACTOR CONTEXT ('human' | queue | supervisor)
      followups,
      steps: [{ type, tool, path }],     tool identity + target
      code:  [{ tool, path, content }] } write_file / edit_file ONLY, truncated at 30k

**Already produced today:** `ActorContext`, `RunLineage`, tool identity, target path.

**Missing, precisely:**

    - before-state                 absent from the record entirely
    - per-step result              tool and path kept; success/failure and effect are not
    - entrance / mechanism         nothing records which route initiated the run
    - append_file                  excluded from `code` (same gap as beforeSrc, agent.js:3392)
    - tool arguments              `steps` drops every arg except `path`
    - approval state               not carried per step

The `source` field's own comment states the design intent: *"so a training slice can be cut by
model, and supervisor-generated goals told apart from a human's."* The record keeps what a
fine-tune wants and discards what a governance decision needs. **Different information
contracts, one schema.**

Add ONLY what an existing frozen failure demonstrates is required. Not twenty fields.

## Feasibility: the host has the facts at ONE place

This is why the correction does not require rewriting agent.js.

    agent.js:3396   result = await tools[tool](args)
                    in scope here: tool, args, beforeSrc, result/rawAnswer, callKey, run
                    -> nearly the entire governance record, at a single site

    agent.js:2078   run.steps.push({ n, ts, ...step })
                    the ONLY step-push site in the file

Two chokepoints, not a scattered concern. The boundary can be introduced incrementally exactly
where the host already holds the facts.

### CORRECTION (appended, not edited) - "two chokepoints" was WRONG

There are **three** tool-execution sites, not one. Measured:

    agent.js:2690   subtask execution      result = await tools[tool](args)
    agent.js:3396   main loop              result = await tools[tool](args)
    agent.js:4590   human-approved pending result = await tools[tool](args)

(73 and 93 are `__toolPolicyTest` hooks; 2645/4296/4638 are read-only `tools.list_dir` calls.)

**`beforeSrc` is captured at 3396 ONLY.** So the lost-definition check and its rollback - the
hub's entire preservation guard - do not run for subtask writes or for human-approved tools.
Three sites, three different record shapes:

    2690  pushStep {type:'subtask_step', tool, args, text}   NO result, NO beforeSrc
    3396  full path                                          beforeSrc + rollback
    4590  pushStep {type:'tool', tool, args, result, approved:true}   result, NO beforeSrc

Note 4590's record is RICHER than the main path's in one respect (it keeps `result`) and
poorer in another (no before-image). The schema is already inconsistent across the three
producers, which is itself evidence for emitting one canonical event rather than letting each
site invent its own shape.

Staged migration follows from this (3396 first - richest context; then 4590 - tests whether
approval semantics fit without special vocabulary; then 2690 - tests subtask composition; then
the direct HTTP writers; then the PTY, which forces the real question of whether an
out-of-process effect can participate in the same contract).

### Consequence: a pre-registered deduction of mine was WRONG

On 2026-09-22 I stated, before the Set G identities were recovered, that *"route
non-execution cannot explain any Set G survivor, because they all came through the one
governed path."* The reasoning was wrong: there is no ONE governed path. Within mechanism 1
there are three execution sites and only one carries the guard.

Checked against the Set G coder30b artifacts rather than argued:

    subtask steps in 78 runs ............ 0      (so subtasks cannot explain any survivor)
    approval-path executions ............ 7      ALL of them `git_undo`

`git_undo` reverts the workspace. It is destructive by design, it ran seven times through
4590, and **no before-image or preservation check ran on any of them.** That is exactly
ROUTE_NONEXECUTION - the guard did not execute because the effect took a different site.

So ROUTE_NONEXECUTION stays a LIVE candidate for the six survivors. Whether any of the seven
`git_undo` calls coincides with a survivor is UNKNOWN until the recovery completes, and must
not be assumed in either direction.

### `entrance` belongs upstream, as lineage

`entrance` cannot be recovered at the tool site and 3396 must not infer it. It belongs to the
causal chain:

    entrance -> run -> tool invocation -> effect

which lets these stay distinct rather than collapsing into one `source` string:

    actor = model,  entrance = supervisor
    actor = model,  entrance = human-started-agent
    actor = human,  entrance = approval-resume

Who performed the immediate action is not what initiated the causal chain.

## The PTY is the boundary test

    mechanisms 1-5   host can potentially emit canonical effect events
    mechanism 6 PTY  effect occurs OUTSIDE that producer entirely

`POST /api/terminal/send` emits **no trace at all** — it is not a run. It is invisible to the
producer as well as to any in-process wrapper (see ROUTE-COMPLETENESS_STEP2).

This is what distinguishes a genuinely effect-oriented interface from another agent.js
instrumentation layer. If the PTY must eventually emit through a lower-level effect observer,
that is acceptable — but **do not pretend agent.js can record something it cannot see.**

## The boundary degrades in BOTH directions

`0a4d686` (2026-09-20): *"the hub found four defects in LegaScreen before LegaScreen found
anything in the hub."* So the problem is not simply Hub -> LegaCore:

    Hub reality  <->  shared semantic boundary  <->  LegaCore judgment

The host must not flatten evidence going in. The host must also not flatten LegaCore's
distinctions coming back out. These:

    UNRESOLVED | UNKNOWN_RULE | INSUFFICIENT_EVIDENCE | REFUSED | INVALIDATED

must not all collapse to `false` or `failed`. That recreates information destruction in
reverse, and `e668baf` says authority cannot be created that way.

## Same smell, different axis: the training-corpus contamination

`AGENT_TRACES_DIR` was not overridable, so every isolated test hub and offline fuzz run
appended REPLAYED mock output to the real corpus: 359 committed rows became 2,000+ in a day,
indistinguishable from real runs. A representation intended for one downstream purpose became
entangled with the production mechanism that generated it. Not the authority problem, but the
same corrective principle: produce once, derive views.

## What this pattern does NOT explain

Listed so it cannot absorb them later. These are genuine LegaCore defects; a native feed fixes
none of them.

    d2cda02  a NAME COLLISION was granting a declared dimension's authority; registry leaks on failure
    8b694ad  "my first fix passed its own tests while the defect survived one layer up"
    f3df9ce  LAW 5 was a LIVE HOLE in committed code
    e365b94  admitDimension has no production consumer
    89d37fc  seven corrections to my own stage 1-2 record
    (memory) TRANSFER-BIND cannot attach - an ESM/CJS loader limit, not context loss

The 19th has 81 commits; the overwhelming majority of its self-corrections are apparatus and
self-verification failures of this kind. The honest scope is **a recurring class**, never "a
lot of our errors."

## Status

HYPOTHESIS, recorded before any implementation. H-HOST-CONTEXT should predict IN ADVANCE which
frozen failures it expects to clear. Stated broadly it will look confirmed by the failures it
fits and silently carry the ones it does not.

The clean test remains: SAME LegaCore, SAME rule registry, SAME matcher, SAME acceptance
criteria - only the input differs (synthetic/reconstructed vs native host-derived). No new
LegaCore rules may be added during it.

## Apparatus note: reported state != established state

This file's own history is a miniature instance of the principle it records.

On 2026-09-22 I told the user *"I've written the pattern up as legasus/HOST-BOUNDARY_PATTERN.md"*
and described its contents. No Write call had been made. The file did not exist. The claim was
a reported state that no established state backed, and it was caught only because the path was
checked afterwards.

Two other instances the same day, same shape:

    - a recovery run reported `exit 0` while having failed; the 0 came from a trailing `echo`,
      not from node. The real status was 1. Caught only because the output file it claimed to
      have written was absent.
    - "two chokepoints" above, asserted from one grep and corrected only when a second grep was
      run at someone else's prompting.

This is the same failure class as `hub-detects-but-does-not-act` and as the Set G rig that
inferred a child's success from the presence of its output file. **Never infer an effect from
a report of the effect** - including one's own report.
