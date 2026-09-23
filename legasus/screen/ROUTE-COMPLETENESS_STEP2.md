# ROUTE-COMPLETENESS Step 2 — the mutation census (frozen 2026-09-22 03:32, hub @ 3f5a8ff)

Measured by reading `server/*.js` at 3f5a8ff (30 files dirty in the tree; every number below
comes from committed source, not from the working copy). This file freezes **denominators
only**. It asserts no benefit for any architecture.

## Three denominators, because they answer three different questions

    state-changing HTTP endpoints ............................ 33
    workspace-effect-capable HTTP entrances .................. 12   (5 direct + 7 transitive)
    distinct workspace mutation mechanisms .................... 6
    B-RC structurally reachable ....... 11/12 entrances, 5/6 mechanisms

**Report mechanisms covered BEFORE routes covered, always.** Seven of the twelve entrances
funnel into one mechanism, so an entrance-only number can inflate a result 7x. That is the
whole reason this file exists.

## The 33, classified by effect domain

| domain | n | routes |
|---|---|---|
| WORKSPACE — direct | 5 | `POST /api/agent/upload`, `/upload-zip`, `DELETE /api/agent/files`, `POST /api/agent/reset`, `POST /api/terminal/send` |
| EXECUTION — transitively workspace-effecting | 7 | `/api/agent/start`, `/queue/run`, `/:id/approve`, `/:id/resume`, `/:id/followup`, `/:id/stop`, `/supervisor` |
| EXECUTION — isolated | 2 | `/api/game/verify`, `/api/godot/verify` |
| QUEUE / CONTROL | 3 | `POST /queue`, `POST /queue/chain`, `DELETE /queue/:id` |
| ASSET LIBRARY | 5 | `POST /api/assets`, `/batch`, `DELETE /:id`, `/reindex`, `/canonical` |
| SETTINGS / CREDENTIALS | 8 | `/api/keys` x2, `/api/settings`, google `/config` `/services` `/authorize` `/disconnect` `/probe` |
| HISTORY / METADATA | 2 | `DELETE /api/history`, `DELETE /api/history/:id` |
| OTHER | 1 | `/api/chat` |

`/api/godot/verify` is classified ISOLATED on evidence, not assumption: `godotVerify.js:212`
does `mkdtempSync(join(tmpdir(), 'hub-gd-'))` and passes that dir to `materialize()`. It never
touches WORKSPACE.

Counting `/api/settings` or the asset library against a workspace invariant would be a valid
attack on the experiment. They are excluded here by domain, not by oversight.

## The 6 mechanisms

    1. agent tool table (agent.js:363-1431)   <- serves all 7 transitive entrances AND the model
    2. POST /api/agent/upload                 own writeFileSync
    3. POST /api/agent/upload-zip             own tmp-file + extract
    4. DELETE /api/agent/files                own unlinkSync
    5. POST /api/agent/reset                  own bulk delete (has a bespoke guard; see resetGuard.test.mjs)
    6. POST /api/terminal/send                the PTY

There is **no shared write primitive.** Each of 2-5 calls `writeFileSync`/`unlinkSync` itself.

## Mechanism 6 is structurally different, and the prereg must say so

`index.js:613` attaches the terminal with `cwd: process.env.HUB_TERMINAL_CWD || WORKSPACE`.
`POST /api/terminal/send` pushes text into that PTY with a trailing CR. The mutation therefore
happens **in a child process**. There is no `writeFileSync` in this process to wrap.

An in-process pre-effect wrapper cannot intercept it. So:

> **B-RC's reachable denominator is 5/6 mechanisms and 11/12 entrances. `/terminal/send` is
> out of scope BY MECHANISM, declared in advance.** Any later "12/12" or "6/6" claim for B-RC
> is false by construction.

Holding B-RC to 6/6 would be an impossible requirement and would hand Legasus a win by
definition. That is not permitted.

### The symmetric obligation on Legasus

