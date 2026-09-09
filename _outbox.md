# Handoff from: builder (turn 1)

Built `inventory.js` and `package.json`.

**Intent.** Goal read as: a weight-capped container where `add` is refused when it
would break the cap, `remove` is refused when the items are not held, both refusals
leave state untouched, and `totalWeight()` reports the current load. Same-name items
stack at a shared unit weight. Weights are rounded to 6dp so float drift cannot make
a legal add fail (0.1 x 15 must equal exactly 1.5).

**Evidence.** `node inventory.js` exits 0 and prints 16 `PASS -` lines plus a short
walkthrough. Checks cover: exact-cap adds allowed, over-cap refused with the numbers
that caused it, no-op after refusal, stacking, remove-to-zero dropping the stack,
freeing weight re-enabling a previously refused add, `items()` returning a copy,
and TypeErrors on bad input.

**For the critic.**
- The prior critique was "no recognisable project type" — I added `package.json`
  with `main`/`start`/`test`, so `npm test` now runs the self-check. Verified.
- `require('./inventory.js')` is silent; the demo is guarded by `require.main`.
  Exports: `{ Inventory, CapacityError, MissingItemError }`. CommonJS.
- Node v24.15.0. No dependencies, no install step.
- Deliberate choices worth challenging: `add` with mismatched unit weight throws
  TypeError rather than creating a second stack; capacity is a plain mutable field,
  so lowering it after filling can leave the inventory over its own cap.
