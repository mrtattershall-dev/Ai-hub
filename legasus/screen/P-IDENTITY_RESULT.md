# P-IDENTITY result — I1 confirmed, I2 FALSIFIED, and Stage B's case 3 collapses entirely
2026-09-21. Preregistration `P-IDENTITY_PREREG.md` (21f73ea). Cases reused from adbee47; no new
selection.

## Case 1 — I1 CONFIRMED: two non-analyst sources, two propositions

    S1 docstring   "Return the Path to the GitHub step summary file, or None if not set."
                   -> addresses CONFIGURATION only. Silent on writability.
    S2 type        `Path | None` -> silent.
    S5 tests       ABSENT - no test in the repository names this function.
    S6 consumer    `write_gh_step_summary` does `with sp.open(mode) as f` - UNGUARDED.
                   It behaviourally ASSUMES writability while stating nothing.

Two non-analyst sources support two different propositions with **opposite collision verdicts**,
and neither is obviously subordinate: the docstring states less than the consumer assumes. The
analyst's freedom in Stage B was not carelessness — **the sources themselves do not agree.**

## Case 2 — the project's own test DOES address the decisive state

    test_local_image_exists_api_error_false:
        mock_client.images.get.side_effect = derr.APIError("boom", None)
        ok = local_image_exists("broken:tag", client=mock_client)
        self.assertFalse(ok)

The decisive state (`API_ERROR`) is addressed explicitly by a project-authored test, which pins
`False`. So for this case a non-analyst source is **available and decisive about behaviour**.

**But it does not fix `P`.** The test asserts the *return value* — the collapsed representation
itself — not that treating an API error as "image absent" is correct. By the W-experiment's own
finding, a witness over the collapsed representation cannot separate *established absent* from
*unknown*. The test pins the collapse; it does not justify it. **A source can address the
decisive state and still not settle the proposition.**

## Case 3 — I2 FALSIFIED, and Stage B's case-3 finding collapses

    get_env(name, default)  ->  os.environ.get(name) or default

An empty environment value **falls back to the default**. `torch_cuda_arch_list` is
`env_str_field("TORCH_CUDA_ARCH_LIST", "8.9")`, line 218 writes that value back into the
environment, and line 221 reads it. `VllmTestParameters()` is constructed with no arguments at
the one call site in the tree.

**So the decisive state EMPTY is unreachable through the program's own data path.** I2 predicted
no source would address it; a source does — the `or default` in `get_env`, which excludes it.

### This also retracts Stage B's case 3

Stage B reported wrong entitlement for case 3 by calling `validate_cuda("")` **directly**,
supplying the empty string myself instead of letting the program produce it. The `all([])`
vacuity is real inside the function and **guarded upstream**. What I demonstrated was *"this
function can be wrong for an input"*, not *"this decision can be wrong in this program"* — a
different and weaker proposition.

> **Sixth instance of the pattern**: a weaker proposition evaluated in place of the frozen one.
> Here the substitution was in my choice of *input*, not in the criterion — and it survived until
> a source I was examining for another purpose exposed it.

Case 3's correct status: **no wrong entitlement demonstrated in this program.**

## Scoring

    I1  CONFIRMED   case 1's sources disagree; opposite collision verdicts
    I2  FALSIFIED   case 3's decisive state IS addressed - by a guard that makes it unreachable
    I3  CONFIRMED   no single source is decisive across the cases: S1 absent in two, S5 absent
                    in one, S6 assumes without stating, and where S5 exists it pins behaviour
                    rather than justifying the proposition

## What this establishes

1. **The analyst's freedom over `P` is real and is not merely analyst sloppiness.** In case 1 the
   sources genuinely disagree. Nothing available selects between them without an authority claim
   that is itself unjustified.
2. **Addressing the decisive state is not the same as fixing `P`.** Case 2's test does the first
   and not the second.
3. **A guard elsewhere can dissolve a collision entirely.** Case 3's decisive state is excluded
   upstream, so the local analysis was answering a question the program never asks.

Point 3 is the sharpest, and it is bad news for any analysis of the H-INFO kind conducted at a
single site: **whether a distinction matters can depend on code arbitrarily far from where the
distinction is erased.**

## What this does NOT establish

Not that `P` can never be fixed — only that these six sources do not fix it for these three
cases. Not that proposition provenance is the answer; nothing was installed. Not anything about
H-INFO's mathematical core, which is untouched: `P` varying inside an `R`-fibre still prevents
`P = g ∘ R`. What is damaged is its **operational usability**, which Stage B already suggested
and this confirms from the sources rather than from my behaviour.