Legasus does **not** earn mechanism 6 by asserting "govern the effect, not the actor." To earn
it, an implementation must observe the proposed effect of a child-process write BEFORE it
becomes authoritative. If LegaCore still ultimately hooks Node-level calls, it loses the PTY
too, and effect-indexed governance is conceptual only here.

    PTY child process -> writes workspace without using any hub writer
      Can the candidate boundary observe the proposed effect before it is visible?
        no  -> conceptual only; no point scored
        yes -> a real architectural distinction, because B-RC cannot do this without
               moving to a fundamentally lower-level interception mechanism

Recorded as a PROSPECTIVE prediction on 2026-09-22, before any implementation. It is noted
that this prediction favours Legasus and was authored while reasoning about Legasus; per
`legasus-production-decision`, reasoning of this shape previously produced a benefit claim
that did not survive its strip control. It is to be tested, not credited.

## `/api/terminal/send` as a preserved specimen

**Not a vulnerability. My earlier "security-relevant" flag was wrong and is withdrawn.**
`app.use('/api', requireAuth)` (index.js:36) is mounted before any route. `auth.js` opens by
naming the PTY as its reason for existing, defaults to localhost-only when `HUB_TOKEN` is
unset, drops the localhost exemption once a token is set (with a recorded fix for the
tunnel-terminates-on-loopback hole), compares with `timingSafeEqual`, and deliberately ignores
`X-Forwarded-For`. The server binds all interfaces (`app.listen(PORT)`, no host), but the gate
holds. This threat model was handled more carefully than the flag implied.

The specimen is the **matched pair inside the trusted perimeter**:

| effect | actor | entrance | gate |
|---|---|---|---|
| arbitrary shell command in WORKSPACE | model | `run_command` | gated — human must approve |
| arbitrary shell command in WORKSPACE | UI / HTTP client | `POST /api/terminal/send` | no equivalent gate |

The policy is not careless. `run_command` is gated because the agent acts while nobody
watches; a human typing in a terminal *is* the approval. The finding is that **the rationale is
a presupposition the route never checks** — "Send to Terminal" pushes machine-generated text
into that PTY from other tabs, so the assumed human need not be there.

Specimen definition, frozen: *a trusted-perimeter route whose authorization rationale is human
presence, reachable by product handoffs that carry machine-generated commands.*

**Preserve this specimen even if the route is later fixed.** Per
`falsification-sequence-beats-final-count`, the pre-fix state is the evidence.

## Tool-side policy at 3f5a8ff

28 callable tools, 21 auto / 7 gated. No entry in `AUTO_TOOLS` is uncallable, and no callable
tool is missing from the policy — the actor-side policy is complete over its own surface.

    auto  (21) list_dir read_file search_file outline_file write_file edit_file append_file
               test_web web_search web_fetch git_diff git_log remember recall task_list
               task_add task_done gmail_search gmail_read drive_read calendar_list
    gated  (7) run_command run_python git_commit git_undo gmail_send drive_upload calendar_add

The three workspace mutators — `write_file`, `edit_file`, `append_file` — are all **auto**. The
governed boundary currently sits in front of the unusual effects and behind the routine one,
and routine is where the measured damage is (`hub-destroys-a-third-of-working-code`;
`append-file-escapes-the-duplicate-guard`).

## B-RC prereg (baseline gets every advantage)

> Every enumerated workspace-effecting route must invoke one shared pre-effect preservation
> decision before its mutation becomes externally visible. The wrapper may reuse existing
> preservation predicates. Route adapters may ONLY translate route-specific inputs into the
> wrapper's common representation and translate its allow/refuse result back.

    ALLOWED ADAPTER WORK          NOT ALLOWED
      identify target               "if append_file ..."
      obtain before-state           lost-symbol logic for one route
      represent proposed effect     route-specific exemption
      invoke common wrapper         hand-written recovery for one specimen
      perform / refuse effect       adding a detector because a survivor needs it

Report every run: **mechanisms covered**, routes covered, shared wrapper LOC, adapter LOC by
route, route-specific branches, semantic exceptions, predicate count.

Raw LOC is NOT the success criterion — ten plumbing lines vs twelve is not interesting. The
criterion is **whether semantic exception count grows with mechanisms added.**

