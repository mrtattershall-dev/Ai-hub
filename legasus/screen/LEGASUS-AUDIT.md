# LEGASUS — FULL AUDIT

2026-09-27. Commissioned as "everything understood about Legasus and a full audit on EVERY MINUTE
DETAIL". Written at **$0**, on the local machine, with nothing deployed.

---

## 0. THE HONEST SHAPE OF THIS AUDIT

There are 137 record documents in `legasus/screen/`, 155 test suites in `server/`, and roughly two
years of programme under one name. **I did not re-verify all of it today, and an audit that implied
otherwise would be the exact failure this project exists to avoid.** So every claim below carries the
layer it belongs to:

    LAYER A - RE-VERIFIED TODAY. I ran it, or computed the hash, or read the raw JSON, in this
              session. Nine test suites, the module inventory, the token-oracle probes, the
              calibration outputs, the TRANSFER-1 dispositions and hashes.
    LAYER B - READ AND SUMMARISED TODAY. I read the record and am reporting what it says, without
              re-running the experiment. The whole builder line from NARROW-1 to TRANSFER-1.
    LAYER C - INVENTORIED, NOT AUDITED. The document exists and is named. I have not re-read or
              re-run it in this session. Mostly the earlier epistemology programme.

Wherever a number appears without a layer tag, it is Layer A.

---

## 1. WHAT LEGASUS IS — AND THAT IT IS TWO PROGRAMMES

"Legasus" names two distinct bodies of work that share a directory. Conflating them would inflate both.

### 1a. The epistemology programme (Layer C)

`H-*`, `SCREEN-*`, `REACH-*`, `D-*`, `W-*`, `P-IDENTITY`, `SUBSTITUTION`, `SHADOW-WIRING`,
`ENTITLEMENT-GATES`, `STAGE-B`, `TARGET-ODYSSEUS` — about 90 documents and ~40 Python programs. Its
subject is **what a claim is entitled to**: provenance, admission, closure, refusal, discrimination
versus support. Its charter (`legasus-discovery-charter`) is that the epistemology is *discovered*, not
implemented, and that failures are preserved rather than fixed away.

**Status: inventoried only.** Its own records mark several results as scope-limited or closed negative
(for instance the consumer search was closed as three negatives *of different kinds*, explicitly never
to be cited as a count of three). I am not restating its conclusions as audited.

### 1b. The builder programme (Layers A and B) — what this session is about

The product thesis, in the user's words: **an autonomous software builder that improves through use**,
and a **plug-and-play AI manager for existing software**. The milestone: one desktop session builds a
small playable game, survives a restart, adds a feature without breaking earlier ones, and avoids a
previously encountered mistake because of retained experience.

The through-line of the last two days: **move the guidance a human supplies by hand INTO the system,
and prove it with independently verified working software.**

---

## 2. THE MACHINERY (Layer A — sizes and line counts measured today)

### 2a. The gate: how a candidate is judged

    server/playCheck.js          12,541 b   194 L  Runs a DECLARED browser play: a JSON spec of
                                                   entry, stateExpr, contract, and numbered steps
                                                   with `do` (key presses) and `expect`. Drives real
                                                   Chrome via puppeteer-core against a temporary
                                                   static server. Returns passing/failing step sets,
                                                   captured errors, stacks and DOM facts. `noErrors`
                                                   is an expectation, so "it worked but threw" cannot
                                                   pass.
    server/evaluator.js          12,253 b   225 L  The INDEPENDENT verdict. Refuses to judge a tree
                                                   that is not a git repo - "a verdict that cannot
                                                   name what it judged is not a verdict". Supports
                                                   `spec.plays`: an ARRAY of independent accumulated
                                                   sequences, each from a fresh load, all of which
                                                   must pass.
    server/acceptance.js          9,908 b   191 L  The disposition: RETAIN, PRESERVE_INCOMPLETE,
                                                   RESTORED, RESTORE_FAILED, NO_VERIFIED_BASELINE,
                                                   HELD. Restores byte-exact and verifies the restore.
    server/judgeCandidate.mjs     7,484 b   127 L  The shared gate tail, so every experiment is
                                                   judged by the same code. classifyFailure gives
                                                   RUNTIME_EXCEPTION_AT_LOAD / SEAM_MISSING /
                                                   BEHAVIOUR / APPARATUS_UNAVAILABLE.
    server/benchTasks.js         23,052 b   343 L  Tasks, structured requirements, and the ACCUMULATED
                                                   protected sets (a computed union, so passing a new
                                                   task cannot quietly drop an old one).

