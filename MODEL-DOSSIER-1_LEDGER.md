# MODEL-DOSSIER-1 — evidence ledger. Data gathered; causal interpretation paused.

Six questions were set before any further inference. Below: which are answered, by what, and which are
not answerable from here.

## Q6 — do the preserved FIM requests use the exact pattern the package expects? **ANSWERED: yes**

Verified by **three separate pieces of evidence**, kept separate — this project has already recorded
once that "template support is not correct use", after proving a FIM suffix "reached the model" from
template support alone. The same mistake in a new form would be letting one measurement carry two claims.

| request | prompt tokens |
|---|---|
| bare text, `raw:true`, no template | 8 |
| prompt only, templated | **37** |
| prompt + suffix, templated | **13** |
| hand-written `<\|fim_prefix\|>…<\|fim_suffix\|>…<\|fim_middle\|>`, `raw:true` | **13** |

The chat path costs **+29 tokens** over the bare text — persona plus role markers — before the task
is seen.

**1. The template routes suffix requests through the FIM markers.** Read from the package: an
`if .Suffix` branch emitting fim-prefix / fim-suffix / fim-middle. Establishes what the wrapper *can*
do, and nothing about what ran.

**2. Token count matches the hand-written pattern, 13 = 13.** Establishes a **same-length** wrapper.
It does **not** establish token identity: a different wrapper of equal length scores the same. An
earlier draft of this ledger made this one number carry both claims, which was wrong.

**3. Behavioural identity, under a control that can discriminate.** At temperature 0 with a fixed
seed, on an input where the suffix *determines* the middle — it must define the very name the suffix
returns — the templated request and the hand-written FIM request produced **byte-identical output**,
while a decoy carrying a different suffix produced **different** output.

> The control earned its place. The **first** version of this test used an input the model answered
> identically whatever the suffix, so its "IDENTICAL" verdict proved nothing — and the control said
> so outright. Only the second input discriminates. Without the decoy, a vacuous confirmation would
> have been recorded as evidence.

Together these are strong evidence that the intended FIM branch ran. **No single one carries it.**

**So the slot arms really did use FIM, and the whole-artifact arms really did carry the persona.** The
confound named in the dossier is real, and so is the finding that the slot arm failed on the path this
model family is trained for.

## Q2 — does Q4_K_M materially change behaviour? **NOT ANSWERED — but answerable locally, at $0**

Requires a second quantization of the same checkpoint, run through the identical harness and gate. That
is a download and a rerun on this machine, not a hosted experiment. **Until it is run, every result in
this project is a fact about Q4_K_M only.**

## Q1, Q3, Q4, Q5 — **not answerable from the local package**

| question | why not |
|---|---|
| Q1 which upstream checkpoint Ollama packaged into `d737…` | the package declares `parent_model: ""`. No lineage is recorded locally. |
| Q3 Qwen's exact FIM benchmark templates and stop rules | external publication; not on this machine |
| Q4 any independent 1.5B-specific native tool-calling evaluation | external; and see below |
| Q5 published tests of Qwen2.5-Coder with comment-adjacent FIM slots | external |

I have no verified access to that literature here. Anything I produced about those from memory would be
plausible and unreliable in the way that matters — right-shaped citations, wrong details.

**These are not permanently unknowable — they are outside this machine.** They are answerable from
primary sources, and that research should come **before** a second-quantization run, so that
Q4_K_M-versus-another-quant is not changing at the same time as the lineage and benchmark-setup
unknowns. One unknown at a time.

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
