# Running the agent unattended

Everything here is **off by default**. The agent behaves exactly as it did before unless
you turn something on.

## The one that matters: approval mode

`AGENT_APPROVAL_MODE` decides what runs without you.

| mode | what runs unattended | use it when |
|---|---|---|
| `strict` *(default)* | read-only inspection only (`ls`, `cat`, `grep`, …) | you are watching, or the machine matters |
| `build` | the above **plus** dependency installs and running code inside the workspace | disposable machine / blast zone |
| `yolo` | everything except the hard denylist | you have nothing to lose on this box |

**Be clear about what `build` means.** A coding agent cannot test without running code, and
it writes the code it runs. Auto-allowing `node app.js` *is* auto-allowing arbitrary code
execution — the script is bounded only by what the OS user can reach. Argument parsing does
not change that; a container or VM does. Use `build` where a bad script cannot hurt anything
you care about.

**The hard denylist applies in every mode, including `yolo`**, and those commands are
*refused*, never queued for approval — waking someone at 3am to approve `rm -rf /` is the
mistake, not the safeguard. Refusals include: recursive deletes, `sudo`, `git push`,
`npm publish`, registry edits, shutdown, `ssh`/`scp`, disk writes, fork bombs, and piping a
download into an interpreter.

Chained commands are classified **per segment, weakest wins** — `npm install && rm -rf /`
is denied on the second half.

A refusal no longer halts the run. The agent gets the reason back and routes around it.

## Flags

```
AGENT_APPROVAL_MODE=build      # strict | build | yolo   (default strict)
AGENT_SUPERVISOR=1             # a finished run pulls the next queued goal
AGENT_MAX_STEPS=250            # model calls per run
AGENT_MAX_MINUTES=90           # wall clock per run
AGENT_MAX_TOKENS=0             # 0 = off; otherwise stop at N estimated tokens
AGENT_SUBTASK_DEPTH=2          # how deep spawn_subtask may nest
AGENT_SUBTASK_STEPS=40         # step budget for one sub-task
AGENT_ESCALATE_WEBHOOK=https://…   # POSTed {text,…} when a run stops and needs a person
AGENT_ALLOW_DOWNLOADS=1        # download_file works at all (still approval-gated)
AGENT_AUTO_DOWNLOAD=1          # …and runs without approval. Disposable machines only.
GODOT_BIN=…                    # lets verify_project parse-check GDScript
```

## What the agent gained

**A checklist it cannot lose** — `TASKS.md`. Seeded from the build plan, updated as it works,
and re-injected fresh before *every* model call rather than pushed into history once. History
pruning cannot drop it, and it is never a stale copy from step 1. The finish gate blocks while
tasks are open.

**Proof for every kind of project** — the finish gate used to ask one question: does
`index.html` exist and has it been browser-tested? So web apps were held to a real standard and
Python scripts, CLIs, Node services and Godot projects were held to none. `verify_project` now
detects the project type and runs the matching proof: compile the sources, run the tests if
there are any, otherwise run the entry point. A long-running server killed at the timeout counts
as success — that is what a server should do.

**A check on what is actually on screen** — `see_screen`. `test_web` reads the console, so code
that throws nothing and draws nothing passed it clean. This interrogates the rendered page:
blank canvas, collapsed containers, invisible text, off-screen or overlapping controls.

> This is **not** vision. The model is text-only, so it gets sentences, not an image. The
> screenshot is still saved to `workspace/.screenshots/` because *you* can look at it.

**A fresh context when it needs one** — `spawn_subtask`. A sub-agent shares the workspace but
starts with an empty window and hands back a summary. The parent pays summary-sized context for
work that would have filled its own. The cost is real: **the summary is lossy**, so a wrong
decision inside a sub-task arrives as a confident sentence with nothing to check it against.
Nesting is capped, depth comes from the run rather than the model's own arguments, and a
sub-task that hits an approval stops and reports back instead of deadlocking.

**Work that outlives one goal** — a durable queue (`server/agent-queue.json`, hand-editable).
The agent can `queue_task` something it noticed without derailing the current goal, and with
`AGENT_SUPERVISOR=1` a clean finish pulls the next item. Only clean finishes chain: piling more
work onto a run that just failed compounds the failure instead of surfacing it. Items left
`taken` by a crash are re-queued at startup.

```
GET    /api/agent/queue        list + current mode
POST   /api/agent/queue        { goal, priority }
DELETE /api/agent/queue/:id
POST   /api/agent/queue/run    start the next item now
```

**Someone gets told** — `ESCALATIONS.md` always, plus a webhook if configured, whenever a run
stops for budget, a loop, unparseable output, a persistent bug, a dead tunnel, or an approval.
A run that gives up silently at 4am is the same as no run at all.

**Cost visibility** — estimated tokens are accumulated per run and `AGENT_MAX_TOKENS` can stop
one. It is a ~4-chars-per-token estimate, for noticing a runaway, not for billing.

## Known limits

- **Approvals still block.** The policy layer removes the common 3am halts (`npm install` and
  friends now auto-run in `build`), but anything that still classifies as *ask* waits for a
  human indefinitely. There is deliberately no auto-approve-on-timeout.
- **`build`/`yolo` are not a sandbox.** See above. The confinement is `safePath` for file tools
  and cwd for commands — a script the agent runs is not confined by either.
- **Sub-task summaries are lossy** by construction.
- **GDScript is unverified without `GODOT_BIN`.** `verify_project` says so rather than implying
  the scripts are fine.

## Tests

```bash
node server/policy_test.mjs    # 61 assertions — the approval policy
node server/agent_audit.mjs    # 142 assertions — consistency + live layers
cd server && node selftest.mjs #  35 assertions — the hub surface
```