Strip control is mandatory, per `legasus-production-decision`: "the wrapper handled it" and
"the wrapper plus N adapter lines handled it" must be distinguishable, or the comparison is
void.

## Historical survivors — data LOCATED 2026-09-22

Contrary to the earlier note that the campaign directory was unrecoverable, it is intact:

    measurements/2026-09-11-setF/     measurements/2026-09-11-setG/

Recorded summaries (`*-regress.txt`):

| arm | goals run | worked when written | works at end | REGRESSED |
|---|---|---|---|---|
| setF coder30b | 100 | 48 | 36 | **16** |
| setG coder30b | 78 | 33 | 29 | **6** |
| setG coder14b | 58 | 6 | 4 | **2** |

**Caveat that must travel with the 16 -> 6 improvement — CORRECTED 2026-09-22.**

An earlier draft of this file said F and G used *different goal sets*. That was wrong, and the
correction makes the comparison STRONGER, so it is recorded rather than quietly amended:

    goals-F.json vs goals-G.json  sha256[:16] 1f29e971e72f9461  IDENTICAL  (100 goals each)
    checks-F.mjs vs checks-G.mjs  sha256[:16] ea0d8b53535313ef  IDENTICAL

(`measurements/2026-09-11-setG/prep-checksums.txt` recorded this at prep time; it was not read
before the caveat was written.)

So F->G holds constant: the 100 goals, the hidden checker, and the model arm (coder30b). What
changed is the hub (the twenty wave-1 fixes) and the **goals actually reached**: 100 vs 78.

The surviving confound is therefore REACH, not goal set. 48/100 vs 33/78 worked-when-written.
Per `conversion-flat-at-73-percent`, conversion has been flat across campaigns, so differing
reach is expected rather than evidence of anything — but the regressed denominators (48 vs 33)
are different populations of goals, and the 16 and the 6 are not drawn from the same 48.

Defensible sentence: *"same goals, same checker, same model arm; regression fell from 16/48 to
6/33 across a hub change, over a different subset of goals reached."* NOT "the fixes cut
regressions by 63%."

Per-goal survivor identity is **recoverable but not yet recovered**. `measurements/replay/
regress.mjs` prints per-goal rows tagged `<- REGRESSED`; only its summary tail was captured
into `*-regress.txt`. Re-running it over `runs/` + `data/` reproduces the identities (it
re-invokes the checker per exported end state, so it is not free).

Until re-run, for each survivor:

    before_state_available = UNKNOWN
    detector_applicable    = UNKNOWN
    detector_executed      = UNKNOWN
    route                  = UNKNOWN

UNKNOWN is **data, not a blank to fill, and not a failure category.** It means the historical
evidence does not establish which mechanism was responsible.

Classification vocabulary, frozen before recovery so it cannot be fitted to the answer:

    ROUTE_NONEXECUTION | DETECTOR_INCAPABLE | DECLARED_OVERRIDE
    POST-WRITE_TIMING  | OTHER_ESTABLISHED  | UNKNOWN

`hub-detects-but-does-not-act` (219 fired / 164 ignored) is why this matters: in this hub
detection and enforcement demonstrably come apart, so a surviving regression cannot by itself
distinguish "the detector missed it" from "the system declined to act on the detection."

Freeze each survivor's tuple BEFORE touching the architecture.

## THREE SEPARATE FACTS about the seven `git_undo` executions (locked 2026-09-22)

Measured: Set G coder30b ran 7 tool executions through the approval path (agent.js:4590), all
of them `git_undo`, and `beforeSrc` is captured at 3396 ONLY. Therefore:

    GUARD_EXECUTED             = false   <- ESTABLISHED
    SHOULD_GUARD_HAVE_EXECUTED = ?       <- NOT established
    CAUSED_SET_G_SURVIVOR      = ?       <- NOT established

`git_undo` is intentionally destructive and was explicitly human-approved. Non-execution of a
preservation guard is NOT by itself a preservation defect. Collapsing these three would let the
effect/actor framework classify an intentional, approved rollback as a preservation failure.

