# Deployment-and-capability matrix

2026-09-29. One table per result, showing every layer, the task class, what was observed, and what
alternative explanation survives. **The subject is a deployed stack, never "a 1.5B".**

## The stack, now fully identified

| layer | value | source |
|---|---|---|
| upstream checkpoint | **Qwen2.5-Coder-1.5B**, `huggingface.co/Qwen/Qwen2.5-Coder-1.5B` | `model_info.general.base_model.0` |
| variant | **Instruct** | `model_info.general.finetune` |
| quantization | **Q4_K_M** (`file_type: 15`) | package details |
| ollama digest | `d7372fd828518a4d38b1eb196c673c31a85f2ed302b3d1e406c4c2d1b64a0668` | `/api/tags` |
| ollama version | **0.33.3** | `/api/version` |
| declared capabilities | **`["completion","tools","insert"]`** | `/api/show` |
| template | three branches: FIM on `.Suffix`; chat on `.Messages`; chat-with-persona otherwise | package template |
| persona | "You are Qwen, created by Alibaba Cloud. You are a helpful assistant." | package system |
| decoding | temperature 0.2, `num_predict` per study, seeds declared | run records |
| llama.cpp backend version | **still unrecorded** — `/api/show` does not expose it | — |

### Two corrections to MODEL-DOSSIER-1

1. **Lineage is NOT unknowable from the local package.** The dossier said `parent_model: ""` and filed
   "which upstream checkpoint" as unanswerable here. That field is empty — but
   **`model_info.general.base_model.0` carries the upstream repo, and `general.finetune` says
   `Instruct`.** I checked one field and generalised from it.
2. **The package declares a `tools` capability.** So the operator arm did not merely fail to use the
   template's tools branch — it ignored a capability the package advertises. Arm B measured an invented
   syntax.

## Task taxonomy — these are not one problem

| class | definition | Legasus artifacts |
|---|---|---|
| **completion** | fill a missing unit that already belongs to the program | *none yet* |
| **extension** | add behaviour to working software | FARMEXT-1 |
| **construction** | create a new feature plus its UI and wiring | SUPPRESSION-1, PRESENTATION-1, AUDIT-2 |
| **repair** | fix a known failure | REPAIR-1/2 (historical) |
| **evolution** | preserve many prior features across changes | AUDIT-2 stage 4 |

**FIM research mostly measures completion. Every current Legasus page task is construction.** Treating
them as one problem is how a benchmark quietly lies — and it is why no AST/function-body condition has
run: there is no completion task in the benches to run it on.

## Result ledger

| claim | label | scope | surviving alternative explanation |
|---|---|---|---|
| localized edits give smaller output per verified repair (94 vs 278 tokens) | **reproduced here** | 7B, filter construction | none material |
| the slot-language contract took wrong-language output 18/40 to 0 | **reproduced here** | 7B, filter construction | none material |
| the manager improves completion or preservation for a 7B | **contradicted here** | small single-page construction | task set at ceiling, both arms 6/6 |
| narrowing produced a working farm artifact | **contradicted here** | farm | the only acceptance fails the corrected gate |
| bounded edits beat whole-artifact on farm | **plausible, untested** | — | no such contest was ever run |
| free-form beats constrained dialects for this package | **reproduced here** | 12 filter pages, Q4_K_M | **confounded with template path** — chat and FIM moved together |
| instruction location changes the failure mode | **reproduced here** | 12 filter pages | none material; 24/24 against 12/12 is large and consistent |
| instruction location changes the outcome | **contradicted here** | 12 filter pages | 0 accepted in all three conditions |
| the model has a completion-horizon deficit | **withdrawn** | — | five of six were the harness failing to cut a re-emitted suffix |
| feature **assembly** is a distinct capability boundary | **plausible, untested** | — | 0/12 created the control while 12/12 used local symbols |
| an evidence-governed router beats fixed methods | **plausible, untested** | — | no router exists, no held-out set |

## Alternative explanations still open, per result

**PRESENTATION-1 — 0 accepted, all conditions.** Open: Q4_K_M specifically; the *construction* task
class rather than the representation; the 202-token instruction distance; feature assembly as a
boundary. Closed by check: prompt leakage, byte-delivery drift, partial-credit inflation.

**SUPPRESSION-1 — 12/12 chat, 0/12 constrained.** Open: template path confounded with output shape;
Q4_K_M; one task family. Closed by check: answer leakage, structural drift, echoed input.

**AUDIT-2 — manager falsified.** Open: ceiling effect at 6/6 for both arms; pages written by me; one
model. Closed by check: a broken control — it was proved able to win first.

## Rules this produces

1. **Prose, regex matches and self-explanations never count as construction. Observable state does.**
2. **A recovered pass is `ACCEPTED_AFTER_FIM_SUFFIX_RECOVERY`, never equivalent to a native clean
   stop**, until that rule has its own held-out validation. **FIM-BOUNDARY-1 is not built**, and the
   recovery rule is **not retrofitted** to PRESENTATION-1.
3. **No result is "the 1.5B's" until a second quantization reproduces it.**
4. Authority research and capability research stay separate: *can we constrain and verify what the
   system does* is a different question from *what can it reliably generate*.

## Deliberately not built

Memory · an autonomy layer · a representation router · any general coordination layer. Each needs
evidence that it improves a declared metric, and none has it.
