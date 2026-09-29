# fatal-08: the whole-file write path, as the MoE actually uses it

READ-ONLY audit, 2026-09-12. Scope: `write_file` end to end — model reply → bytes on disk.
Serving tree `ai-coding-hub-indent/server/{agent.js,agentParse.js,defNames.js}`.
Records: setJ `coder30b-setj` (18 runs preserved), setH `coder30b-sethfix` (53 runs), plus both `workspace.bundle`s.

**Headline: the MoE's bytes DO reach disk intact.** 74/74 successful writes are byte-exact from
reply to git blob. One real content-loss defect exists on this path (first-fence-wins, 1 in 105
payload replies) and one goal was actually lost to the write guards — but not the one the
existing audit note implies.

---

## A. The transformation chain, named

`parseAction` (agentParse.js:139-141) → `tools.write_file` (agent.js:517) → `writeFileSync` (agent.js:551).

| # | Transformation | Where | Fired on MoE payloads |
|---|---|---|---|
| 1 | **First fenced block in the whole reply** becomes the content | agentParse.js:139 | always — **defective, see D** |
| 2 | Exactly one trailing newline stripped: `.replace(/\n$/,'')` | agentParse.js:141 | **105 / 105** |
| 3 | `stripLineNumberPrefixes` | agentParse.js:141 | **0 / 105** |
| 4 | Truncated-reply refusal (`replyWasTruncated`) | agentParse.js | **0 / 105** |
| 5 | PATH scavenging / lastPath guess | agentParse.js | **0 / 105** (PATH always given) |
| 6 | Marker refusal (package.json) | agent.js:518 | **0** |
| 7 | Shrink guard (<40% and not code-ish) | agent.js:533-548 | **0** |
| 8 | Write: `writeFileSync(full, content, 'utf8')` — no newline added, **no CRLF conversion**, no encoding change | agent.js:551 | always |

(105 payload replies = 34 setJ + 71 setH, parsed with the real serving-tree parser.)

### Can the file on disk differ from what the model sent? Proof

Three links, each measured on real payloads:

1. **reply → args**: replayed the serving tree's own `parseAction` over every transcript reply.
   Parser output matched a recorded `write_file` step's `args.content` **exactly 83/83** (setJ 33,
   setH 50). Zero unmatched.
2. **args → tool report**: `Buffer.byteLength(args.content)` equals the `OK: wrote N bytes` figure
   for **74/74** successful writes (setJ 29, setH 45). No truncation, no re-indentation.
   (`RUN_ARG_MAX` = 30,000; **0** recorded payloads were truncated on disk, so the records are faithful.)
3. **tool → disk**: raw git blobs from `workspace.bundle` (`git cat-file`, filters bypassed) equal the
   payload byte counts exactly — `s9_board.html` 479, `debug_expr.js` 310, `_snippet.py` 1673.

> **False alarm killed.** A first pass comparing *checked-out* bundle files showed all 9 files
> differing by +10…+57 bytes, exactly the line count — i.e. LF→CRLF. That was **my own clone**
> (`core.autocrlf=true` globally), not the hub. Raw blobs are byte-identical. **The hub writes LF
> and does not touch encoding.** No CR appeared in any of the 105 payloads, and only 1 of 1,348
> replies contained a CR anywhere.

**Non-fatal but systematic:** transformation #2 means **every** whole-file write lands without a
final newline (18 of 22 files in the setJ bundle end without one). `append_file` adds one; `write_file`
never does. Cosmetic here — no check failed on it — but it is a real asymmetry between the two paths.

---

## D. A successful write that wrote something different: YES — once, silently

**setH run `b472e3d1`, turn 16 → step 27.** The model reasoned about `peek` in its THOUGHT and
illustrated it with a fenced block **before** the ACTION line:

```
THOUGHT: ... Looking at the current peek implementation:

```javascript
peek(key) {
  return this.map.get(key);
}
```
... let me verify by running a more detailed test.
ACTION: write_file
PATH: detailed_test.js
```javascript
const { Cache } = require('./s7_cache.js');
...942 characters of real test file...
```
```

`parseAction` matches `/```([^\n]*)\n([\s\S]*?)```/` against the **entire reply** (agentParse.js:139),
so the 42-character illustration won. The hub wrote **41 bytes** and answered
`OK: wrote 41 bytes to detailed_test.js`. The intended 942-byte file was discarded in silence.

Confirmed downstream: step 49 `read_file detailed_test.js` → `lines 1-3 of 3 | 1: peek(key) {`, and the
end-of-run reparse logged *"detailed_test.js does not parse and no version this run produced parses either"*.

