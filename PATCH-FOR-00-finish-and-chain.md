# Patch proposal for ai-native-engine-00 — agent.js, two changes

From Session A (ai-native-engine-75). **I have not touched agent.js** — you committed
"Split agent.js, step 2" an hour ago and you are live on the file. This is written as a
patch so applying it is mechanical rather than a re-derivation. Line numbers are from
537d288; they will have moved under the split, so the anchors are quoted code, not numbers.

Both changes address ONE root cause, measured on Qwen2.5-Coder-7B-Instruct:
**a small model does the work correctly and never calls `finish`.**
19 model calls, 0 tool errors, 3 of 4 runs still ended `stopped`.

---

## Change 1 — the auto-finish nudge is gated on `test_web` alone

**Anchor** (~2524):

    let feedback = `TOOL RESULT (${tool}):\n${result}${syntaxNote}`;
    if (tool === 'test_web') {

Everything that nudges toward `finish` lives inside that branch: the
`✅ The app loaded with NO errors ... call finish NOW` feedback, `run.cleanTests`, and the
`cleanTests >= 3` auto-finish. A goal verified with `run_command` or `run_python` — which is
how EVERY non-browser goal proves itself — gets none of it.

**Why it matters more than it looks:** self-termination is the single thing small models are
worst at. The 30B finishes on its own, so this asymmetry is invisible until a 7B is pointed
at it — and a 7B is what runs locally in December.

**The predicate needs care and I want to flag the trap rather than pretend it is obvious.**
`run_command` is not `test_web`. It also runs `ls`, `npm install`, `cat`. Counting any
exit-0 command as a clean verification would auto-finish a run after three directory
listings. Suggested narrowing — a clean verification requires all of:

  - the command exited 0 (for the current shape, `/EXIT: 0/` in `result`), AND
  - this run has already completed at least one successful MUTATING tool call
    (write_file / edit_file / append_file), so there is something to have verified, AND
  - the command names a file this run actually wrote — otherwise `ls` qualifies

Sketch, deliberately conservative — the feedback line is the valuable half; the auto-finish
is the part worth being strict about:

    const VERIFIERS = new Set(['test_web', 'run_command', 'run_python']);
    if (VERIFIERS.has(tool)) {
      const hasErr = tool === 'test_web'
        ? /\[JS ERROR\]|\[console\.error\]|\[HTTP \d/.test(result)
        : !/EXIT: 0\b/.test(result);
      // A clean verification only counts if it verified something THIS run produced.
      // Without that, three `ls` calls auto-finish a run that has written nothing.
      const verifiedOwnWork = tool === 'test_web'
        || ((run.wroteFiles || []).some((f) => String(args.command || args.code || '').includes(f)));
      ...
      // nudge on every clean verification; auto-finish only when verifiedOwnWork
    }

You will need `run.wroteFiles` (or reuse whatever the finish gate already tracks — it
already knows which files were written this run for the `touchedWeb` logic above).

**Measured cost of not doing this:** goal 1 took 74s to do the work and another 34s of
repair to notice it was done. ~50% of GPU time, on a card doing 11 tok/s.

---

## Change 2 — one `stopped` goal strands the entire rest of the queue

**Anchors** (~2609 and ~2622):

    if (run.status === 'done' && !run.depth && run.queueItemId) {
      try { workQueue.complete(run.queueItemId, { status: 'done', runId: run.id }); }

    if (supervisorEnabled && run.status === 'done' && !run.depth) {
      try {
        const next = workQueue.dequeue({ completedIds: completedQueueIds() });

**Reproduced live**, six chained goals, 7B on an L4, after five minutes:

    stopped   6bc049ee  after= -         goal 1
    done      5edabe82  after= -         goal 1 REPAIR      <- repair succeeded
    stopped   c8496c16  after= 5edabe82  goal 2
    stopped   47f93a27  after= -         goal 2 REPAIR      <- repair also stopped
    queued    00e11644  after= 47f93a27  goal 3   <- waits on a STOPPED item, forever
    queued    1d5754c1  after= 00e11644  goal 4
    queued    1362c176  after= 1d5754c1  goal 5
    queued    e57fe001  after= 1362c176  goal 6

Goals 3-6 unreachable; the window idled 15 minutes with a warm GPU billing. This is the
"It's idle" tatte flagged earlier, and it is not one-off.

Your `/queue` handler ALREADY computes this — it returns
`blocked: waits on X, which ended as 'stopped'`. The hub knows it is stranded and says so.
Nothing acts on it.

**Your comment is right and I am not arguing with it:**
"moving on to the NEXT goal after a failure compounds it instead of surfacing it."
On a 30B that holds. The assumption that breaks is `stopped` == failure. On a 7B `stopped`
is the normal terminal state of a SUCCESSFUL goal.

**Proposed: distinguish "did the work, could not say so" from "could not do the work."**

    // A run that made real progress and simply never emitted `finish` is not a failure,
    // and halting the chain on it strands every goal behind it. Measured on a 7B: 0 tool
    // errors across 19 calls, and 3 of 4 runs still ended 'stopped' with correct files on
    // disk. This does NOT advance after a genuine failure - errorCount must be 0 AND the
    // run must have successfully mutated something.
    const productiveStop = run.status === 'stopped'
      && !run.errorCount
      && (run.wroteFiles || []).length > 0;

then treat `run.status === 'done' || productiveStop` as the advance condition in BOTH
places above. If you would rather not auto-advance, the weaker version still fixes the
stranding: mark the queue item `done` (change 1's anchor) but do not dequeue the next —
the supervisor tick picks it up on its own within `AGENT_TICK_S`.

**Change 1 is the cause and Change 2 is the safety net.** If Change 1 lands well,
`stopped` largely stops happening and Change 2 rarely fires — which is the right shape.

---

## Reproduction

    MODEL_BASE=https://mr-tattershall--coder7b-l4-server-web.modal.run \
      MODEL_NAME=coder7b node server/prove7b.mjs 20

~5 minutes to strand. Endpoint is deployed and warm. Six goals covering create / append /
surgical edit / multi-site edit / python / docs-from-real-code.
