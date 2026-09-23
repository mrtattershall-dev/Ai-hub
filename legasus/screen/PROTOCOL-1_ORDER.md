# PROTOCOL-1 RUN ORDER — recorded BEFORE generation

Fixed here so the sequence cannot be chosen after seeing any result.

## Interleaved, in pairs, alternating which arm goes first

| # | task | arm |
|---|---|---|
| 1 | t1-repair-node-average | CONTROL |
| 2 | t1-repair-node-average | TREATMENT |
| 3 | t2-repair-python-parse | TREATMENT |
| 4 | t2-repair-python-parse | CONTROL |
| 5 | t3-add-node-median | CONTROL |
| 6 | t3-add-node-median | TREATMENT |
| 7 | t4-add-python-slugify | TREATMENT |
| 8 | t4-add-python-slugify | CONTROL |
| 9 | t5-multifile-node-discount | CONTROL |
| 10 | t5-multifile-node-discount | TREATMENT |

**Interleaved, not all-control-then-all-treatment**, so backend drift, warm-up and any
time-varying condition fall on both arms roughly equally.

**Paired and adjacent**, so that if the total budget truncates the run, it truncates on a
COMPLETE PAIR. An arm that got one more task than the other would not be comparable, and
truncating mid-pair is the most likely way that happens.

**Alternating which arm leads** (C,T | T,C | C,T | T,C | C,T), so first-position advantages —
a colder or warmer backend at the moment of the pair — do not accumulate on one arm.

## Conditions, unchanged from Amendment 2

- each task from **its own seed** in both arms; `chain: false`, no accumulation
- 300s per task, 30 minutes total, 120s reserve, **no retries, no rescue instructions**
- identical model, backend, tools, worker, evaluator and acceptance policy
- the only difference is `AGENT_PROTOCOL=1`

## Preserved regardless of outcome

Refusals, attempted actions and terminal behavioural results are recorded **even when no tools
execute**. A treatment run that executes nothing still has a result: what it proposed, what the
gate refused, and what the workspace looked like at termination.

## Reading rule, fixed in advance

Zero accepted work in the treatment arm does **not** by itself establish that the controller
suppressed generation. If the model proposed actions and the gate refused them, the direct
observation is **execution blocked by the controller**. Whether that cost useful work depends on
what those actions were and on the comparison.

A treatment loss is useful evidence about **this controller**. A treatment win would justify a
fresh-task evaluation; it would not establish a general advantage, because these five tasks are
already-inspected development cases.