It may need a different obligation topology altogether: **"restore to an approved historical
state"** rather than **"preserve the current state."** Those are different obligations with
different evidence requirements, and the second is not a weakened form of the first.

## Recovery attempt 1 FAILED - no identities recovered (2026-09-22)

    Error: the checker failed on end state 8713ca9 (goal 76 of 78), so this analysis
           has no number and must not report one.

The 2026-09-12 hardening fired correctly. Before it, this same failure produced a 0-byte
`coder30b-setg-regress.txt` that looked like a completed run for hours.

The correct result of the attempt is: **no Set G survivor identities recovered; measurement
aborted because the checker's output destination disappeared before finalization.** Not 0, not
6, not "probably six."

The checker DID complete all 100 goal checks (its stdout survives in the error) and died on the
final `writeFileSync` at checks-G.mjs:811 with ENOENT - the mkdtemp tree it was writing into,
and its `ws` subtree, no longer existed. Its printed `24/100` is from a SINGLE end state, is
not comparable to the recorded 29, and must not be quoted as a result.

    computation happened != result established

### Deletion owner: NOT ESTABLISHED. Four hypotheses cleared, none confirmed.

    checks-G.mjs             no rmSync/unlink/rmdir/rmtree anywhere        CLEARED
    the Set G goal code      all "delete/remove" goals are in-memory
                             (Cache.delete, Graph.remove_node, DOM cards)  CLEARED
    fuzzForever.mjs sweep    readdirSync(tmpdir()) but scoped to
                             /^fuzz(\d+)-/ ; `regr-*` cannot match         CLEARED
    peer replay-run-attrib2  rmSync only on its own mkdtemp handle,
                             dirs named `replay-*`                         CLEARED

Do NOT move `res.json` out of the tree yet. That would let the analysis finish while hiding the
more serious fact that **the workspace under evaluation disappeared during evaluation.**

Correction sequence, frozen before any fix:

    1. reproduce
    2. identify deletion owner
    3. freeze diagnosis
    4. fix lifecycle
    5. positive control: a deliberate deletion IS detected
    6. negative control: an ordinary replay RETAINS its tree
    7. rerun Set G

### Two claims, separately scoped

    TEMP_TREE_DISAPPEARED = ESTABLISHED
    DELETION_OWNER        = UNKNOWN

The first does not depend on the second. The destination existed (mkdtemp succeeded and
exportTree wrote into it), the checker ran against it to completion, and the final write got
ENOENT because the containing tree was gone. Tree disappearance is therefore established
independently of who caused it, and DELETION_OWNER can stay unresolved without making it
speculative.

Do not weaken the UNKNOWN. The most plausible hypothesis (a tree-blind temp sweep, for which
there is prior history on this box) was CLEARED on inspection. A failed plausible hypothesis is
information, not an absence of information.

### PROMOTION RULE (frozen)

> **A concurrent rerun may diagnose apparatus behaviour. Survivor identities are promoted ONLY
> from an uncontended rerun.**

Recovery attempts 2 and 3 overlapped another session's Set G coder30b replay (see below), so
neither may populate the six identities even if it completes successfully. Shared state that
has bitten this project before - ports, trace directories, process cleanup, environment
variables, global temp handling - would otherwise force the identities to be unwound later.

Sequence: wait for the competing Set G process to exit, claim the slot in COORD, then run ONE
clean recovery. That run is the only one allowed to populate the tuples.

### Outcome recording for the reruns

    attempt 1 (concurrent)  tree disappeared at end state 8713ca9, goal 76/78
    attempt 2 (concurrent)  ERR_UNSUPPORTED_ESM_URL_SCHEME - my driver, not the rig
    attempt 3 (concurrent)  <pending>

If attempt 3 COMPLETES, the correct reading is **intermittent, not disproven**: one run lost
its tree, a later concurrent run did not. That is a flakiness observation about the apparatus,
and it still does not license promoting identities.

If attempt 3 fails at the same stage, the next move is NOT a fix. It is **external observation
of the temp tree lifecycle** - a watcher outside the replay/checker processes recording
creation, rename and deletion of `regr-*`, so the thing under investigation cannot explain
itself. Identifying the removing PID closes the apparatus question without modifying either
side.