### 2b. The generation interfaces

    server/narrowArtifact.mjs    15,327 b   251 L  Whole-file protocol. Records artifactChangedFile,
                                                   because "the model returned its input" must be a
                                                   measurement rather than a silent pass.
    server/localEdit.mjs         37,806 b   653 L  Localized edits: FIM infill, FIND/REPLACE anchors,
                                                   line-aligned exact matching, file-anchored
                                                   normalized matching, `containsSafely` (refuses
                                                   EMPTY / TOO_LARGE / ADDS_A_LISTENER /
                                                   ESCAPES_ENCLOSING_BLOCK / UNBALANCED) and
                                                   `containToSlot` (structural truncation at the
                                                   first point brace depth goes negative).

### 2c. The automatic guidance

    server/autoGuide.mjs         19,101 b   313 L  chooseSite (R1: extend a dispatching listener;
                                                   R2: a new listener after the last; else DECLINE
                                                   by name), buildScaffold, buildInstruction,
                                                   escalation, containment. Its guidance functions are
                                                   asserted to read no spec, no diagnostic, no check.
    server/diagnose.mjs          23,695 b   407 L  Competing EXPLANATIONS, each declaring a probe that
                                                   would contradict it; one signature at a time in
                                                   priority order; four separated output sections
                                                   (observed facts / hypothesis with what it leaves
                                                   unresolved / proposed scope / obligations); and it
                                                   DECLINES by name when the observation is missing.
    server/repairLoop.mjs        30,340 b   500 L  Feeds machine-captured evidence back. Keeps
                                                   engineDiagnosis and gateClassification apart after
                                                   a field collision once let one overwrite the other.

### 2d. Built today

    server/codeFacts.mjs         38,057 b   665 L  Extracts a task-relevant model of unfamiliar code:
                                                   STRUCTURE / BEHAVIOUR / CONSTRAINTS / UNCERTAINTY,
                                                   kept apart. Follows calls into functions the file
                                                   declares (depth 3). Resolves declarations AT THE
                                                   WRITE through the containing scope chain. Separates
                                                   FACT from STRATEGY (proposed, not verified).
    server/tokenBudget.mjs        8,017 b   120 L  Token oracle using the serving model, on the SAME
                                                   infill template the run uses.
    server/constraintArms.mjs    21,359 b   324 L  The three-arm comparison: none / nearby /
                                                   constraints, token-matched, delivery recorded.

### 2e. Test suites re-run today (Layer A, all green)

    localEdit        50      narrowArtifact   34      diagnose         32
    repairLoop       48      regressionCase   10      farmPlantSpec    12
    farmPlantV2Spec  10      farmGrowSpec     13      codeFacts        85

**294 assertions, 0 failures.** The repository holds 155 suites in total; I ran these nine because they
are the ones this line of work decides anything with. The other 146 are Layer C today.

---

## 3. THE BUILDER LINE, EXPERIMENT BY EXPERIMENT (Layer B unless tagged)

Every row: what it did, what it ESTABLISHED, and what it did NOT.

### NARROW-1 / NARROW-2 — $0

