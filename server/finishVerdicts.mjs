/**
 * finishVerdicts.mjs - the ONE definition of "this finish was never verified".
 *
 * Data only. No I/O, no argv, no console, nothing that runs on import - which is the entire reason this file exists.
 *
 * The vocabulary lived in runIndex.mjs, and the training-corpus builder needed the same list so the corpus could not
 * teach what the series was flagging. But runIndex.mjs is a SCRIPT: it reads the index at top level and, when the index
 * is missing, prints a message and calls `process.exit(0)`. Importing it from tochat.mjs therefore risked terminating
 * the corpus builder before it wrote a single row - exiting 0, having done nothing, on any machine without a
 * run-index.jsonl. A module that both a script and a builder import must do nothing when imported.
 *
 * agent.js's finishVerdict() writes these values onto the run at the moment the status is decided:
 *   verified          the finish passed the gate and the runtime verifier
 *   screen_checked    a visual check stood in for the runtime verifier
 *   forced            route 1: the gate stepped aside after 3 blocks
 *   auto_clean_tests  route 2: auto-finished inside the test_web handler on 3 clean tests, entering no gate at all
 *   unverified        finished without evidence of either
 *   not_finished      the run did not reach a finish
 *
 * A value a reader does not recognise is NOT treated as clean, and an ABSENT value means the record predates the field
 * - unknown, not verified. Both consumers must keep that distinction: counting old rows as clean is how a blind spot
 * turns into a claim.
 */
// FG-5 RECEIPT (legasus/screen/FG-5-RECEIPT_PREREG.md, Amendment 1). Two additions, no other change:
//   unverified-no-work   route 3 (FG-3 ADMISSION): the gate refused once for zero landed writes and the second
//                        finish was allowed to END the run, recorded UNVERIFIED - never Verified. It was absent
//                        here, so runIndex rendered it 'ok' (EH1 2d82b379, R1a/R6): a downstream reader
//                        strengthening what the gate had explicitly refused to assert.
//   KNOWN                every value finishVerdict() can write. A reader that meets a value outside KNOWN must say
//                        so ('unknown'), never default to clean - the comment above already promised that; the
//                        reader did not keep it.
export const UNVERIFIED = new Set(['forced', 'auto_clean_tests', 'unverified', 'unverified-no-work']);
export const KNOWN = new Set(['verified', 'screen_checked', 'not_finished', ...UNVERIFIED]);