- **Rate:** 1 of 105 payload replies (setJ 0/34, setH 1/71).
- **Cost here:** wasted calls, not the goal — the target was a scratch debug file, the goal file was
  `s7_cache.js`, and the run died on budget at step 51.
- **Why it is still fatal-class:** the same mechanism aimed at a source file overwrites it with a
  3-line fragment and reports OK. Nothing in the chain can notice, because the guards compare
  *disk before* to *disk after* — and the fragment genuinely is what the parser handed over.

No other loss mode fired: 0 truncated replies, 0 nested-fence payloads, 0 `.md` writes (so the
non-greedy fence never cut a markdown file short), 0 line-number strips.

---

## B. The destructive-write guard on the MoE: 15 fires, mostly over-strict, 1 goal lost

setJ: **4** fires, all in a single run. setH: **11 destructive + 1 duplicate** across 5 runs.
Every affected run ended `ran out of step budget (30 model calls)` except `eb3b07e1` (done in 19).

| Run | Set | Fires | Names | Guard right? | Outcome |
|---|---|---|---|---|---|
| `c75eab5e` | J | 4 | getNumber, getNumberEnd, getNumberStart | names truly dropped, **but no caller anywhere** | budget death; goal 5 failed **for an unrelated reason** |
| `064124ea` | H | 3 | checkout | **YES — correct refusal** | budget death, goal 11 failed |
| `fc8e64f9` | H | 1 dup + 1 rem | topo_order | **NO — blocked a legitimate move** | **goal 46 lost** |
| `5c855c29` | H | 3 | test_percent_function | over-strict (model's own test file) | budget death |
| `eb3b07e1` | H | 3 | parseNumber, evaluate | over-strict | worked around via orphan `s5_expr_new.js`; finished |
| `5bfddda6` | H | 1 | parseExpression, parsePower | over-strict | budget death |

**Caller check** (does the "removed" name appear in any other file of the final workspace?):
`getNumber*` ×11 → NONE. `parseExpression`/`parsePower` → NONE. `test_percent_function` → NONE.
`parseNumber` → NONE. Only `checkout` (test_library.js, test_specific.js), `evaluate`
(test_s5_expr.js) and `topo_order` (test_s6_graph.py) had any other reference. This confirms the
comment already in agent.js:3557-3565 — the old "earlier steps depend on those" wording was untrue
in the large majority of fires.

### The one refusal that was RIGHT

`064124ea` step 37/39/42: `edit_file` with `{"path":"s1_library.js","replace":"","lines":[29,49]}` —
a pure **deletion of lines 29-49**, which is the whole `checkout` method, a method both test files
call. The guard correctly stopped it three times. The goal still failed, but that is the model
deleting live code plus budget exhaustion, not the guard.

### The one goal the guards actually cost — `fc8e64f9`, goal 46

The model had left a stray `topo_order` at the end of `s6_graph.py` and tried to fix it:

- step 34/35: adding `topo_order` in the right place → **DUPLICATED refusal** (1 → 2).
- step 39/40: deleting the stray copy → **REMOVED refusal**.
- step 42: finally deleted it, then ran out of budget before re-adding it inside the class.

Final `s6_graph.py` (raw blob) has `def topo_order` at line **239, indented 4 spaces but sitting
inside the `if __name__` test block**, directly after `print("All tests passed!")` at line 237 —
not in `class Graph` (line 3). Hidden check for goal 46:
`threw: AttributeError: 'Graph' object has no attribute 'topo_order'`.

**The two guards form a deadlock for the commonest repair there is — moving a definition.**
Adding it in the right place is a DUPLICATE; removing the wrong copy is a REMOVAL. Neither refusal
is individually unreasonable; together they make the operation unreachable inside one budget.

### Correction to the standing note

agent.js:3557-3565 says `c75eab5e` "spent its whole 30-call budget fighting the refusal and died".
Budget death is right (30/30 calls, 4 refusals, `repeatCalls` 3). **But the refusal did not cost
goal 5.** I extracted the refused payloads and ran them: they compute `2+3*4=14`, `1.5+2.5=4`,
`10/4=2.5`, `8-3-2=3`, and throw on `1/0` — working rewrites. They also return **23** for `"2 3"`,
which is exactly what the hidden check failed on (`"2 3" did not throw`), and the file that
actually shipped behaves **identically** on all seven probes. Goal 5 (and the whole s5 chain, 0/10)
failed on a defect present in both the refused and the delivered version. The refusal cost ~6 of 30
calls; it did not cost that goal.

---

## C. After a refusal, does the model proceed as if the write landed? YES

The refusal text is explicit (`... is UNCHANGED - nothing was written`). The model reads it
sometimes and ignores it others.

**Proven ignore — setH `5c855c29`:** step 12 write refused; the very next action, step 14/15, is
`run_python` with THOUGHT *"I need to run the test to verify that my percentile function works
correctly. Let me run the test file."* It ran the **old** file and got a traceback. No re-read, no
acknowledgement.

**Proven read — setJ `c75eab5e`:** step 15 refused → step 16 tries `edit_file` with THOUGHT *"I need
to use edit_file to modify the existing file instead of trying to overwrite it completely."*

So refusals are not silently lost, but they are not reliably registered either — and the common
response is to re-send the identical write (`repeatCalls` 3 in c75eab5e; identical refusals 3× in
three separate setH runs).

---

## E. Races and intermediate checkpoints: none found

- **Batching off.** `AGENT_BATCH_ACTIONS` is unset for these arms (agent.js:128), so `parseActions`
  and the per-action batch loop never ran; only the first action of a reply executes. 8 setJ / 48
  setH replies carried more than one `ACTION:` line and the extras were dropped by design
  (e.g. `7f41f3b7` turn 1: a correct `write_file` + a dropped `append_file` of the asserts).
- **No concurrent runs.** Run time-intervals: **0 overlapping pairs** in both sets. One workspace,
  strictly sequential.
- **Subtasks awaited** (agent.js:1475), and `write_file` is synchronous.
- **Checkpoints never capture an intermediate state.** The auto-checkpoint commits *before* the
  mutating step (agent.js:3153-3169); a refused write is restored to `beforeSrc` (agent.js:3554)
  before anything else reads the tree.

**One real ordering wart, not a race:** `run.needsTest = true; run.lastPath = args.path`
(agent.js:3509) and `run.touchedWeb` are set **before** the destructive guard refuses at
agent.js:3550-3555. A fully refused write still marks the run "needs a fresh test" and moves
`lastPath` onto a file that was never written — which is the file a later PATH-less `write_file`
would then target.

---

## F. Ranked by goals lost

| # | Defect | File:line | Goals lost (measured) | Fix |
|---|---|---|---|---|
| 1 | **Move-a-definition deadlock.** Adding a def in the right place is refused as DUPLICATED; deleting the stray copy is refused as REMOVED. | agent.js:3550 (removal) + the duplicate block at agent.js:~3596 | **1** (setH goal 46, `fc8e64f9`); the pattern recurs in 3 other runs | Treat removal+addition of the same name in one write as a **move**: if `defCounts(after)` for the name is ≥1, do not refuse the removal. Or: never refuse a removal when the name still exists elsewhere in the same file after the write. |
| 2 | **First-fence-wins.** The content is the first fenced block in the *whole reply*, including one inside the THOUGHT, before the ACTION line. Writes the wrong bytes and reports `OK`. | agentParse.js:139 | 0 measured (1/105 replies; hit a scratch file) — silent whole-file corruption whenever it lands on a source file | Take the first fenced block **at or after the ACTION: line**; fall back to the first block only when none follows. |
| 3 | **Identical refusal, identical re-send, budget death.** Five of six refusal runs ended on the 30-call budget; the same refusal fires 3× on the same path and names. | agent.js:3550-3567 | contributes to 5 budget deaths | After the 2nd identical refusal on the same path+names, stop repeating the sentence: either accept the write with an implicit `REMOVE:`, or hand back the exact `LINES: a-b` range for the definitions at risk. |
| 4 | **Refused write still mutates run state.** `needsTest`, `lastPath`, `touchedWeb` set before the guard refuses. | agent.js:3509 | 0 measured | Move the state updates below the two refusal blocks, or revert them when `result` becomes an ERROR. |
| 5 | **`write_file` never writes a final newline** (`append_file` does). | agentParse.js:141 / agent.js:551 | 0 — cosmetic | Append `\n` when the payload lacks one, matching `append_file`. |

### What is NOT broken on this path

Fence stripping, line-number stripping, PATH resolution, CRLF, encoding, truncation handling, the
marker guard, the shrink guard, checkpoint ordering and write atomicity are all clean on real MoE
payloads. **74/74 successful writes are byte-exact from the model's reply to the git blob.** Every
fix aimed at `edit_file`'s FIND matching is indeed irrelevant to this model — but so is most of the
write path itself. The MoE's losses here come from the **guards above the write**, not the write.
