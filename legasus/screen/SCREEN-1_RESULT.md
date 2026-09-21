# SCREEN-1 result — ZERO FINDINGS. Precision 0/3, with the reasons named.
2026-09-21 10:50. Preregistration `legasus/screen/SCREEN-1_PREREG.md` (a3063ad), frozen before
any Odysseus source was read. Target record `TARGET-ODYSSEUS.md` (329201c). Target tree
read-only; nothing imported or executed by the scanner.

## The scan

    files seen / parsed     546 / 546        unparseable: 0
    INV-A raw candidates    2
    INV-B raw candidates    4
    DISTINCT candidates     3

**6 raw candidates are 3 distinct locations.** `C:\Users\tatte\odysseus` contains a nested
duplicate of its own source tree (`odysseus/routes/...` alongside `routes/...`), so every hit
was counted twice. Recorded here rather than in the headline, per the cardinality audit: *raw
hits are artifacts, distinct locations are the unit.* Had this gone unnoticed the screener would
have doubled its own apparent yield.

## The three candidates, and why each is a FALSE POSITIVE

**1. INV-A — `routes/mcp_routes.py:67 _mcp_oauth_token_missing()`**

```python
except HTTPException:
    if strict: raise
    logger.warning("Ignoring MCP OAuth config with unsafe token_file")
    return True
```

The function returns `True` to mean *the token is missing*. On an unsafe path in non-strict mode
it returns `True` — treating an unresolvable config as missing rather than present. That is
**fail-safe and deliberate**, and the docstring says so.

*Why the invariant misfired:* INV-A equates "returns a truthy literal" with "reports success".
For a predicate whose name asserts a **problem** (`*_missing`, `*_failed`, `*_expired`), truthy
means the problem is present — the polarity is inverted. The invariant has no notion of
predicate polarity.

**2. INV-B — `src/chat_helpers.py:70 is_vision_model()`**
**3. INV-B — `src/teacher_escalation.py:49 is_self_hosted()`**

Both end in a **computed** boolean — `return bool(_VISION_VL_RE.search(m))`, `return host not in
_SOTA_HOSTS` — which can perfectly well be false.

*Why the invariant misfired:* INV-B's failure test recognises only *literal* falsey returns
(`False`, `None`, bare `return`). A computed boolean return is invisible to it, so a function
that fails routinely looks like one that cannot fail. Both functions are additionally documented
as deliberately conservative, which is a design decision rather than a defect.

## Scoring the frozen prediction

    predicted: INV-B yields more candidates than INV-A          CONFIRMED (4 vs 2 raw, 2 vs 1 distinct)
    predicted: INV-A's precision is higher than INV-B's         NOT CONFIRMED - both are 0/n
    predicted: most INV-B candidates are false positives        CONFIRMED (2 of 2)

## What SCREEN-1 establishes

**Nothing about Odysseus.** Zero defects were found, and that is the result.

What it does establish is about the machinery: the discipline held end to end. Invariants were
frozen and committed before a source file was read; ranking was file-path order; no third
invariant was added after seeing hits; no area was focused or excluded afterwards; and the
duplicate-tree inflation was caught by a rule written hours earlier for a different reason.

A screener that reports zero findings with a stated precision and named misfire reasons is
behaving correctly. One that found something by relaxing its invariants after inspection would
not be.

## What was NOT done, per the preregistration

No INV-C. No re-scan with loosened rules. No inspection of areas that "look promising". The two
misfire reasons above are **characterisation of why precision was 0**, not new detectors — and
turning either into a detector would require its own preregistration and its own frozen
predictions, on a target not yet inspected.

## Honest assessment of the invariants themselves

Both invariants are real defect classes — they were earned on other codebases. But as
implemented they are **too literal to survive a mature Python codebase**: polarity-blind (INV-A)
and literal-return-blind (INV-B). Odysseus is 546 source files with a threat model and a
security policy; the easy instances of these classes are unlikely to be present.

That is a statement about SCREEN-1's *sensitivity*, and it is unmeasured. The screener has not
been shown able to find a defect it should find. **Before the next attempt, it needs a known-bad
control**: a defect of each class, planted in a copy outside the target tree, that the scanner
must flag. A detector that has never caught anything has an unknown floor, and this run does not
distinguish "Odysseus is clean of these classes" from "the detector cannot see them".

## Target tree integrity — measured, not assumed

    modified tracked files:  0

The tree does contain pre-existing untracked entries (`CPU`, `Functional`, `Models`, `No`,
`Tiny`, `cd`, `cp`, `git`) which look like a README code block once pasted into a shell. They
appear in the very first directory listing taken before any write-capable command was run, so
they predate this session. Recorded because "the tree is dirty" would otherwise look like
something the screener did.

## Apparatus note

The first suite invocation failed on `--timeout=120`: `pytest-timeout` is not installed in that
venv. A flag of mine, not a fault of the target. The second invocation failed for a sillier
reason - `grep -c` returning 0 exits 1, which broke an `&&` chain before pytest ran. Both are
recorded because a screener's own run log is evidence too, and "the suite did not run" must not
be quietly retried into "the suite ran".
