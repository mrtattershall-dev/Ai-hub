# DOM-EVIDENCE-1 — diagnosis feedback did NOT improve repair. It cut edit production from 6 applied edits to 1, because the model stopped answering in the required format. 0 of 4 accepted in both arms.

2026-09-27. **Authorized by Micheal at a $2 cap**, recorded in the frozen definition before deploying.
**Spent about $0.20 of it.** Both arms ran on one harness commit (`6b9496f`), with candidates, model,
serving version, matching, stopping rules, budgets and decoding pinned identical. The only difference
was `--evidence basic` against `--evidence diagnosis`.

## The comparison

    arm  seed  disposition            rounds  applied  rounds with  accepted  post-check    errors
                                              edits    edit blocks            passing
    E0    2    RESTORED                  3       2         2          no      []              18
    E0    3    RESTORED                  3       1         2          no      []              18
    E0    4    RESTORED                  3       0         1          no      []              18
    E0    5    PRESERVE_INCOMPLETE       3       3         3          no      [1,2,3,5,7]      0
    E2    2    RESTORED                  2       1         1          no      []              18
    E2    3    RESTORED                  2       0         0          no      []              18
    E2    4    RESTORED                  2       0         0          no      []              18
    E2    5    RESTORED (reconstructed)  2       0         0          no      []              18

    totals   E0  12 rounds, 6 applied edits, 8 rounds produced edit blocks, 67.2 s, 4,066 tokens
             E2   8 rounds, 1 applied edit,  1 round  produced edit blocks, 11.7 s,   631 tokens

**OLD-SPEC ACCEPTANCE: 0 of 4 in both arms.** The loop's gate accepted nothing either way.

**NEW-SPEC ERROR-FREE, measured afterwards and deciding nothing: 0 of 8.** One row is not a zero
though, and it is E0's: seed 5 ended error-free with movement intact.

## The mechanism: the diagnosis prompt broke format compliance

E2's failure is not subtle and not about the diagnosis being wrong. **Three of four E2 candidates
produced no edit block at all.** They answered with a fenced HTML snippet instead:

    ```html
    <script>
        // ... (existing code)
        document.addEventListener('DOMContentLoaded', () => {
            document.getElementById('plant').addEventListener('click', () => { ...

The required format is `<<<<<<< FIND / ======= / >>>>>>> END`. The system prompt demanding it was
byte-identical in both arms; what changed is that the user message grew by **exactly 394 prompt tokens
in every seed** — the structured diagnosis. Generation collapsed with it: 631 output tokens across E2
against 4,066 across E0, and 2.8-3.2 seconds per run against 14.8-18.7.

**This is a recorded pattern in this project, arriving again.** Extra prose in the request has twice
before changed completion behaviour on this model family — an anti-truncation sentence took a gate from
4/4 to 0/4, and any added sentence raised forbidden-line reproduction. **Richer evidence is not free:
it competes with the output contract for the model's attention.**

## The one E2 edit is qualitatively the best repair direction anyone has produced

E2 seed 2's single applied edit abandoned the invented button and used an element the document
actually has:

    <<<<<<< FIND
    document.getElementById('plant').addEventListener('click', plantSeed);
    =======
    document.getElementById('gameCanvas').addEventListener('click', (event) => {
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((event.clientX - rect.left) / gridSize);
        const y = Math.floor((event.clientY - rect.top) / gridSize);
        const tileKey = `${x},${y}`;
        if (!tiles[tileKey] && inventory.seeds > 0) {
            tiles[tileKey] = { crop: 'seed', stage: 1 };
            inventory.seeds--;
        }
    });
    >>>>>>> END

**It did exactly what the DOM evidence should induce:** stopped depending on an element that is not
there, switched to `gameCanvas` — the only id the document has — and wrote correct guarded planting
logic with the seed spent inside the guard. It failed because the requirement is the **p key**, and a
canvas click is not a key press. The obligation list did carry the failing check by name; the model
satisfied the absence obligation and missed the requirement.

**So the evidence changed the repair direction in the one case it got a chance to.** That is a single
round, and it is the one piece of support for the hypothesis this experiment was built to test.

## E0's best row, and what it shows

E0 seed 5 reached `PRESERVE_INCOMPLETE` with movement intact, and its post-check under the stricter
spec passed step 7 with **zero errors raised**. That is the cleanest state any repaired candidate has
reached in this line of work: **the page loads, exposes state, moves, raises no errors — and does not
plant.** It is not an accepted repair and must not be described as one. It also, incidentally, fixed
the inherited `#day` defect, which nothing asked it to do.

