# MODEL-DOSSIER-1 — evidence ledger. Data gathered; causal interpretation paused.

Six questions were set before any further inference. Below: which are answered, by what, and which are
not answerable from here.

## Q6 — do the preserved FIM requests use the exact pattern the package expects? **ANSWERED: yes**

Verified by **token accounting**, not by reading the template — this project has already recorded once
that "template support is not correct use", after proving a FIM suffix "reached the model" from
template support alone.

| request | prompt tokens |
|---|---|
| bare text, `raw:true`, no template | 8 |
| prompt only, templated | **37** |
| prompt + suffix, templated | **13** |
| hand-written `<\|fim_prefix\|>…<\|fim_suffix\|>…<\|fim_middle\|>`, `raw:true` | **13** |

The templated-with-suffix count is **identical** to the hand-written FIM pattern. The FIM branch is
confirmed on the wire. The chat path costs **+29 tokens** over the bare text — persona plus role
markers — before the task is seen.

**So the slot arms really did use FIM, and the whole-artifact arms really did carry the persona.** The
confound named in the dossier is real, and so is the finding that the slot arm failed on the path this
model family is trained for.

## Q2 — does Q4_K_M materially change behaviour? **NOT ANSWERED — but answerable locally, at $0**

Requires a second quantization of the same checkpoint, run through the identical harness and gate. That
is a download and a rerun on this machine, not a hosted experiment. **Until it is run, every result in
this project is a fact about Q4_K_M only.**

## Q1, Q3, Q4, Q5 — **NOT ANSWERABLE FROM HERE**

| question | why not |
|---|---|
| Q1 which upstream checkpoint Ollama packaged into `d737…` | the package declares `parent_model: ""`. No lineage is recorded locally. |
| Q3 Qwen's exact FIM benchmark templates and stop rules | external publication; not on this machine |
| Q4 any independent 1.5B-specific native tool-calling evaluation | external; and see below |
| Q5 published tests of Qwen2.5-Coder with comment-adjacent FIM slots | external |

I have no verified access to that literature here. Anything I produced about those from memory would be
plausible and unreliable in the way that matters — right-shaped citations, wrong details. They belong to
the source map, not to this dossier.

## The two distinctions to carry forward

**A `.Tools` branch in a template proves the wrapper can render tool syntax. It does not prove the
weights can use tools.** My operator arm tested neither: it used an invented `edit_file(...)` syntax on
the chat path. The native branch remains untested.

**An official FIM score proves the checkpoint does well on one standardized FIM distribution.** It does
not establish that a comment-shaped scaffold is a good scaffold. FARMEXT-1's five comments-only
completions are evidence *against* this particular prefix shape, and evidence about nothing else.

## Stance

**Data gathered. Causal interpretation paused.** The three experiments the dossier separates — FIM
prefix-shape, native tool-call, and chat-vs-FIM on a task both paths can express — are each a
single-variable test, and none of them has been run.
