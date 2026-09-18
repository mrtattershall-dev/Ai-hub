# GATE 7 — prospective run of revision 5 on the scope/continuation family

    operations scored 16 (narrowable 10)
    RECOVERED 9   missed 0   OVER-CONSTRAINT 1   correct zero 6
    witnesses replayed 16/16
    realized available information 73.2%  (3.87 of 5.29 bits)
    style control fired on 9 operations and narrowed 0

## `expression_continuation` generalized — PASS on all three of its cases

    PASS  j03  hand-written multi-line literal      fired on 2 ops, recovered 0.64/0.64 bits
    PASS  j05  brackets in strings and comments     fired on 0 ops - correct silence
    PASS  j06  balanced literals and nested calls   fired on 0 ops - correct silence

The literal was hand-written into the source, and path sensitivity was proven in advance: at module
level nothing else could have removed those positions. **This is prospective standing for revision 5.**

## `scope_availability` — the rule worked; the SCORER was wrong

The report said `this kind fired on 0 op(s)` for j01 and j02 and marked both FAIL. Direct inspection
says otherwise:

    j01:op2   immediate ["path"]   scopeProviders(path) -> enclosing_scope/parameter
    j02:op2   provides ["total"]   scopeProviders(total) -> enclosing_scope/local

The rule resolved both. The per-kind counter measures kinds that **NARROWED**, and
`scope_availability` narrows nothing by design — so it can never appear there.

**This is the same instrument defect the inventory had in GATE 1**, fixed there and not here. A
zero-narrowing rule cannot be scored by whether it narrowed. Its own pass criterion made two correct
results look like failures.

## A real modelling gap, found by the same inspection

    j02:op2   `total = total * SCALE`
              provides ["total"]   immediate ["SCALE"]   -- `total` is NOT recorded as required

A self-referential binding reads its target before it writes it. `operationFacts` classifies `x` as
provided and drops the read. Here it changes nothing, because `total` is a local and resolves to
enclosing scope which narrows nothing — but at module level `X = X + 1` genuinely requires the prior
binding, and that ordering constraint would be lost.

Classification: **ARCHITECTURE**, supported, account-level. Its own gate.

## The over-constraint is real under the frozen rule, and its cause is probe coverage

    j01:op3   ownership_boundary removed position 12, which executes fine
              `return self._routes.get(self._aliases[path])`, inside `def resolve(self, path):`

Inserting `def alias` at class indent there genuinely ends `resolve` early and re-parents its
remaining statements into `alias`. The code IS damaged. The delta and preservation probes simply do
not exercise the path that would reveal it, so the executable ground truth records the position as
passing.

`narrowability.mjs` states this limit at the top of the file: *a position that breaks something no
probe observes is counted as passing, so this UNDERSTATES narrowability.* This is the first case where
that understatement produces a **false over-constraint**.

**The frozen scoring rule is not reinterpreted.** Gain counts only if every removed boundary genuinely
fails under executable ground truth; by that rule this is an over-constraint and it stays recorded as
one. The diagnosis is the finding: ground truth is only as strong as the probes that define it, and a
task with thin probes can make a correct rule look wrong.
