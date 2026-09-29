---
name: windows-bash-edit-gotchas
description: Editing ai-coding-hub code from this Windows Git Bash - heredocs collapse double backslashes and choke on backticks; server/*.js are LF (not CRLF); count CR with node not grep; apply multi-region edits as exact blocks
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-11T09:33:04.393Z
---

Traps that each cost failed edits in ~/Projects/ai-coding-hub (2026-09-10 and 2026-09-11):

1. Bash heredocs here COLLAPSE a doubled backslash to a single one (even with a quoted 'EOF'),
   and a heredoc containing backticks has also broken the whole command ("unexpected EOF while
   looking for matching"). Single-backslash, backtick-free content survives.
2. LINE ENDINGS: server/*.js are LF in git AND in the working tree - .gitattributes has
   text=auto eol=lf (checked 2026-09-11 with `git ls-files --eol` and a node \r\n count; main and
   a worktree both pure LF). The older note that agent.js is CRLF was wrong: `grep -c $'\r$'` is
   unreliable in this shell (it once "matched" every line of a pure-LF file). Count CR with node:
   `(s.match(/\r\n/g)||[]).length`.
3. sed replacements with escaped CR/LF or doubled backslashes get mangled like (1).
4. A replacement ending in a `// comment` can swallow code that shared the line - it ate the
   closing `}` of a `finally { ... }` block once. Use `/* */` for comments added inline.

**Why:** each trap surfaces as "anchor not found" or a mysterious parse error and invites blind retries.

**How to apply:** for one region, Read the target and use the Edit tool. For several regions
of one file, write the exact FROM/TO blocks to a file with the Write tool and apply them with a
small node script that requires each FROM to match exactly once and writes nothing otherwise
(patch-agent.cjs pattern, 2026-09-11). Any script containing backticks or backslashes: create
it with the Write tool, not a heredoc. Bash sed is fine for literal, backslash-free, single-line
swaps. Always `node --check` after an edit. Related: [[hub-location-and-coord]].

**FOURTH occurrence, 2026-09-17, and the most instructive.** A throwaway probe written via a quoted
heredoc had its doubled-backslash regex collapse to single backslashes; in a single-quoted JS string a
backslash-s is just an s, so `'^\s*(?:def\s+'` became the regex `^s*`, matched nothing, and the
probe silently computed an empty `requires` list. It then DISAGREED with the real scorer about an
information-gain number. The scorer (written with the Write tool) was right.

Two lessons beyond the escaping rule:
1. The corruption was SILENT and produced a plausible-looking answer, never an error.
2. It was only caught because a FAVOURABLE headline number was distrusted and re-checked. Had the
   broken probe agreed with the scorer, nothing would have been examined.

Rule, now with four instances behind it: any JS containing a regex is written with the Write tool,
never through a heredoc - including one-off probes, which is exactly where the discipline slips.


2026-09-25 addendum: a quoted heredoc ALSO collapses `\b` to `\b`, which Python then turns into a BACKSPACE byte inside a JS regex - two silent test failures, invisible in normal output (found with grep -P "\x08"). Any patch script containing backslashes must be written with the Write tool, never a heredoc.