## Recovery attempt 3 COMPLETED (real NODE_EXIT=0, 2026-09-22 04:55) - CONCURRENT, so identities are PROVISIONAL

Per the pre-committed branch: **intermittent, not disproven.** Attempt 1 lost its tree at end
state 8713ca9; attempt 3 walked every end state and cleaned each normally. DELETION_OWNER stays
UNKNOWN.

Attempt 3 began while 1083fe36's Set G replay was live, so under the frozen promotion rule its
six identities are diagnostic only. A clean uncontended run was claimed in COORD at 04:58 and
launched; ONLY that run may promote identities. Attempt 3's per-goal rows are preserved beside
this file as `ROUTE-COMPLETENESS_setG-attempt3-rows.txt`.

### 1. Did it reproduce the historical REGRESSED 6?   YES - byte-identical

    rerun:    coder30b-setg: 78 goals run | worked when written 33 | works at the end 29 (as asked 29) | REGRESSED 6
    recorded: coder30b-setg: 78 goals run | worked when written 33 | works at the end 29 (as asked 29) | REGRESSED 6

### 2. The six identities (PROVISIONAL)

    goal  file            own-end state  final failure (verbatim)
       1  s1_library.js   d09036f        load: Member Alice already has book 978-0134685991
      10  s10_desk.js     b52438e        load: Member Alice already has book 978-0134685991   (s10 requires s1)
      13  s3_matrix.js    80e1d06        load: [x].transpose is not a function
      15  s5_expr.js      d31a7f2        load: Assertion failed: Invalid expression
      33  s3_matrix.js    d6b997a        load: [x].transpose is not a function
      43  s3_matrix.js    3aed370        load: [x].transpose is not a function

**Every one of the six carries the `load:` prefix** (checks-G.mjs:32 - the module threw inside
`require()`). Three files, six goals: per `goal-coupling-wrong-denominator`, 6 regressions are
**3 destruction events**.

### 3. Coincidence with the seven `git_undo` approval-path executions?   ONE goal, and NOT causal

    git_undo goals:  25, 33, 33, 33, 34, 45, 55
    survivor goals:   1, 10, 13, 15, 33, 43
    intersection:    33 only

Goal 33's three undos (steps 12, 27, 31) reverted its OWN in-run edits; it then rewrote at step
38 and ended `then P`. Goal 55's undo (commits 6ace253 -> 1ba7096) reverted s5_expr.js to a
state that ALSO throws at load (bisect below: both THROW). No load-state flip coincides with any
undo commit. Therefore, for all seven:

    GUARD_EXECUTED             = false   (established earlier)
    CAUSED_SET_G_SURVIVOR      = NO      (ESTABLISHED by bisect)
    SHOULD_GUARD_HAVE_EXECUTED = still open, and now moot for Set G

### 4. What is ESTABLISHED per destruction event (from original artifacts + the recon clone, NOT from attempt 3)

Method: `git log -S` on each throwing line in the 444-commit bundle clone; then `require()` of
the file at EVERY checkpoint commit, oldest to newest (`bisect` in the transcript); then map
commit epoch -> goal window from the run files.

