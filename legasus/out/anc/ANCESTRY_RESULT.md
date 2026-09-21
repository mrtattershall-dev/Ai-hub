# BIND-CJS step 9 result — H-ANC denied, and it failed in one way rather than the two I predicted
2026-09-21 05:05. Preregistration `legasus/BIND-CJS_ANCESTRY.md` (d598a47), frozen before the
worlds existed. Mechanism `legasus/cjs-preload.mjs` @ e41c1e3, unchanged. H-ANC was **evaluated,
never adopted.** Process hygiene: 3 pids recorded, 0 alive at sweep.

## The hypothesis

    H-ANC: an observed execution belongs to an intervention iff the executing process is a
           descendant of the process under the mechanism.

## The three worlds

| world | process | ppid | loaded | H-ANC verdict |
|---|---|---|---|---|
| A-1 pre-existing worker | 19652 | 32236 *(the driver)* | SUBJECT | `belongs=null`, **not evaluable** |
| A-2 background descendant | 41868 | 24356 *(the witness)* | SUBJECT | `belongs=true`, evaluable |
| A-3 detached grandchild | 31028 | 26288 *(exited intermediate)* | SUBJECT | `belongs=null`, **not evaluable** |

**All three predictions confirmed. H-ANC is denied the status of a sufficient basis.**

## The correction to my own prediction, which matters more than the score

I framed A-1 as an attack on H-ANC's **extension** (it would *exclude* an execution a causal
account includes) and A-3 as an attack on its **evaluability**. Two different failure modes, I
said, scored separately.

Reality collapsed them into one. The worker was not *excluded* — H-ANC could not be **evaluated**
for it at all, exactly as for the grandchild, and for the same reason: its parent left no marker,
so the chain cannot be reconstructed from the evidence an intervention judgement actually has.

The mechanism behind both:

    H-ANC is evaluable from the recorded evidence ONLY for processes whose parent also appears
    in that evidence. In practice that is the ONE-HOP case: a direct child of the witness.

A-2 was evaluable only because `ppid == witnessPid` directly. Anything lateral (A-1) or deeper
with a silent intermediate (A-3) returns `null`. So the relation that looked like a clean
structural fact about the process tree is, from inside the evidence, a one-hop lookup that fails
silently the moment an intermediate does not happen to load the target — an accident having
nothing to do with lineage.

## What was killed

- **Under-inclusion:** an execution caused by the witness's own request, in a process that is not
  its descendant, yields no verdict at all.
- **Over-inclusion:** a descendant doing work outside every witness case is included, and its
  record is **identical in kind** to step 8's escaped descendant — the very case H-ANC was
  supposed to catch. Nothing recorded separates them without appeal to meaning.
- **Evaluability:** two of three worlds cannot be evaluated from the markers, and the failure is
  silent — `null`, not an error.

## Where this leaves the map

    final execution identity is enough            NO   (step 7)
    preserve every execution identity             NO   (step 8)
    uniformity across identities is enough        NO   (step 8)
    process ancestry establishes relevance        NO   (step 9, all three worlds)

Four candidate answers removed, none replaced. **What makes an observed execution evidence
about a particular intervention remains unknown**, and this experiment was not permitted to
invent it. No relation was adopted, no concept named, no field created.

## The shape now visible, stated as an observation and nothing more

Every candidate so far has tried to decide membership from **properties of the observation**
(which identity ran, how many ran, where in the sequence, which process, whose child). Three of
the four failed on extension; all four failed on some world. The one thing the evidence recorded
about A-1 that a causal account would care about — *the witness asked for that work* — is not a
property of the observation at all. Whether that is a direction or a dead end is not established
here and must not be assumed.

## What was not done

No replacement relation. No membership concept. The mechanism is untouched and is not accused of
anything. "The evidence does not entitle a conclusion" was treated as a possible finding
throughout, and for two of three worlds that is exactly what the evaluation returned.

## Next falsification, not started

Two candidates, neither chosen:

1. **Make evaluability itself the object.** Construct a world where the intermediate *does* load
   the target, so the chain is reconstructible, and check whether H-ANC then answers — and
   whether that answer is any more trustworthy for having depended on an unrelated accident.
2. **Attack the causal intuition directly.** A-1's worker executed because the witness asked.
   Build a world where a request is made and the work is done for an unrelated reason, or where
   work is done with no request. If "caused by the request" fails those, the next candidate dies
   before it is ever proposed — which is the cheapest way for it to die.
