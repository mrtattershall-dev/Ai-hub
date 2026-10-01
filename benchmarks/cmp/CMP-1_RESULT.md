# CMP-1 — three disposition rules on fixed specimens (deterministic, $0)

**2026-10-01.** The capability question behind INC-1B's "give the baseline the cheap fix": given a candidate,
which arms catch damage, and does any arm wrongly refuse clean work? No model — real + fixture specimens
replayed through three rules. Result: `CMP-1.json`, harness `cmp_dispositions.mjs`.

## Arms

| arm | rule |
|---|---|
| BASELINE | `node --check` only (parse) — the ordinary hub's syntactic floor |
| SIMPLE_GUARD | parse + **load the module** (require); refuse if it throws — the cheap ordinary-path fix |
| LEGASUS | run the behavioral checks (seed + every earlier increment); refuse if any fail |

## Specimens

- **Class A — load-throw (4, REAL):** the exact files the model produced in INC-1B — 3 baseline survivors
  and the 1 governed-caught candidate. Each exports a name it never defines; parses, throws on `require`.
- **Class B — loads clean, breaks an earlier increment (3):** the fixture's validated regression mutants
  (break inc1 / inc2 / inc3). Each loads fine and returns wrong behaviour.
- **Clean (4):** the correct reference solution at each increment — the false-refusal control.

## Result

| arm | caught (A / B) | missed | false refusals |
|---|---|---|---|
| BASELINE | 0 (0/0) | 7 | 0 |
| SIMPLE_GUARD | **4 (4/0)** | 3 | 0 |
| LEGASUS | **7 (4/3)** | 0 | 0 |

- **The cheap load-check closes the entire Class A gap** (4/4) — the "export a name you didn't define"
  failures, which were *all three* of INC-1B's real baseline survivors. That guard belongs in the ordinary
  hub; Legasus is not required for this class.
- **Legasus's marginal value over the cheap guard is precisely Class B** (3/3 vs 0/3): changes that load
  clean and break an earlier behaviour. Syntax and load checks cannot see these; running the behaviour can.
- **No arm false-refused clean work** (0/4 each), so the catches are specificity, not a reject-everything
  reflex.

This is the boundary stated exactly: **SyntacticValidity ⇏ ExecutableValidity ⇏ BehavioralValidity.** The
cheap guard advances one step (parse → load); behavioral acceptance advances the second (load → behaviour).

## An apparatus bug the clean controls caught

The first run showed LEGASUS false-refusing all 4 clean specimens. Cause: the fixture check scripts hardcode
`/candidate/` (the Docker worker mount), which does not exist on the laptop, so the Legasus arm was failing
every specimen on module-not-found — "catching" damage for the wrong reason and refusing clean work. Fixed
by rewriting `/candidate/` → `./` under the workspace cwd, so all three arms use identical path semantics.
Without the clean controls this would have passed as a real Legasus column. (Hazard: "prove the code ran";
"fixture blocked by a different guard".)

## What this does NOT establish

- **A rate.** This measures capability per class, not how often each class occurs when the model runs live.
  INC-1B's 3 real baseline failures were all Class A — a hint that Class A dominates in practice, but n=3.
  The paid CMP-LIVE run measures the A:B frequency, which is where Legasus's *practical* marginal value over
  the cheap guard is decided.