**s3_matrix.js** - broken by goal 73 ("Add solve(b)"), after goal 63 had already broken it:

    4c0691f  goal 63  THROW  TypeError: m3.multiply is not a function     (unloadable from goal 63)
    0724a3a  goal 73  ok     <- goal 73 step 16: `node s3_matrix.js` EXIT 0, "All asserts passed!"
    3febf3f  goal 73  THROW  TypeError: [x].transpose is not a function   <- step 17 edit, step 18 checkpoint
    d68e327  goal 73  THROW                                               <- step 27 append_file (+1624 bytes of tests)
    5cbc049  goal 73  THROW                                               <- FINAL

    Goal 73's run, verbatim from its steps:
      20  run_command  node s3_matrix.js  -> STDOUT "All asserts passed!"  STDERR trace naming
                                            s3_matrix.js:464 `[x].transpose`   EXIT: 1
      24,25,30  edit_file  ERROR: needs a FIND snippet (3 model calls burned on tool format)
      27  append_file  (no beforeSrc exists for append)
      36  write_file   ERROR: would have REMOVED identity, sub, toArray   <- THE PRESERVATION GUARD FIRED
      41  error        ran out of step budget (30 model calls)
      42  note         "did not parse at the end of the run - restored the last committed version that did."

    Every hub mechanism executed: run_command reported EXIT 1 with the exact line; the lostDefs
    guard refused a destructive rewrite; the end-of-run rollback ran. And the file was left
    unloadable, because the rollback's criterion is `quickCheck(f)` = PARSES. Verified at
    agent.js:1722 - quickCheck runs `node --check` for .js/.cjs/.mjs and `python -m py_compile`
    for .py, and nothing else. It never loads the module. 3febf3f, d68e327 and 5cbc049 all pass
    `node --check`. The first parsing candidate throws at require.
    **Parse was the wrong bar.** All six methods are present in the final file (add:56 sub:76
    transpose:96 equals:109 identity:248 multiply:264); the throw is module-level test code at
    line 464, added by the same goal.

**s1_library.js** - broken by goal 21 ("fix the variable naming conflict in the test code"):

    60e5ec5  goal 21  ok
    99d15ff  goal 21  THROW  (first error line: `let errorCaught = false;` - a redeclaration)
    ... every later commit THROWs; final message is the runtime "Member Alice already has book",
    from top-level test code at lines 378-436, BELOW `module.exports` at 327. Never recovers.
    Goal 10 (s10_desk requires s1) regresses by cascade.

