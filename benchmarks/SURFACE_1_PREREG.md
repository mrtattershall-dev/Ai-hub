# PREREGISTRATION — SURFACE-1, discovering the authority surface instead of assuming a denominator

Frozen before the mechanism exists. Nothing else is in this commit. Builds on `ad0468b`.

## The correction this slice answers

> 251 exported functions is probably the wrong denominator. Some exports do not participate in
> authority at all, while some important authority transformations may be private. The thing
> LegaScreen needs to discover is not "every export," but the repository's authority surface.

So the deliverable is the report shape, with every number derived mechanically:

    STATIC AUTHORITY CANDIDATES        n
    DYNAMICALLY OBSERVED               n
    CONFIRMED AUTHORITY TRANSFORMS     n
    SCREENABLE                         n
    UNSCREENABLE                       n

and the caveat printed by the program, not by me.

## THE SEED PROBLEM, STATED BEFORE I SOLVE IT

Any discovery needs a root set, and a hand-authored list of authority functions would be the driver
problem wearing a new hat - I would be deciding the answer and then measuring it.

The only root set I am willing to use is one the repository's own SHAPE yields: a module-private
`WeakSet` used as an identity brand (`new WeakSet()`, then `.add(x)` to mint and `.has(x)` to test)
is an unforgeable-authority site, and it is findable by parsing rather than by naming. Everything
else propagates from there through the import and call graph, to a fixpoint.

Parsing is done with acorn, which is already present. **Regex over source is not acceptable here** -
this project's own ledger says measure the thing itself.

## PREDICTIONS

**S-1 (DECISIVE). The five numbers are produced, and no hand-authored list of authority functions
exists anywhere on the path.** Not a list of module names, not a list of function names, not a
vocabulary of authority-sounding words.
*Falsified if* any file on the discovery path contains such a list.

**S-2. The seed is discovered by SHAPE.** Brand sites are found as `new WeakSet()` plus `.add`/`.has`
on that binding. Nothing names `calculus`.
*Control S-2b (must fire):* a fixture module with the brand removed yields ZERO candidates - the
mechanism must not quietly fall back to names when the shape is absent.

**S-3. PRIVATE authority functions are discovered statically and are reported UNSCREENABLE.** A
module shim can wrap an export; it cannot wrap a binding that never leaves the module. I predict this
gap exists in this repository, and that naming it is more useful than a larger SCREENABLE number.
*Control S-3b (must fire):* a private function that calls an authority constructor IS discovered.

**S-4. Instrumentation is transparent, or the exception is reported.** The existing tests pass under
the discovered instrumentation set. Any module where they do not is reported UNSCREENABLE with the
reason, never dropped.

**S-5. CONFIRMED requires authority to have actually moved.** A statically nominated function that
executes but never produces or consumes a branded object is DYNAMICALLY OBSERVED and NOT CONFIRMED.
The discriminator is the subject's own brand predicate.
*Control S-5b (must fire):* such a function exists in the fixture and lands in that gap.

**S-6. SCREENABLE means an experiment actually ran.** Witness replayable AND at least one
perturbation reached OBSERVED. A transformation that is witnessed but whose every counterfactual is
refused is UNSCREENABLE, with the reason counted. `calculus.delegate` at K=0 is the known instance
and must land there.

**S-7 (PREDICTION OF NO DETECTION).** This slice adds no judgment and will produce no finding about
the repository.

## WHAT THIS SLICE DOES NOT ESTABLISH, STATED BEFORE THE RESULT

- **The surface is not complete and the report must say so.** The seed is a brand shape, so an
  authority-bearing transformation that never touches the branded calculus is invisible to this
  mechanism. That is a bound on the instrument, not a statement about the repository.
- No support formulas, no contract source, no judgment.
- SCREENABLE is not "screened". Nothing here compares an observation to a declaration, so the honest
  count of transforms actually SCREENED remains 1, hand-driven, and previously unknown repository
  defects discovered remains 0.
- The five prototypes remain unmerged.
