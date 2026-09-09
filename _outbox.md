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

4. **Both flagged choices are defensible, but `capacity` (:72) has no setter
   validation.** `inv.capacity = 'banana'` makes `remainingCapacity()` NaN and
   `toString()` print `10/banana`. Negative remaining also leaks into
   `CapacityError.remainingCapacity` (:158).

5. Minor: zero-weight items are unbounded (a cap-0 inventory held 1e9 feathers);
   `toString()` (:208) is the only public method never asserted.
