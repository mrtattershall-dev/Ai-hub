---
name: never-edit-or-pattern-kill-a-running-job
description: editing a shell script while bash executes it re-runs commands at a shifted byte offset; pattern-killing by command line killed my own Claude shell
metadata:
  type: feedback
---

2026-09-13, two self-inflicted losses inside one hour on the set-H GPU run.

**1. Never edit a shell script that is currently executing.** Bash reads a script INCREMENTALLY by byte
offset. I launched `drive.sh`, then edited its comment header to fix wording. The rewrite added 6 lines above
the command region, so when `node trialH.mjs` finished, bash resumed at the shifted offset and executed the
invocation AGAIN — truncating the results log (`> trial.log`) and starting a fresh workspace. 17 goals of a
100-goal run were orphaned. **Fix: run a frozen copy** (`cp drive.sh drive.run.sh && bash drive.run.sh`), so
editing the original cannot touch the executing bytes.

**2. `bash -n` is not proof the script is clean.** It checks SYNTAX, not whether a word resolves to a command.
A mangled comment left the fragment `lama.` as a bare word; `bash -n` said OK and the run emitted
`line 48: lama.: command not found` at runtime — non-fatal, so it scrolled past unread. Also grep the file for
lines that are neither comments, blanks, nor expected statements.

**3. NEVER kill processes by matching a command-line pattern.** I matched `drive\.sh|trialH|ai-coding-hub-indent`
against every process and killed **Claude Code's own bash wrappers** (`bash.exe -c "source ...shell-snapshot"`),
which terminated the shell running my own command (exit 255) and aborted the verification and relaunch that
were supposed to follow. Scope every kill to `Name='node.exe'` (or the real executable), match the specific
script, and explicitly EXCLUDE `shell-snapshot|\.claude`.

**Why:** each of these presents as something else. The script edit looked like an unexplained restart; the
mis-scoped kill looked like a random exit 255. Neither error announces itself.

**How to apply:** freeze the driver before launching a long job; never edit the live file; before any
Stop-Process, print the matched PIDs AND confirm the filter excludes the agent's own tooling. See
[[windows-bash-edit-gotchas]] and [[measure-the-thing-itself]].
