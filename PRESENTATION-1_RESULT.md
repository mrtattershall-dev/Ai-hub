# PRESENTATION-1 RESULT — instruction location changed the failure, not the outcome

2026-09-29, $0, local `qwen2.5-coder:1.5b` Q4_K_M digest `d7372fd828518a4d`. 12 pages x 3 conditions,
one call each, seed 1. Definition frozen and amended once before the run; re-scorer frozen before any
output was inspected.

## 1. Eligibility — 12/12

Every baseline lacked the control, and every emitter record carried both necessary conditions.

## 2. Byte delivery — verified, not assumed

All three conditions were sent with `raw: true` carrying the serialized wire. For s01 the recorded
`wireSha` matched the audit exactly in all three cases (`0237e0fc…`, `9905b5f4…`, `ccc0633c…`), and the
code prefix and suffix were **byte-identical across N, H and S** on every page.

## 3. The four-way split

| condition | wrote nothing usable | local reference only | feature constructed | accepted |
|---|---|---|---|---|
| **N** native-FIM / inline comment | **12** | 0 | 0 | **0** |
| **H** front-loaded wrapper / inline comment | **12** | 0 | 0 | **0** |
| **S** front-loaded wrapper / separated intent | 0 | **12** | 0 | **0** |

**The live text-heuristic tally and the state-verified re-score agree exactly** — 0/0/12 local either
way, 0 constructed either way. The inflation path the re-scorer was built to catch existed and did not
fire on this data. Both numbers are kept.

## 4. N / H / S

Against the pre-registered table this is **`H ≈ N, S > H`** on the intermediate measures and
**all-similar** on acceptance.

- **N ≈ H exactly.** Both produced **zero candidates**. Every completion was refused at containment.
- **S produced executable, locally-correct code on all 12 pages**, and a spliceable candidate on 6.
- **No condition produced a constructed feature or an accepted artifact.**

### What N and H actually emitted

    N s01   "</body>\n</html>"                        7 tokens
    H s01   "</html>\n\n\n\n\n\n\n\n\n…"               0 tokens

With intent in an inline comment, the model **closed the document**. It did not attempt the task.

### What S emitted

    S s01   document.getElementById('clear-filter').addEventListener('click', function () {
              field.value = ''; filterRows(); });   </script></body></html>

Correct local logic, the page's own `field` and `filterRows` — then it **kept going past the hole** and
emitted the closing tags, which containment refused as wrong-slot-language. Six of twelve did this.

    S s02   field.addEventListener('clear-filter', function () { field.value = ''; refine(); });

Reached the gate and failed: it bound a listener for a **non-existent event type** `'clear-filter'` on
the existing field, rather than creating a control.

## What this supports

**Instruction location changed what the model did with the slot.** Inline-comment intent produced
document-closing in 24 of 24 attempts across two conditions. Separated intent produced page-aware
executable code in 12 of 12. That is a large, consistent difference on the same bytes of code.

**It did not change the outcome.** Zero accepted in every condition. S's failures are *different* —
overrunning the hole, or inventing an event name — and none is a constructed feature.

**The wrapper alone did nothing** *while intent remained an inline comment*: H ≈ N, and per the
amendment that is all it licenses. The wrapper may still interact with location; S carries both changes.

## What it cannot support

- **Nothing about IFIM training efficacy.** S is an inference-time surrogate with the instruction
  **202 tokens** from the middle; the strongest published format places it adjacent. A different result
  at that distance would be a different experiment.
- **Separation is not isolated from distance.** They move together by design, and the 18/18/202
  measurement is why that is visible.
- **Nothing about structure.** No AST/function-body condition ran, deliberately.
- **Not proof of equivalence on acceptance.** Three zeros at n=12 is *no difference detected*.

## The finding worth carrying

The failure mode moved from **not attempting the task** to **attempting it and overrunning or
mis-binding**. A binary acceptance rate reads 0-0-0 and sees nothing. The decomposition shows the
representation changed where the model fails, which is the fact a router would need — and also shows
that on this task class, moving the failure was not enough to move the outcome.

The **completion-horizon** hypothesis now has direct support from S's six overruns: the model produced
correct code and did not stop at the hole.
