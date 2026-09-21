# Screener target record — frozen BEFORE any semantic inspection (2026-09-21 10:15)

Target named by tatte: **Odysseus**, `C:\Users\tatte\odysseus`, remote
`https://github.com/pewdiepie-archdaemon/odysseus.git`.

## Everything known at the moment of freezing

    language              Python 3.13 (1886 .py files at depth<=3); a small JS/TS surface
                          (static/app.js, sw.js, two .github scripts, one .ts spec)
    tests                 719 test_*.py under pytest, asyncio_mode=auto, taxonomy markers
    activity              287 commits in 90 days; HEAD 6efc07c, authored by others
    posture               THREAT_MODEL.md, SECURITY.md present; OAuth token storage, email
                          sending, MCP servers, docker compose files
    environment           venv/ present; python 3.13.14 on PATH

## What has NOT been looked at

No source file has been read. No function, module, or subsystem has been inspected for
correctness, smells, or anomalies. No defect, location, or area has been selected. The facts
above are file counts, config, and git metadata only.

**This record exists so that "the location was not chosen after inspection" is checkable rather
than asserted.** Any invariant this screener uses must be frozen in a document committed BEFORE
the first source file is read, and that commit must precede the first finding.

## Substrate fact, recorded now because it constrains everything downstream

The BIND intervention substrate (steps 1-17 of this branch) is JavaScript-only: acorn AST
mutation, Node loader hooks, V8 coverage, Node preload markers. **It does not reach a Python
target.** TRANSFER-BIND's CANNOT_ATTACH concerned ESM vs CJS within Node; this is a larger gap.
Whatever screens Odysseus is therefore either (a) a new Python-side apparatus, or (b) an
approach that needs no intervention at all. That choice is made in the screener's own
preregistration, not here.

## Constraints that apply to this target and did not apply to synthetic ones

1. **Third-party live code.** Executing Odysseus's suite runs other people's software with
   OAuth/token, email and MCP surfaces. Not done without tatte's explicit instruction.
2. **Responsible disclosure.** A real finding in a live public project is a disclosure matter.
   Nothing is published, filed, or sent anywhere. Findings go to tatte only.
3. **No modification.** The target tree is read-only, as the foreign-engine tree was (0 files
   touched, measured).
