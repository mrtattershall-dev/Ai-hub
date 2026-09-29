# MODEL-DOSSIER-1 — what was actually tested

2026-09-29, $0, read from the running package and the preserved run records. No interpretation of
results here beyond identifying the configuration they came from.

## Identity, from the local package

| | |
|---|---|
| tag | `qwen2.5-coder:1.5b` |
| digest | `d7372fd828518a4d38b1eb196c673c31a85f2ed302b3d1e406c4c2d1b64a0668` |
| size | 986,062,089 bytes |
| family / params / quant / format | qwen2 · 1.5B · **Q4_K_M** · gguf |
| declared context | 32768 |
| `parent_model` | `""` — the package does not declare a base/instruct lineage |
| **baked-in system message** | **"You are Qwen, created by Alibaba Cloud. You are a helpful assistant."** |
| default parameters | none set by the package |

**This is not "the raw 1.5B".** It is a Q4_K_M quantization carrying a helpful-assistant system
persona, served through a template with three branches.

## The template has three paths, and which one is taken is decided by ONE field

    {{- if .Suffix }}<|fim_prefix|>{{ .Prompt }}<|fim_suffix|>{{ .Suffix }}<|fim_middle|>
    {{- else if .Messages }}   ...chat, with <|im_start|> roles and an optional Tools block...
    {{- else }}                <|im_start|>system {{ .System }}<|im_end|>
                               <|im_start|>user {{ .Prompt }}<|im_end|>
                               <|im_start|>assistant

So on `/api/generate`:

- **a `suffix` present → the FIM path.** `<|fim_prefix|>…<|fim_suffix|>…<|fim_middle|>`. **No system
  message, no chat markers.**
- **no `suffix` → the chat path.** The prompt is wrapped as a user turn **with the helpful-assistant
  system message prepended**.

## Which path every arm actually took

| experiment / arm | sent | template path | persona present |
|---|---|---|---|
| SUPPRESSION-1 **chat** (12/12) | prompt only | **chat** | **yes** |
| SUPPRESSION-1 **operator** (0/12) | prompt only | **chat** | **yes** |
| SUPPRESSION-1 **contract** (0/12) | prompt + suffix | **FIM** | no |
| SUPPRESSION-1 **manager** (0/12) | prompt + suffix | **FIM** | no |
| FARMEXT-1 **chat** (0/5) | prompt only | **chat** | yes |
| FARMEXT-1 **contract** (0/5) | prompt + suffix | **FIM** | no |
| AUDIT-2 arm A (manager) | prompt + suffix | **FIM** | no |
| AUDIT-2 arm B (direct) | prompt only | **chat** | yes |

## Three corrections this forces

**1. The "chat vs contract" contrast is confounded by template path, not only by output shape.**
It is whole-artifact-through-the-chat-path-with-a-persona versus slot-through-the-FIM-path-with-none.
Two variables move together. Every statement of the form "free-form output beats bounded output" must
be read as "the chat path beat the FIM path on this family", which is a different claim.

**2. The operator arm never tested this model's tool calling.** The template carries a real `.Tools`
branch that emits `<tool_call>{"name":…,"arguments":…}</tool_call>` JSON. I did not use it: I described
an invented `edit_file(path, contents)` syntax in prose on the **chat** path, and `grep` confirms
`framingRun.mjs` contains no reference to `tools`, `tool_call`, or `/api/chat`. **Arm B measured an
invented syntax, not the model's trained tool interface.** Its 9 echoes and 0 successes cannot be read
as evidence about tool use.

**3. The slot arm used the path this model is strongest at, and still failed.** The FIM branch is the
one the coder family is specifically trained for. That makes the comments-only result *more* surprising,
not less — and it means "the slot interface is unnatural for the model" is not the available
explanation. The available explanations are the local prefix shape (an instruction-comment block), the
quantization, the task, or the harness — none of which this dossier settles.

## What is still unverified, and must not be asserted

- Whether this package is the base or instruction-tuned checkpoint. `parent_model` is empty and the
  presence of a chat template plus a persona is **suggestive but not proof** of instruction tuning.
- Any external benchmark figure for **this exact quantization**. Family-level or higher-parameter
  results are not evidence about a 1.5B Q4_K_M.
- Ollama and llama.cpp build versions were not captured at run time. Recorded as a gap; earlier work
  already established that ollama versions differ across backends and seeds do not reproduce across
  them.

## What the measured profile is a fact about

Not "a 1.5B coder". **This exact package, through these exact template paths, under this runner:**
12/12 filter whole-artifact via the chat path · 0/12 filter constrained dialects · 0/5 farm extension
in both paths.
