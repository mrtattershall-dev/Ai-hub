---
name: guidance-transferred-addition-did-not
description: TRANSFER-1 2026-09-27 - on a page written AFTER the policy was frozen, site selection and containment both transferred (the other site rule fired, 5/5 completions truncated exactly right) but 0 of 5 accepted, because the model reassigned a const binding
metadata:
  type: project
---

2026-09-27, TRANSFER-1, $0 local. Policy frozen and committed at `36cc118`; **the page was written
after that commit**, so commit order proves no rule was adapted to it.

The 1.5B wrote a light-switch panel (not a farm game) from a one-line request. Its keydown
listener DISPATCHES (`if (e.key === '1')`) where the farm page's begins with an early return, so
**site rule R1 fired here where R2 fired there** - a shape the rules were not authored against.

    TRANSFERRED   site selection, with its reason stated
    TRANSFERRED   scaffold rules - it correctly invented no redraw (the page has drawPanel, not
                  draw, and the rule demands every existing handler call the same one)
    TRANSFERRED   structural containment - 5/5 truncated exactly right, keeping the 2 lines that
                  matter and dropping 3-5 lines of a second invented handler that would have bound
                  key 2 to turning all lamps ON. 0 refusals.
    DID NOT       the addition: 0 of 5 accepted

**"Zero regressions" has a boundary and it must be stated as three facts:** the carried-forward
checks PASSED in all five attempts (load, the three existing toggles, no errors during THOSE
steps); the candidates DID throw, 2 errors each, on the NEW action - damage that falls outside
what those checks exercise; and the baseline file is byte-identical after the run, with nothing
RESTORED because nothing failed the protected set, which is not the same as nothing breaking.

**The OBSERVED blocker is one word in the page:** `const LAMPS`. The model wrote
`LAMPS = [false,false,false]; drawPanel();` - correct in intent, illegal here - and pressing the
key threw `Assignment to constant variable`. A person writes `LAMPS.fill(false)`. Nothing in the
guidance told it the binding was const: the instruction is built from the requirement's words and
the scaffold from the file's structure, and **neither rule reads declarations.**

**But it is the observed blocker, not established as the whole cause.** Removing it may reveal the
next defect; five attempts stopping at the same point shows that point is reached reliably, not
that it is the only one. And the explanation is unproven: the declaration WAS in the file the
model was given - it had the fact and did not respect it - so "surface the declaration" is a
plausible next improvement, not a demonstrated missing ingredient. Feeding the runtime error back
is equally plausible. Neither is tested.

**Why:** this is the sharpest transfer finding available - the parts in doubt (site choice,
containment) worked on an unseen shape, and the failure is a single missing observation, not a
vague capability gap.

**How to apply:** the protocol is preserved - this result stands unrevised, and the fix (report
how the state to be changed is DECLARED) must be tested on a THIRD page neither version has seen.
`Assignment to constant variable` is also a clean new signature for
[[active-diagnosis-engine]], whose catalogue has no entry for it: the observation is the
declaration, the discriminating fact is whether the binding is const. See
[[accumulated-checks-and-structural-containment]].

**Unchanged rule hashes support preservation of the RULES, not the identity of the PROGRAM that
ran.** Three files differ from the frozen manifest and all three belong in the executed version's
provenance (`TRANSFER-1_EXECUTED_MANIFEST.txt`): `autoGuide.mjs` (task lookup widened beyond farm
tasks; guidance-function source hash identical), `localEdit.mjs` (it resolved its task AT IMPORT
TIME and exited the process, killing any run whose task lived in another group; containment source
hash identical), and `benchTasks.js` (`panelTasks()` added - the experimenter's input, where the
task had to be declared). Record the executed hashes, not just the frozen ones.
