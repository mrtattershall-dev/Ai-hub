# External applicability, installation experiment — result. F1..F7.

    Selection rule frozen at f841db1, BEFORE any candidate was enumerated or installed.
    Installation budget: 3 attempts. USED: 1.

## F1 — selection, mechanical

**Candidate order** (alphabetical, as frozen): `eslint`, `pyflakes`, `pylint`, `ruff`.
**Attempt 1 of 3: `npm install eslint` — succeeded.** No exclusions, no installation failures, and
the remaining two attempts were not used.

**The obligation was selected by the tool's own metadata, not by me.** `enumerate.mjs` walks
eslint's own `builtinRules` map in its own enumeration order and takes the first rule whose
`meta.type === 'problem'` — eslint's own classification, documented as *"code that will cause errors
or unintended behavior"*. That is the mechanical reading of the frozen "semantic correctness"
clause.

    292 builtin rules; the first four in the tool's own order:
      accessor-pairs           suggestion
      array-bracket-newline    layout
      array-bracket-spacing    layout
      array-callback-return    problem   <- SELECTED

    array-callback-return — "Enforce `return` statements in callbacks of array methods"
    https://eslint.org/docs/latest/rules/array-callback-return

I did not choose it, and it is not a rule I would have chosen: three of the first four are pure
formatting, and the one that qualified is about control flow through callbacks.

## F2 — can the registry express it AS IT STANDS?

**Partly, and the honest answer is more interesting than yes or no.**

The obligation reads naturally as a **universal claim over a domain**: *for all callbacks passed to
array methods in this module, the callback returns a value on every code path*. The registry's
`universal-from-exhaustive-coverage` is exactly that shape, and **it was used unchanged**. **No
registry rule was added or modified. The registry is still 3 authored rules.**

What the registry could **not** supply, and the adapter had to:

- **Rule identity.** The first attempt left `rule_digest` null and the runtime refused outright —
  *"derivation carries no rule identity. A derivation whose rule this runtime cannot resolve is one
  whose obligations it cannot enforce."* That refusal is correct, and it is structural: **eslint has
  no idea what a Legasus rule digest is and can never supply one.** So the adapter supplies it —
  which means **the adapter is the producer and eslint is the instrument.** An external tool does not
  become a Legasus producer by being wrapped; something on this side takes responsibility for rule
  identity, and that something is code I wrote.

## Human steering, recorded

| # | what I chose that the frozen rules did not determine |
|---|---|
| 1 | the **domain name** `ARRAY_METHOD_CALLBACKS_IN_MODULE`. The linter has no notion of a domain |
| 2 | the **predicate wording**, taken from the rule's own description and lightly reworded |
| 3 | **treating "eslint visited the whole file" as EXHAUSTIVE coverage of the domain.** The linter never says this. It is an inference from how the tool works, and it is the single largest assumption in the translation |
| 4 | the corpus of authored cases (a–d). I wrote them, so they are not independent evidence — which is why the external files below matter more |

**Steering 3 is the one to attack.** If eslint's traversal is *not* exhaustive over that domain in
some case, the coverage certificate is false and every acceptance built on it is unlicensed. Nothing
here establishes that it is exhaustive; it is asserted by me, from knowledge of the tool.

> **ATTACKED AND FALSIFIED — see `COVERAGE-AUDIT_RESULT.md`.** A file-level suppression, a
> line-level suppression and a **parse failure** each make the adapter certify the universal claim
> over a file that violates it. The acceptances below were **sound by the luck of the corpus, not
> warranted by the adapter's reasoning**: the same acceptance would have been produced had those
> files been suppressed or unparseable. Read every "agree" below with that attached.

## F3 — development

One case, declared before evaluation: **`a-dev-clean-and-violating.js`** (alphabetically first).
Result: linter `REJECT`, Legasus `FRONTIER_OPEN` — *"no closed alternative in the certificate;
Array.prototype.map() expects a value to be returned at the end of arrow function."* **Legasus's
refusal carries the linter's own reason across unchanged.**

## F4 — evaluation on reserved cases

Reserved before development, not inspected until here:

| file | linter | Legasus | verdict |
|---|---|---|---|
| `b-eval-all-paths-return.js` | ACCEPT | `ESTABLISHED` | agree |
| `c-eval-missing-return-in-filter.js` | REJECT | `FRONTIER_OPEN` | agree |
| `d-eval-foreach-is-not-a-violation.js` | ACCEPT | `ESTABLISHED` | agree |

`d` matters: `forEach` is *not* an array method this rule covers, and both sides accept. A naive
translation that keyed on "callback passed to an array method" would have refused it.

## F5 — useful acceptance, on code I did not write

Eight untouched files from **eslint's own source** (`lib/rules/*.js`, first eight by path order):
**all ACCEPT, all `ESTABLISHED`, all agree.** `array-callback-return.js` — the rule's own
implementation — is among them.

## F6 — consequential refusal: NOT achieved on external code

**This is the shortfall, and it is reported as one.** I scanned **3,154 untouched third-party files**
(649 in this experiment's `node_modules`, 2,505 in the hub's) for real violations of the selected
rule:

    files with a finding: 0

So the only refusals in this experiment are on **cases I authored**. A refusal on code I did not
write was not obtained, and **E6/F6 is therefore satisfied only against my own fixtures.** The
obvious reason is that well-maintained packages already lint clean against this exact rule — which
is a fact about the corpus, not evidence about Legasus.

## Discrepancies and unsupported translations

- **Discrepancies: none.** **11 of 11 evaluation cases** agree, in both directions. The denominator
  is **3 reserved cases + 8 untouched external files = 11**; the **development case is explicitly
  OUTSIDE it**, because the adapter was built against it.
- **Unsupported: the per-finding negative.** eslint reports *these specific callbacks violate*.
  Legasus represents the **universal** and refuses it; it does not carry each violation as its own
  admitted claim. The findings survive only as `frontier` text, not as structured claims. Expressing
  "there exists a violating callback" would need `existential-from-established-member` with a
  MEMBERSHIP witness per finding, and that was **not** built.

## What this establishes, and what it does not

**Establishes:** one externally selected, rule-identified obligation about source code was
translated into the existing registry without adding a rule, agreed with the external verifier on
**11 of 11 evaluation cases** (3 reserved + 8 untouched external; development case excluded from the
denominator), and produced refusals that carry the external tool's own reason.

**Does not establish:** that the framework transfers generally; that the coverage assumption
(steering 3) holds; that Legasus adds anything the linter did not already provide — on this rule it
**agreed with the linter everywhere and found nothing the linter did not find**; or that a
consequential refusal on foreign code is achievable, which remains **untested** after 3,154 files.

**The 0/15 result is untouched and is not affected by this experiment.** This is a separate
experiment about a separate obligation and is not added to that denominator.
