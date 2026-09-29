---
name: never-pass-prose-through-a-shell-argument
description: "Three more escape-eating failures in one session — Python heredoc ate \\b, shell-quoted node -e ate \\s, double-quoted bash ate markdown backticks; use Write/Edit for any prose or regex"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-18T10:27:41.199Z
---

The heredoc hazard is not about heredocs. It is about **any prose or code passed through a shell
argument**. Three distinct mechanisms bit in a single session on 2026-09-18, after the rule had already
been written down four times:

    PYTHON heredoc          ate \b (a valid Python escape = backspace). A regex landed containing a
                            RAW BACKSPACE, stayed syntactically valid, silently stopped matching, and
                            a ladder measured every line as its own statement. No error anywhere.
    shell-quoted node -e    ate \s and \w. /def\s+\w+\((\w+)\)/ became /defs+w+((w+))/ - valid,
                            matched nothing, so a derived parameter name came out `undefined` and was
                            rendered into a prompt as the literal string "undefined".
    double-quoted bash      ate markdown BACKTICKS as command substitution, deleting spans from a
                            document mid-write and emitting "command not found" noise that is easy to
                            skim past because the file still gets written.

**Why:** `escape-guard.mjs` catches only lone escapes inside *string literals*. Escapes that collapse
into ordinary characters inside a *regex literal* are invisible to it, and so is a swallowed backtick.
The control character case is now caught by `scanControlChars` (added the same day); the other two are
not mechanizable this way.

**How to apply:** write JS, regexes, markdown and commit-message prose with the **Write or Edit tool**,
never through a heredoc or a `-e` argument — including one-off probes, which is exactly where the
discipline slips. When a shell is unavoidable, the corruption signature to look for is a plausible
wrong answer with no error: a regex that matches nothing, a fact rendered as "undefined", a vanished
backtick span.

Related: [[windows-bash-edit-gotchas]], [[silent-failures-are-the-class]],
[[apparatus-control-proves-assembler-not-prompt]], [[gate-harness-build-traps]].