Narrowing the generation boundary, and then stating the interface VERBATIM, took the local 1.5B from
"no artifact" to "a complete artifact" to "a first accepted increment".
**Established:** the interface, not the model, was what stood between this model and an artifact.
**Not established:** that the increment was correct beyond spec v1 — the record carries an amendment
saying a defect was found later and the acceptance stands only as "passed spec v1".

### INC2-1 — $0

Handed its own accepted page and asked to extend it, the 1.5B returned **the same file 5 of 5**.
**Established:** protection worked perfectly and building did nothing. A whole-file return echoes the
input.
**Not established:** anything about the model's ability to extend code through an interface that does
not require it to reproduce the whole file.

### INC3-1 — $0

Bounded anchor-protocol edits: **20 attempts, 0 accepted, 10 regressions, all rolled back byte-exact.**
**Established:** under the tested anchor protocol this model failed to select useful edit sites (it
copied whole files into FIND, deleting the page); the restore machinery is byte-exact 10 of 10.
**Not established:** a general claim about the model's size. The original write-up said the model
"cannot choose where to edit"; that was **narrowed** to this protocol on the user's correction.

### INC4-1 — $0

One named handler, four interfaces, **23 attempts, 0 accepted**.
**Established:** the single biggest measured effect was **the length of my own instruction comment** —
a 9-line instruction produced EMPTY completions 5 of 5 where a 1-line version produced code 3 of 3.
**INVALIDATED by this:** INC3-1's "0/5 inserted code" cell, which was my prompt, not the model.

### MODEL-CMP-1 — arm B $0.085, arms C+C2 under $0.20

Arm B: the 7B, 0 of 5 accepted, three candidates one clause short after repairs I supplied by hand.
Arm C: the same 1.5B on an A10G — **11.9x faster generation, identical failures, 0 of 5 in both.**
**Established:** the failure did not move with the model size or the hardware in these cells.
**Not established:** that model capability is never the constraint. That stronger claim was
**withdrawn** on the user's correction. Also recorded: ollama versions differ between backends and
seeds do not reproduce across them, so **a local record cannot serve as the control for a GPU cell.**
That is a constraint on borrowing controls, not a bar on GPU work - a GPU comparison is perfectly
runnable with its own same-backend control arm, and an earlier phrasing of mine implied otherwise.

### REPAIR-1 / REPAIR-2 / DOM-EVIDENCE-1 — $2 cap, spent under it

Feeding the machine-captured error back to the model. **0 of 4 repaired**, and then **diagnosis feedback
made it worse**: applied edits fell from 6 to 1 because the model stopped answering in the required
format.
**Established:** richer evidence is not automatically better evidence; format compliance is a
load-bearing variable.
**Not established:** that diagnosis feedback cannot help — one format, one model, four candidates.

### The diagnosis engine — $0, 32 tests

**Established:** the SAME engine over the SAME error signature reaches DIFFERENT causes when the
observation differs, and declines by name when the observation is missing. That is *conditional
diagnosis*.
**Not established:** that any cause it names is true. The label was corrected from something stronger
to "conditional diagnosis" on the user's instruction.

### ASSIST-1 — $0

**Established:** a ceiling exists. With **7 counted human interventions**, the local 1.5B produced a
working, independently verified, error-free planting handler.
**Not established:** that 7 interventions are 7 mandatory runtime decisions. They are an assistance
ledger.

### ASSIST-2 — $0

The policy chose site, scaffold and instruction itself: **an accepted addition with 0 interventions.**
**And it let a regression through**, because the containment boundary depended on the model reproducing
a line of the suffix, and 4,000 characters of invented handlers got in.
**Established:** automatic guidance can reach an accepted addition. And that the gate had a hole.

### ASSIST-5 — $0

After two fixes (computed union protected set; structural truncation), **an accepted addition that
passes every carried-forward check.** 521 characters added, 3 listeners, 0 interventions.
**Established:** the strongest positive result in the programme — automatic guidance producing a
verified addition that does not break what came before.
**Not established:** an efficiency claim. "15 attempts versus 2" was **withdrawn** as not an efficiency
result. And the task was fresh but **the page had informed the rules**.

