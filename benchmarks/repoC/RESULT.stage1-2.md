# Repo C — pyparsing 3.3.2 @ `legasus-freeze-r3` — stages 1–2

Subject pinned: manifest sha256 `98ebedf996d1331226865673fdc7ad9a6499b6e00992de51345c64b4801de420`,
17 files, 0 CRLF. Externally authored evidence: CPython `doctest`, whose verdicts r3 never receives
as input.

**Status: VALID MEASUREMENT.** The apparatus asked the frozen question and got an answer. Nothing here is
`APPARATUS INVALID`.

## The contingency table

    r3 classification        external verdict          n
    OBSERVED_OK              PASS                     56
    SETUP_FAILED             UNEXPECTED_EXCEPTION     44
    UNOBSERVABLE             PASS                     43
    OBSERVED_RAISED          UNEXPECTED_EXCEPTION     10
    SETUP_FAILED             PASS                      8
    OBSERVED_RAISED          OUTPUT_MISMATCH           5
    UNOBSERVABLE             OUTPUT_MISMATCH           5
    SETUP_FAILED             OUTPUT_MISMATCH           5
    OBSERVED_OK              OUTPUT_MISMATCH           3
    UNOBSERVABLE             UNEXPECTED_EXCEPTION      1

## The two frozen measurements

    COVERAGE      74/180 = 41.1% of authored examples observable by r3
    CALIBRATION   49/57  = 86.0% of SETUP_FAILED refusals supported by external evidence

**On the development corpus (`packaging`) coverage was ~94%: 0 setup failures and 10 unobservable of
163. On fresh code it is 41.1%.** That gap is the result.

## What r3 got WRONG — 8 miscalibrated refusals

`SETUP_FAILED | PASS = 8`. r3 claimed these examples never became experiments; the external verifier ran
the same examples successfully. This is a **claim that is false**, not a limitation honestly reported, and
it is the only cell that counts against calibration. Declining happened to be safe and earns no credit,
because the stated reason was wrong.

## What r3 got RIGHT that is easy to miss

`SETUP_FAILED | UNEXPECTED_EXCEPTION = 44`. These docstrings are **illustrative, not runnable** — they
reference names absent from their module namespace. Verified independently: CPython's own doctest fails
7 of 7 in `pyparsing.actions`. r3 and the external verifier agree, and this is a property of the corpus.

**The non-vacuity law held on fresh code.** Of the 49 examples r3 could not see, it reported
`UNOBSERVABLE` every time and never once claimed a clean negative. `UNOBSERVABLE IS NEVER AN ADMISSION`
survived contact with a repository it was not designed against.

## The coverage failure, diagnosed but NOT repaired

`UNOBSERVABLE | PASS = 43`, 88% of the unobservable cell. Cause, confirmed by direct probe:

> `observe()` in frozen r3 does not capture the invocation's stdout. Any doctest example that prints
> corrupts the JSON result channel, `JSON.parse` throws, and the witness returns `null` → `UNOBSERVABLE`.

pyparsing's doctests print constantly; `packaging`'s never did. This is the **run-0 channel-pollution
class inside frozen r3 itself**, invisible on the development corpus.

Per the frozen protocol this is a **CAPABILITY/COVERAGE failure, not apparatus invalidity**: r3 cannot
represent something pyparsing legitimately requires. **It is not fixed. The repair belongs to r4, and r4
requires Repo D.**

## An incidental confirmation

Execution-identity aliasing is **worse** on fresh code: 157 distinct code objects behind 78 distinct
name-keys, a 2.0x collapse. On `packaging` it was 142 behind 116, a 1.22x collapse. Had `module.co_name`
keying survived to Repo C, over half of pyparsing's executed code objects would have been conflated.

## Not yet run

CAPABILITY and COMMIT PRECISION require inference and have not been measured. Coverage of 41.1% bounds
what they could show: r3 can obtain authority to act on well under half of this target's evidence surface
before a model is ever consulted.
