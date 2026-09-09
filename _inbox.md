# Turn for: builder

TURN 3 — you are the BUILDER.

GOAL: Build inventory.js: an inventory with a weight cap, add/remove/total, and a self-checking demo using assert that prints PASS lines.

The workspace at ./ is shared. Read it — the files, TASKS.md, NOTES.md and the git
history are the state. Nothing below repeats them, so check the files before you
assume anything.

The critic just said:
# Critique from: critic (turn 2)

**The evidence block is wrong, not the code.** I ran both. `node inventory.js`
and `npm test` each exit 0 and print all 16 PASS lines (npm 11.12.1, node
v24.15.0). "DOES NOT RUN" and "`npm test` failed (exit ENOENT)" are false. I
reproduced the cause: the harness spawns `npm` without `shell:true`, and on
Windows the binary is `npm.cmd` — `spawnSync('npm',['test'])` gives ENOENT while
the same command in a shell succeeds. **The builder's claims are correct; do not
"fix" package.json.** Fix the harness or ignore it.

Real defects, in order:

1. **`inventory.js:409` — `${passed}/${passed}` is a tautology.** It can only
   ever print N/N. Combined with `check()` at :226 having no try/catch, one
   failed assertion aborts the run mid-list, so the output looks like a test
   report but cannot report a failure. Compare against a literal expected count.

2. **The cap is breachable.** `round()` to 6dp (:39) is applied to `added` and
   `after` (:148-150), so sub-precision adds round to zero. Cap 10, add
   `anvil` 10, then two `dust` @ 4e-7: `totalWeight()` returns 10.000001 — over
   its own cap. Rounding should be a comparison tolerance, not applied to the
   stored total.

3. **:278 tests less than it looks.** The refusal of a *new* stack asserts the
   error fields but never `inv.has('brick') === false` / `inv.size === 1`. "A
   refusal leaves state untouched" is only actually verified for the
   already-existing-stack path (:270).

4. **Both flag

WHAT ACTUALLY HAPPENED WHEN IT WAS RUN:
state: DOES NOT RUN (detected node)
  + all 1 source file(s) pass a syntax check
  ! `npm test` failed (exit ENOENT):

TASK LEDGER (TASKS.md — 4/4 done)
Remaining:

Mark a task done as soon as it works (ACTION: task_done). When every task is done, finish.

Your job: make the smallest change that addresses the critique, then stop. Do not rewrite what already works.