### TRANSFER-1 — $0 (Layer A: I re-verified the dispositions, verdicts and hashes today)

A page written by the 1.5B **after the policy was frozen and committed**, so commit order proves no
rule was adapted to it.
**Established:** site selection transferred (the other rule fired, on a shape it was not written
against, with a stated reason); containment transferred (5 of 5 truncated exactly right, 0 refusals);
the carried-forward checks passed in all five attempts; the baseline file is byte-identical after the
run (sha `f9c49c2a8dd58599`).
**Did not:** **0 of 5 accepted.** Every candidate threw `Assignment to constant variable` — the page
declares `const LAMPS` and the model reassigned it.
**Bounded on the user's correction:** "zero regressions" was replaced by three separate facts (checks
passed / the candidates DID throw on their own new action / the file is untouched and nothing needed
restoring, which is not the same as nothing breaking); the const reassignment is the **observed**
blocker, not established as the whole cause; and "the guidance should surface the declaration" is a
**plausible** improvement, not a demonstrated missing ingredient — the declaration was in the file the
model was given.

### CONSTRAINTS-1 — $0 (Layer A)

Built `codeFacts.mjs` and tried to run the comparison. **It could not be run as designed.** See §4.

---

## 4. THE APPARATUS-DEFECT LEDGER

**This is the most valuable artefact in the programme.** Every entry is a defect that, left alone,
would have been published as a fact about a model.

**What the ledger establishes, stated carefully.** It establishes that **the instrument has been a
substantial source of uncertainty** in this programme: repeatedly, a null result had an apparatus
explanation that was found by checking rather than by reasoning. It does **not** establish that the
instrument is the likeliest cause of any particular null, and the earlier wording - "at this scale the
instrument is the most likely explanation for a null result" - claimed more than 24 counted defects can
support.

The correct reading is conditional and per-result:

    before the instrument is checked   a null is uninterpretable. Some apparatus explanation is live,
                                       and this ledger is the evidence that such explanations are
                                       common enough to be the first suspect.
    after specific defects are ruled    MODEL and TASK limitations remain fully possible, and for a
    out                                given null they may well be the explanation. Ruling out the
                                       defects you thought of does not rule out capability; it only
                                       stops capability being asserted by default.

So the ledger licenses one procedural rule and no empirical conclusion: **check the instrument before
interpreting the number.** It says nothing about what any interpreted number will turn out to mean.