**s5_expr.js** - broken by goal 25, restored by goal 35, re-broken by goal 45, never recovers:

    50e8eaa  goal 25  THROW  "Should throw invalid expression error"   (goal 15's parens regress here first)
    d13e00a  goal 35  ok                                               (restored)
    5c6c0e4  goal 45  THROW  "Assertion failed: ..."  (local assert wrapper, lines 365-389)
    6ace253/1ba7096  goal 55  THROW/THROW   (the git_undo pair - reverted to a still-broken state)
    ... THROW through goal 75.  FINAL: THROW.

### THE MECHANISM (established; identities provisional)

Every goal text ends "Include asserts that all pass, then run it with node." So every file
carries **module-level self-tests that execute at `require()`**. A later goal in the same file
then does one of: introduce a syntax error; change behaviour so an OLD top-level test throws;
add a NEW broken top-level test. Any of the three makes the module unloadable for every
consumer - the hidden checker, and `s10_desk.js` - so every earlier goal in that file reads as
regressed at once.

Against the frozen vocabulary, for all three events:

    ROUTE_NONEXECUTION     NO   every breaking write went through 3396; the guard demonstrably
                                ran (goal 73 step 36). git_undo (4590) caused nothing.
    DETECTOR_INCAPABLE     YES  for the STRUCTURAL guards: lostDefs sees names (all present);
                                quickCheck sees parse (parses). Neither sees "throws at require."
    OTHER_ESTABLISHED      YES  the tool run DID detect it - EXIT 1, exact line - and nothing
                                structural acted on that signal; it was advisory to a model with
                                a budget it then exhausted (advisory-vs-mechanical-recovery,
                                hub-detects-but-does-not-act).
    DECLARED_OVERRIDE      none seen
    POST-WRITE_TIMING      not the mechanism here
    before_state_available YES for the edit/write_file writes (.js); NO for goal 73's append

So the answer to the question this recovery was run for: for Set G, **B-RC route
completeness is NOT the main missing thing.** The guard was on the route. What was missing is a
detector whose bar is "the module still loads," and a mechanism - not a sentence - attached to
the tool run's EXIT 1.

A scorer artefact also dissolved on the way: `trial35: FN-MISSING(book,owns)` for goal 1 came
from prose parentheses in the goal text ("a book (adding", "the library owns (0 for"), not from
missing code. Recorded in the mutant-escaped memory.

### 5. What remains UNKNOWN despite successful recovery

    - the six identities themselves, until the clean uncontended run confirms them
    - DELETION_OWNER for attempt 1's vanished tree

### Closed 2026-09-22 05:30 (from the original run files)

**Goals 21, 45, 63 - the other three breaking runs:**

    goal  status   writes  lostDefs refusals  tool-run EXIT codes            parse-rollback  ended by
      21  stopped     5    none               1,0,1,0,0,1,0,1,1  (5x EXIT 1)   no            budget (30 calls)
      45  stopped     4    none               0,1,1,1,1,1        (5x EXIT 1)   step 48       budget (30 calls)
      63  stopped     7    none               0,1                (1x EXIT 1)   step 41       budget (30 calls)
      73  stopped    ~6    step 36 (refused)  0,1                (1x EXIT 1)   step 42       budget (30 calls)

    The lostDefs guard did not fire in 21/45/63 because nothing was lost BY NAME - exactly what
    the mechanism predicts, since the definitions stay and the module-level test throws. Goal 21
    additionally hit the finish gate: "Project does not run (node) - not finished." So in every
    breaking run the hub detected the breakage at up to THREE layers (tool-run EXIT 1, finish
    gate, parse-rollback trigger) and no layer ACTED beyond a sentence to a model that then ran
    out of budget. The parse-rollback, where it fired, restored a version that throws at load.
    This is the fully-instanced form of hub-detects-but-does-not-act.

**Goal 11 (and every other same-file follow-on goal):** attempt-3 rows show `then F  end F`
for 3, 5, 11, 21, 23, 25, 31, 35, 41, 45, 53, 55, 63, 65, 73, 75 - they NEVER worked at their
own end. Only the first goal per file (1) and four follow-ons (13, 15, 33, 43) ever passed, and
those are the survivors. Goal 11 is not a survivor because it was never a success.

### CONCURRENCY NOTICE

At 2026-09-22 04:28 another session (1083fe36) was running
`replay-run-attrib2.mjs .../scenarios/setG-coder30b-setg.jsonl` - a Set G coder30b replay -
one minute before this recovery's checker started. Two fuzz loops were also live
(`fuzzLoop.mjs`, `fuzzForever.mjs`). Cross-session interference is UNPROVEN but not excluded,
and per the COORD protocol this should have been claimed before starting.

### Timestamp correction - appended 05:19:59 (read from the clock)

The "05:20" and "05:30" stamps above were estimated, not read; both were written before 05:19:59. Order correct, absolute times not. See the same note in PHASE2-INTERVENTION_PREREG.md.

## PROMOTED 05:38:00 — the six identities are ESTABLISHED (clean uncontended run, NODE_EXIT=0)

The promotion sequence of Amendment 4 ran in order, all four gates passed:

    1. real child exit code ............... NODE_EXIT=0, stderr 0 bytes
    2. historical summary reproduced ...... byte-identical to the 2026-09-12 record AND to attempt 3
    3. per-goal rows identical to att. 3 .. IDENTICAL, all 78 rows (diff empty)
    4. six identities identical ........... IDENTICAL — goals 1, 10, 13, 15, 33, 43,
                                            same own-end states, same failure reasons

The clean run began at 04:59:33 after 1083fe36's Set G replay had exited, and the COORD claim
was posted at 04:58 before it started. It took ~34 min against attempt 3's ~26; both walked
every end state and cleaned each normally.

**The six survivors are therefore ESTABLISHED, not provisional.** Every UNKNOWN in this file
that was gated on "until the clean uncontended run confirms them" is now closed. The mechanism
section above was already established independently, from the original run files and the
per-commit require() bisect — the clean run confirms the identities it applies to.

Still UNKNOWN, unchanged: DELETION_OWNER for attempt 1's vanished tree.

Artifacts beside this file:
    ROUTE-COMPLETENESS_setG-clean-rows.txt    the clean run's 78 per-goal rows (PROMOTING)
    ROUTE-COMPLETENESS_setG-clean-rows.json   its full per-goal record
    ROUTE-COMPLETENESS_setG-attempt3-rows.txt  attempt 3 (diagnostic, kept — it agreed)
