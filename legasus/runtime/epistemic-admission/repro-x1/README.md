# Reproducing X1 — three DISTINCT observations, not one

A correction after review: the first version of this package let one observation stand in for
another. **These are three different things and the package now keeps them apart.**

| # | observation | what it demonstrates | how to reproduce |
|---|---|---|---|
| **A** | the **original safety failure** | a HISTORY-SPECIFIC authorization silently transferring to a replacement — the defect | `node repro-x1/reproduce-historical.mjs`, or check out the pinned revision below |
| **B** | production accepts the replacement under `CONTENT_MATCH` | the **explicitly chosen semantics** working as specified. **Not** a contract violation | `node repro-x1/reproduce.mjs` |
| **C** | production refuses under `HISTORY_SPECIFIC` | **containment** | `node repro-x1/reproduce.mjs` |

**B is not A.** After the governance change, production accepting a byte-identical replacement under
`CONTENT_MATCH` is the contract doing exactly what it says. Reading it as the safety failure would
credit the package with reproducing something it no longer reproduces.

## The pinned historical revision

The defect was production behaviour at:

    fd1389e   P1..P5: positional origin reassignment authorizes the WRONG history, and STANDING.md

To reproduce **A** against the original code rather than the preserved specimen:

```bash
git worktree add /tmp/legasus-x1 fd1389e
```

then run the P-suite there. `reproduce-historical.mjs` is the cheaper route: it drives the
**preserved specimen** — the pre-containment resolver, kept byte-unchanged — through the testing
entry point, and prints the same defect.

## What each script imports

    reproduce.mjs              production entry point ONLY. No test helper, no specimen,
                               no test entry point. Observations B and C.
    reproduce-historical.mjs   the preserved specimen, through the testing entry point,
                               and says so at the top of its output. Observation A.
    build-history.mjs          shared: builds one journal record, run per process

## Challenging it

- Remove the disclosed pin on the internal address in `build-history.mjs`. The two histories stop
  being byte-identical and the reproduction stops reproducing — that pin is load-bearing and is
  disclosed for exactly that reason.
- Edit any field of B so it is no longer byte-identical. Observation B should become `UNAUTHORIZED`.
- Check that `reproduce.mjs` imports nothing from `_specimen-support.mjs` or `_test-entry.mjs`.