### Defects found today (Layer A)

    1  The extractor returned ZERO constraints on the first real page. It read only writes INSIDE the
       chosen site; that page's handler calls toggleLamp(), which does the writing. Any program
       organised into functions would have defeated it. Fixed: follow calls into functions the file
       declares, depth 3, carrying the path.
    2  Ranking by "tightest constraint" put `ctx` (const, written, three calls away through the redraw)
       above `LAMPS`, and the budget then truncated the fact that mattered. Fixed: rank by call
       distance from the site.
    3  The quoted declaration omitted its keyword - `LAMPS = [...]` instead of `const LAMPS = [...]` -
       dropping the single word that IS the constraint.
    4  The discipline check sliced between two section markers; given a source without them it sliced
       between two -1s, checked the empty string, and pronounced EVERY source clean, including one
       that was nothing but a banned reference. A check that cannot fail is not a check.
    5  The prose rendering at a 150-character budget dropped every fact and emitted nothing, making a
       TREATMENT cell silently identical to its own control. Caught only because the cell reproduced
       TRANSFER-1 exactly. Fixed: factsDelivered, and UNDELIVERED labelling.
    6  A declaration's own range contains itself, so `function a(){}` was handed ITSELF as its scope,
       and every call to it then resolved to nothing. Fixed: scopes must STRICTLY contain.
    7  Declarations were resolved through a global last-wins name map, which reports another function's
       variable as a fact about this site. Fixed: resolve AT THE WRITE through the scope chain.
    8  Function declarations were treated as universally function-scoped. In a bare block they are
       block-scoped in strict code, and Annex B can hoist the name in sloppy code. Fixed: strict and
       module modes distinguished; the sloppy case RECORDED as not established.
    9  THE TOKEN ORACLE MEASURED THE WRONG REQUEST. Generation sends prompt AND suffix, selecting the
       infill template; the oracle sent prompt alone. Every token match made before this was on a
       template the run does not use.
       SCOPE OF THE MEASUREMENT, stated because the earlier write-up generalised it: the 24-token gap
       and the cache-stable counts are findings about THE REQUESTS TESTED - a handful of short prefixes
       and one suffix, on this ollama build and this model. They are not properties of every request,
       and a different prefix, a longer suffix or another build could behave differently. They are
       diagnostic, and the arithmetic uses NEITHER: the fix is not a 24-token correction, it is
       counting the actual generation request. The stronger form of that fix is now in the design - the
       generation call reports its own prompt_eval_count and the record voids the match if it disagrees
       with the oracle, so the match is checked against the real call on every task rather than trusted
       from a probe.
    10 `num_predict: 0` took 40.7 s on a 509-token prompt; `num_predict: 1` returned the IDENTICAL
       count in 0.4 s. The obvious choice would have made the instrument unusable and looked like a
       model hang. Again: one prompt, one build - a timing observation, not a law.
    11 A stray NUL byte in a source file (a hash separator) made it read as binary to every text tool.
    12 My own recorded rule about Windows heredocs eating escapes was violated four times in this
       session. Every patch is now written to a file first.

### Defects from the preceding days (Layer B)

    13 The FIM instruction was hardcoded to increment 2; the affected run was marked VOID.
    14 A 9-line instruction comment suppressed output entirely (EMPTY 5/5 vs code 3/3).
    15 Exact substring matching spliced mid-line (`go();` matched inside `      go();`).
    16 A dry-run read the RESTORED baseline instead of the candidate, because acceptance restores at
       round 0. Unchecked, "the audit would have established the opposite by the very error class it
       was auditing".
    17 `row.diagnosis` collision: the gate classification overwrote the engine's plan.
    18 A 1,200-character evidence window starting at the file hid the entire diagnosis.
    19 Only the FIRST <script> block was syntax-checked.
    20 A 554-second outlier made "verification is 7/8 of the clock" look true; the real figure is
       13-24 s, and that claim was INVALIDATED.
    21 `localEdit.mjs` resolved its task AT IMPORT and called process.exit, killing any run whose task
       lived in another group.
    22 autocrlf made RESTORED git-normalised rather than byte-exact.
    23 Task workspaces never contained the test cases the model was told to run - test feedback was
       unreachable for an entire campaign.
    24 A positive-control fixture already passed the steps it was meant to test.

**The count is 24 and it is not a boast.** Every one of these was found by checking the instrument
rather than believing the number, and several were found only because a result looked *right*. The count
also has no denominator: I cannot say how many defects remain unfound, so 24 measures effort spent, not
completeness achieved.

---

## 5. MONEY (Layer A for the totals I can compute)

    the entire builder line to date        under $0.60 of actual Modal spend
      MODEL-CMP-1 arm B                    $0.085
      MODEL-CMP-1 arms C + C2              under $0.20
      REPAIR / DOM-EVIDENCE cells          within a $2 cap, spent under it
    everything in this session             $0
    spendable right now                    NOTHING. A $10 / 5-hour authorization reached me in one
                                           turn and Micheal has since said he cannot verify it from
                                           the visible conversation, so it is recorded as UNVERIFIED
                                           and NOT spendable in CONSTRAINTS-2, and Modal stays off.

