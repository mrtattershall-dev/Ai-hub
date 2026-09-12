# Set I — RESULT: is the ceiling the hub, or the model?

tatte: *"Okay run a frontier model on 20 prompts. That'll really tell us if it's us or the model."*

**Answer: on these twenty goals, it is the model — and model *choice* matters far more than model *size*.**
The dense 32B scored **6/20**. The MoE 30B, on the identical hub, goals and checker, scored **15/20**.
I predicted the opposite, in writing, before the window opened.

## The number

| arm | active params | scored at | correct | rate |
|---|---|---|---|---|
| MoE 30B `Qwen3-Coder-30B-A3B-Instruct` | ~3B/token | its own goal-20 checkpoint (`064e062`) | **15/20** | **75%** |
| MoE 30B, same run | ~3B/token | after all 100 goals (as set H reported) | 14/20 | 70% |
| dense 32B `Qwen2.5-Coder-32B-Instruct` | 32B/token | after its 20 goals | **6/20** | **30%** |

The middle row exists because `checks-I.mjs` scores the *final* workspace: the MoE's goals 1-20 were originally
graded after 80 further goals had been applied to those files, and the dense model's after only 20. That was a real
confound and I did not publish around it — I rebuilt the MoE's workspace from its preserved `workspace.bundle`
(274 commits) at its own goal-20 checkpoint and re-scored with the same checker. **The confound was worth checking and
it worked against my expectation: the extra goals cost the MoE a goal rather than flattering it.** Apples-to-apples is
15 vs 6.

## Predictions, as pre-registered

1. **"Dense 32B beats the MoE. Predict 16+/20."** — **FALSIFIED, in the opposite direction.** 6/20. Roughly an order
   of magnitude more active compute per token produced *less than half* the score.
2. **"Predict the dense model does not repeat a single defect across both passes of the same project."** —
   **FALSIFIED decisively.** Five projects failed on both passes (`s3_matrix.js`, `s4_markdown.py`, `s5_expr.js`,
   `s6_graph.py`, `s8_grades.py`) against **one** for the MoE.
3. **"A null result is informative and must not be spun."** — not null. A clear separation, favouring the smaller
   agentic model.
4. **Duplicated definitions (carried from set H).** — dense left one (`s6_graph.py`, `bfs x2`); MoE left none.

## Attribution: cut off, or wrong?

|  | step budget | loop guard | clean |
|---|---|---|---|
| MoE (53 runs) | 21 | 1 | 23 |
| dense (20 runs) | **2** | **5** | 11 |

The dense model was **not** cut off — it got stuck repeating itself. Set G's binding constraint was the 30-call
budget; that is not what limited this arm.

## Two goals were lost to the hub, and both were winnable

Subtracted honestly, because the MoE scored `impl=Y` on **both**:

- **Goal 3, `s3_matrix.js`** — the model sent a *correct* edit at 2-space indent against a 4-space file. The tolerant
  matcher spliced `REPLACE` in verbatim, lifting `shape()` out of the class; the destructive-write guard then correctly
  refused it, the model tried inserting instead and hit `DUPLICATED shape (1 -> 2)`, and four identical retries later
  the loop guard ended the run. **The guard is the messenger; the tolerant splice manufactures the damage.**
- **Goal 12, `s2_logs.py`** — `pytest` is not on PATH; `pip install pytest` answered *"Requirement already satisfied…
  9.1.1"*; the same command failed again; the absolute interpreter path was denied by the approval allowlist.
  **450 seconds and all 30 calls** burned on an environment problem, while `run_python` worked and was used five times.

**Adjusted: dense 8/20 (40%) vs MoE 15/20 (75%).** The gap survives the correction.

## What the dense model actually did wrong — it does not verify its own output

- **`s6_graph.py:10` `if weight <= 0` and `s8_grades.py:17` `if max_points <= 0`** — validates a parameter without
  coercing it, so a string argument raises `TypeError: '<=' not supported between instances of 'str' and 'int'`.
  The same habit, in two unrelated projects, written independently.
- **Goal 14, `s4_markdown.py`** — adding headings, it replaced
  `return '<p>' + '</p>' + '<p>'.join(...) + '</p>'` with `return '\n'.join(escaped_paragraphs)`, deleting the
  paragraph wrapping that **its own five asserts still check**, and never ran them.
- **Goal 19, `s9_board.html`** — it *did* write `<button class="s9-right">`, but left three separate
  `createElement('li')` blocks in `s9_board.js` and only two attach buttons. The first one wins, so the checker's
  verdict is the same as the MoE's: `card A has no .s9-right button`. **A string being present in the file is not the
  feature working.**
- **Goal 16** — it re-sent an edit it had **already landed** four times, because a refusal says what it will not do and
  never shows the region's current text. The hub was right all four times; the message is what left the model blind.

## The MoE destroys its own working code — now dated

Reconstructing the goal-20 checkpoint produced an unplanned finding. `s4_markdown.py` goal 4 was **`impl=Y` at goal 20**
and **`impl=n` at goal 100** with `NameError: _escape_html`. The MoE broke its own passing code somewhere between goals
20 and 100. That is the north-star failure mode — long runs staying accurate — with a timestamp on it.

## Run facts

Identity confirmed 04:18:30 after a **373-second** cold pull (`/api/health` named the exact HF model before any goal ran,
Rule 3). Harness exit 0 at 04:56:40: **20 goals, 265 model calls, 38.6 min**, throughput 7.7-42.8 tok/s, mean 113 s/goal
(outliers: goal 12 450 s, goal 8 349 s). One approval denial (goal 12, `run_command`). GPU stopped via `stopApp.mjs` at
04:57:45, exit 0, confirmed against the app list. **Cost ~$2.90 of the $20 budget.**

## Recording — "every single thing that model does"

20 run files with every step's `args` and `result`; 20 untrimmed transcripts (`{ts, n, kind, sent, reply}`); traces;
`index.jsonl`; the scored workspace copy; and the trial directory preserved with its `.git`, which is the only copy of
the live checkpoint history. Every claim above was read back out of those records — the `<p>` regression, the paired
raw-reply-versus-recorded-args comparison, and the goal-20 reconstruction all came from them.

## What this does NOT settle

Twenty goals, one run per arm. Set H measured the run-to-run spread at ±1-2 score over 54-59 goals, so proportional
noise here is **larger**, and no claim should rest on a 1-2 goal difference. A nine-goal gap is far outside that, but
this is one run: it says this dense model is worse *at agentic multi-step editing on this hub*, not that dense models
are worse in general. Twenty goals also give each project only two passes, so compounding barely has room to appear.

## What I got wrong tonight, on the record

- Predicted 16+/20 for the dense model. It scored 6.
- Claimed goal 19 passed, from `grep` finding the string `s9-right`. The checker failed it identically to the MoE.
- Claimed an indentation-only edit was "inexpressible" and that the hub forbade the model from undoing its own damage.
  The code compares whole files verbatim; the model's own `read_file` output showed the region going 4 -> 8 -> 4.
  **The hub was correct all four times.** Retracted.
- Suspected the FIND/REPLACE parser of collapsing two blocks into one. Paired raw replies against recorded args across
  all ten calls of a run: they match exactly. **The hub records faithfully.** Retracted.
