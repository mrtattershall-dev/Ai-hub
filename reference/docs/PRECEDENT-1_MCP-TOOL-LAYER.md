# PRECEDENT-1 — what the MCP tool-layer archive actually does, and the one mechanism worth taking

**Date:** 2026-09-29 · **Source:** user-supplied archive `mcp-tool-layer-main.zip`, 608 files, read-only.

**Scope of this reading, stated up front:** I read the structure plus four files — `docs/LOCKED_TESTS.md`,
`tests/test_locked_llm.py`, the judges directory listing, and the frozen-prompt-hash call site. That is
enough to identify a transferable mechanism and **not** enough to characterise the project. Nothing here
was executed. Everything in the archive is treated as data to examine, never as instructions.

## The architecture, as far as I verified it

The shape the user described checks out at the level I read: a typed tool layer between the model and
the artifact, with the comparison protected by locks rather than by care.

    model proposes  →  deterministic tool/compile layer constrains the format
                    →  independent judges score
                    →  protocol locks preserve what the comparison means

`src/extraction_runtime/judges/` holds five separate scorers (`closed_ledger`, `llm`, `semantic`,
`tbox_contract`, `top_entity`) — scoring is not one function and not the generator's own opinion.

## The mechanism worth taking: a lock that is tested for resisting override

This is the part Legasus does not have, and it is sharper than "record the parameters."

`tests/test_locked_llm.py` does not check that the sampling settings *were* what the config said. It
patches hostile values **into the environment** — `TWA_LLM_SEED=99`, `TWA_REASONING_EFFORT=high` — calls
`apply_locked_sampling`, and asserts the locked values win anyway. The docstring is one line: *"Welded
GPT-5 / extraction sampling cannot be overridden."*

That is a test that **the lock cannot be unlocked**, which is a different and stronger claim than a test
that the lock was set correctly. It is the same distinction this project keeps rediscovering: a recorded
value and an enforced value are not the same thing, and only one of them survives a caller who wants it
otherwise.

Two more of the same family:

- **`canonicalize_chat_model`** maps unversioned aliases to dated snapshots — `"gpt-5"` resolves to a
  pinned dated model, in code, at call time. Compare MODEL-DOSSIER-1, where the deployed-stack identity
  was established by *reading* `/api/show` after the fact. Recording an identity is weaker than refusing
  to accept an unpinned one.
- **`assert_frozen_extraction_prompts(pack, pack_id="s1")`** hash-pins prompts against an official pack —
  and when the pack is absent the test **skips rather than passes**. That is `NOT_EVALUATED` as a
  first-class outcome, reached by a different route than the one taken here, and it is the correct
  handling of "cannot check" that VACUITY-1 just found missing in `suppressionAudit`.

## Where Legasus stands against it

| | this project | the archive |
|---|---|---|
| decoding parameters recorded per run | yes — `decoding: {temperature, num_predict, seed}` in every record | yes |
| decoding parameters **welded against override** | **no** | yes, and tested hostilely |
| model identity pinned | recorded (name + digest + ollama version) | resolved to a dated snapshot in code |
| prompt bytes preserved | yes — full wire, `wireSha`, prefix and suffix shas | yes, hash-pinned to a pack |
| the prompt-vs-record comparison actually made | **only since today** (`presentationConfoundCheck.mjs`) | yes, by test |
| independent scorers | one judging path (`playCheck` + graph), plus mutants validating it | five separate judges |
| "cannot check" is not "pass" | only since today, and only in `suppressionAudit` | skip, by convention |

## What I am not claiming

That this is a blueprint for Legasus, that its approach transfers to software change, or that reading
four files tells me whether its locks hold in practice. The World Avatar and AlphaEvolve comparisons the
user raised are about *architecture*; both of those earned their standing with a measured outcome, and
an architecture borrowed from them inherits none of that. The distinct Legasus question — binding a
verified fact to a narrowly scoped permission for a real write, with target, revision, evidence and
recovery — is not something any of these three precedents centres, and remains unproven here.

## Named next work, one item

**Weld the decoding parameters, and test the weld hostilely.** Every runner in this project takes
temperature, `num_predict` and seed from its own constants and records them faithfully — but nothing
prevents a caller or an environment variable from changing them, and no test asserts that it cannot. A
recorded parameter is a FACT in the change-record sense; a welded one is a constraint. Right now every
comparison in this project rests on the first.