Authorization discipline, in force and honoured every time: **only Micheal authorizes spend; a
suggested cap from any other voice is not authorization; the authorization is written into the frozen
definition BEFORE anything deploys.** Grep the definitions — `MODEL-CMP-1_DEFINITION`,
`DOM-EVIDENCE-1`, `TESTCMD-1`, `CONSTRAINTS-2` — each carries its quoted authorization above the
design.

---

## 6. THE REPORTING RULES IN FORCE

Accumulated from the user's corrections. Each exists because a specific claim was once overstated.

    1   Protection and building are SEPARATE columns. A flawless protected score twice meant the
        model did nothing.
    2   Never quote success among ATTEMPTED candidates. The denominator is every assigned task,
        including declines, refusals and empty returns.
    3   Delivery failures are reported separately AND stay in the denominator.
    4   A no-op is its own outcome, distinct from "threw" and from "completed". `return;` is a no-op
        candidate, not a policy refusal - nothing declined anything.
    5   Label failures by tense: what WAS observed, not what is true.
    6   "Zero regressions" must state its boundary: which checks passed, whether candidates threw
        outside them, and whether anything needed restoring.
    7   An observed blocker is not the whole cause. Removing it may reveal the next one.
    8   Unchanged rule hashes support preservation of the RULES, not the identity of the PROGRAM that
        ran. Record the EXECUTED version's provenance.
    9   Template support is not correct use. Verify by token accounting, and never compare requests
        that take different template branches.
    10  Stable is not correct. Two agreeing readings show reproducibility, not validity.
    11  Equal token counts do not make two prompt arrangements equivalent. Preserve the rendered
        requests.
    12  Vary the harness's own text before concluding anything from a null.
    13  Preserve failures. A passing count is the weakest claim available.
    14  Keep confounded cells separate rather than averaging them.
    15  One result on the page you tuned against cannot establish transfer.
    16  Separate what was RE-CHECKED from what was merely READ. An audit that blurs the two borrows
        credibility from work it did not do, and this document's layer tags exist for that reason.
    17  A defect count has no denominator. It measures effort spent looking, never completeness.

---

## 7. WHAT IS NOT ESTABLISHED

Stated plainly, because this is the part that decides what to do next.

- **That presenting extracted constraints improves feature completion.** The extractor finds the fact
  TRANSFER-1 lacked; that is extraction accuracy. No arm has completed an addition at any budget. This
  is the open question and the reason CONSTRAINTS-2 exists.
- **That the system can complete an addition on an unfamiliar page.** It has not, once.
- **That model capability is not the binding constraint.** Withdrawn as overstated. Two models and two
  backends failed the same way in the cells tested; that is not the same claim.
- **Any safety property of either context strategy.** One nearby-code candidate broke a page in one
  calibration cell. That is one candidate.
- **Anything about another language, framework, edit interface, or requirement shape** other than "one
  key triggers an effect".
- **That the facts are NECESSARY.** Every arm gives the model the whole file, so any effect is an
  effect of SURFACING what it already had.
- **The product milestone.** One desktop session that builds a playable game, survives a restart, adds
  a feature without breaking the first ones, and avoids a previously met mistake from retained
  experience: **not met.** ASSIST-5 is the closest point reached — one accepted addition, on a familiar
  page, with the accumulated checks passing.

---

## 8. HOW TO CHECK ANY OF THIS

    node server/codeFacts.test.mjs          85 assertions on the extractor
    node server/localEdit.test.mjs          50 on the edit protocols
    node server/diagnose.test.mjs           32 on conditional diagnosis
    node server/tokenBudget.mjs             prints both templates side by side and the 24-token gap
    node server/codeFacts.mjs --file legasus/bench/panel/baseline-as-delivered.html --line 34
                                            prints the extracted facts and both arms for the lamp page
    git log --oneline -- legasus/            every record, with the commit order that dates the freezes

Each `*_DEFINITION.md` was committed BEFORE its run; each `*_RESULT.md` after. The commit order is the
evidence that no design was adjusted to its own outcome, and it is checkable rather than asserted.