## Against the pre-registered readings

- **"E2 reaches RETAIN where E0 does not"** — did not happen. 0 of 4 both ways.
- **"E2 changes the repair family but still fails"** — true for the one E2 round that produced an
  edit, and it changed family in the direction the evidence pointed.
- **"E2 behaves like E0"** — no. It behaved *worse on format* and *better on direction*.
- **"E2 declines instead of attempting"** — the engine never declined here: it reached
  `INTERFACE_NEVER_BUILT` on every first round, with a proposed line of 106.
- **"E2 is worse"** — **this is the outcome, on the measure that matters for throughput.** Six applied
  edits became one. A hypothesis, even labelled uncertain, arrives inside a longer prompt, and the
  prompt's length cost more than its content bought.

## Two record defects found in my own harness, and how they were closed

    the field collision   `row.diagnosis` held the ENGINE's plan, and the gate's failure
                          classification was then assigned over it - so on every round whose edit
                          applied, the engine's own record was destroyed. Renamed: `engineDiagnosis`
                          and `gateClassification`.
    the evidence window   `evidenceGiven` stored 1,200 characters starting at the file, so everything
                          added AFTER the file - the entire diagnosis - fell outside it, and the record
                          appeared to show a prompt carrying no diagnosis at all. It now stores the
                          message with the file elided.

**Neither affected what the model received**, and that was checked rather than assumed: E2's prompts
are exactly 394 tokens larger than E0's in all three comparable seeds, which is the diagnosis. The
per-round diagnoses were then recomputed at $0 from each round's own file — `diagnose` is pure over
captured evidence — confirming `INTERFACE_NEVER_BUILT` with proposed line 106 on every E2 first round.

## One record was lost and reconstructed, not quietly dropped

E2 seed 5's process exited **127** after round 2 and before writing its record — the external-
termination signature already on file for this environment. From the run log, round 1 produced no edit
block and round 2 stopped for want of new information, so **no edit was ever applied and the final file
is the untouched candidate**. Its loop verdict, post-check and engine diagnosis were therefore
recomputed locally at $0, and the record is marked `reconstructed: true` with that reasoning in it.
Its generation figures come from the log.

## Cost

    container window   09:04:28Z to stop returned 09:15:33Z = 665 s (11.1 min)
    A10G seconds       665 s at the verified $0.000306/s                     = $0.204
    image build        none: the image was already built
    TOTAL              about $0.20 of the authorized $2
    app state after    stopped explicitly, 0 deployed legasus-ollama apps remaining

**Generation was 79 s of that 665 s window — 12%.** The GPU idled through every local verification, so
**an escalation budget for this loop is priced in verifications, not tokens**, and E2's cheaper
generation bought nothing at all.

## What this establishes, and what it does not

- **Established:** under an otherwise identical loop, diagnosis feedback did not improve acceptance
  (0 of 4 both arms) and reduced applied edits from 6 to 1, by breaking output-format compliance.
- **Established:** the one diagnosis-driven edit moved to the interface the document actually has,
  which is the behaviour the evidence was meant to induce. One round.
- **NOT established:** that structured evidence cannot help. The confound is now format compliance,
  and separating them is a concrete next step: deliver the diagnosis with the format contract
  restated or repeated after it, or shorten the diagnosis to the facts alone.
- **NOT established:** anything about unfamiliar failures. The engine reached the same hypothesis on
  every candidate, because these four candidates share one defect.
- **Not autonomy.** The candidates, task, format, tolerance and catalogue are all mine.

Records: `DOM-EVIDENCE-1_DEFINITION.md`, `DOM-EVIDENCE-1_E0_seed{2,3,4,5}.json`,
`DOM-EVIDENCE-1_E2_seed{2,3,4}.json`, `DOM-EVIDENCE-1_E2_seed5_reconstructed.json`,
`DOM-EVIDENCE-1_run-E0.log`, `DOM-EVIDENCE-1_run-E2.log`, `DOM-EVIDENCE-1_window.log`.
