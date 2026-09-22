/**
 * hostEvent.js - the canonical host execution event, and the sink that consumes it.
 *
 * PHASE 1 OF THE LEGASUS INTEGRATION. See legasus/screen/PHASE1-OBSERVATION_PREREG.md.
 * This file OBSERVES. It decides nothing, prevents nothing, permits nothing. Phase 2 is
 * what makes a decision load-bearing, and it is a separate preregistration.
 *
 * WHY THIS EXISTS AT ALL
 * ----------------------
 * The hub already produces an execution record - saveTrace() in agent.js - but that record
 * was built as a TRAINING corpus. It keeps what a fine-tune wants (goal, final code, which
 * model, who asked) and discards what a governance decision needs (the before-image, the
 * per-step outcome, which entrance began the chain). Two different information contracts,
 * one schema.
 *
 * So LegaCore must NOT consume saveTrace() output. On 2026-09-19 (commit cf6dffd) this
 * project already paid for that lesson against an external producer: reconstructing
 * doctest's truth from a lower-fidelity rendering destroyed information, destroyed identity
 * and approximated semantics, and the fix was to run the real producer and record what it
 * SAID. The rule written down that day:
 *
 *     REASON AT THE BOUNDARY WHERE AUTHORITY ORIGINATES; ADAPT EVIDENCE RATHER THAN
 *     REENACTING THE AUTHORITY BEHIND IT.
 *
 * agent.js:3396 is where that authority originates for a tool execution: `tool`, `args`,
 * `beforeSrc`, `result` and `run` are all live in one lexical scope there. Nothing has to be
 * inferred, threaded or rebuilt. This module takes them at full fidelity, once, at that
 * point - and saveTrace() becomes a projection over the same reality rather than its source.
 *
 * WHAT MUST NEVER HAPPEN HERE
 * ---------------------------
 * 1. This code must never throw into the run loop. C4 of the prereg requires the hub suite
 *    to pass IDENTICALLY with a sink attached and without one. A sink is third-party code
 *    by construction; if it throws, that is the sink's problem and it stops here.
 * 2. A missing before-image is reported as MISSING, never as an empty string and never
 *    reconstructed. `'' !== null` matters: an empty file and an uncaptured file are
 *    different facts, and collapsing them is the information destruction this whole line of
 *    work exists to stop.
 * 3. Nothing in here may flatten a consumer's answer. Phase 1 has no verdicts, but the sink
 *    contract already says a consumer's return value is ignored rather than coerced - so
 *    that when Phase 2 introduces REFUSED / INSUFFICIENT_EVIDENCE / UNRESOLVED, no earlier
 *    code is in the habit of turning them into `false`.
 */
import { appendFileSync } from 'node:fs';

/**
 * Why a before-image is absent. The hub's capture at agent.js:3392 is narrow, and each
 * reason is a DIFFERENT fact about what the guard could have known - so they are separate
 * values rather than one "no".
 */
export const BEFORE_MISSING = {
  NOT_A_WRITE: 'not-a-write',            // the tool does not modify a file
  TOOL_NOT_COVERED: 'tool-not-covered',  // append_file: writes, but the hub captures nothing
  EXT_NOT_COVERED: 'ext-not-covered',    // .html/.css/.json/.gd/...: outside the capture regex
  NEW_FILE: 'new-file',                  // the read threw: there was nothing there before
};

const WRITE_TOOLS = new Set(['write_file', 'edit_file', 'append_file']);
// The hub's own capture condition, agent.js:3392. Mirrored here ONLY to explain an absence;
// it is never used to decide whether to capture. If that line changes, this explanation goes
// stale and says so loudly rather than silently mis-attributing.
const CAPTURED_EXT = /\.(py|c?js|mjs)$/i;

/** The sinks. Empty by default: with no sink attached this module is a few cheap branches. */
const sinks = [];

/**
 * Attach a consumer. Returns a detach function.
 *
 * A sink is `(event) => void`. Its RETURN VALUE IS IGNORED - deliberately. In Phase 1 a
 * consumer cannot influence anything, and the type signature is what enforces it: there is
 * no channel through which an answer could come back and be acted on.
 */
export function onHostEvent(fn) {
  if (typeof fn !== 'function') throw new TypeError('onHostEvent needs a function');
  sinks.push(fn);
  return () => {
    const i = sinks.indexOf(fn);
    if (i >= 0) sinks.splice(i, 1);
  };
}

/**
 * The Phase 1 consumer: append each event to a JSONL file.
 *
 * A FILE sink rather than an in-process callback, because the hub under test runs as a CHILD
 * PROCESS - mockLoop.test.mjs and testHarness.mjs both `spawn` index.js. An in-process
 * listener in a test could never observe a real run, so C1 ("every tool execution at 3396
 * produces exactly one event") would only ever be checkable against a REPLICA of the code
 * path instead of the path itself. This project has already paid for testing a replica: a
 * repro stopped by a different guard never reaches the code under test.
 *
 * It is also C4's on/off switch, and what makes that switch honest: with HOST_EVENT_LOG
 * unset there are zero sinks, emitHostEvent returns on its first line, and the hub does
 * strictly nothing extra.
 *
 * Append-only and best-effort. A sink that cannot write must not perturb the run it is
 * observing, so the write failure is swallowed by emitHostEvent's per-sink catch. A dropped
 * line is then a GAP IN THE OBSERVATION - a Phase 1 failure to report honestly, never a run
 * to kill. C1 counts events against the run's own steps precisely so a gap is visible.
 */
export function attachFileSink(path) {
  return onHostEvent((event) => {
    appendFileSync(path, JSON.stringify(event) + '\n');
  });
}

/** Test/diagnostic surface. `count` lets C4 assert "a sink really was attached". */
export const __hostEventTest = {
  count: () => sinks.length,
  clear: () => { sinks.length = 0; },
  build: (input) => buildEvent(input),
};

/**
 * Explain a null before-image. Ordered most-specific-first: a tool that does not write at
 * all is a different statement from one that writes but is not covered.
 */
function whyNoBefore(tool, path) {
  if (!WRITE_TOOLS.has(tool)) return BEFORE_MISSING.NOT_A_WRITE;
  if (tool === 'append_file') return BEFORE_MISSING.TOOL_NOT_COVERED;
  if (!path || !CAPTURED_EXT.test(path)) return BEFORE_MISSING.EXT_NOT_COVERED;
  return BEFORE_MISSING.NEW_FILE;
}

/**
 * Build the canonical event. Pure, exported for test, and deliberately NOT doing any I/O:
 * everything here is already in scope at the call site, which is the entire point.
 */
function buildEvent({ tool, args, beforeSrc, result, run, callKey, at }) {
  const path = args && typeof args.path === 'string' ? args.path : null;
  const hasBefore = typeof beforeSrc === 'string';
  return {
    v: 1,
    at: at ?? Date.now(),
    site: 'agent.js:3396',          // WHICH execution site. 2690 (subtask) and 4590
                                    // (approved pending) do NOT emit in Phase 1.
    // ── the action ──
    tool,
    args,                           // verbatim, not summarised - `path` alone was the
                                    // training projection's loss, not a contract.
    path,
    // ── the before-image, with absence as a REASON rather than a null ──
    before: hasBefore ? { present: true, text: beforeSrc } : { present: false, why: whyNoBefore(tool, path) },
    // ── the outcome. saveTrace keeps {type, tool, path} and drops this entirely. ──
    result: {
      text: result == null ? null : String(result),
      // The hub's own convention: a tool reports failure by RETURNING a string starting
      // "ERROR:", not by throwing (agent.js catches and rewrites it into exactly that).
      isError: /^ERROR/.test(String(result ?? '')),
    },
    callKey: callKey ?? null,       // tool + JSON(args); the duplicate-call identity
    // ── lineage. entrance is the ROUTE THAT BEGAN THE CHAIN, stamped at run creation and
    //    never inferred here. `source` is a different fact (what originated the GOAL), so
    //    both travel rather than being merged into one string.
    run: run ? {
      id: run.id,
      goal: run.goal ?? null,
      source: run.source ?? null,
      entrance: run.entrance ?? null,
      queueItemId: run.queueItemId ?? null,
      generation: run.generation ?? 0,
      depth: run.depth ?? 0,
      step: Array.isArray(run.steps) ? run.steps.length : null,
    } : null,
    actor: 'model',                 // at 3396 the immediate actor is always the model. The
                                    // human-approved site (4590) is where this differs, and
                                    // it is out of Phase 1 scope.
  };
}

/**
 * Emit one event. Called from the run loop, so it is total: it cannot throw, and it cannot
 * change what the caller does next.
 *
 * Returns nothing. There is intentionally no way for a consumer to answer.
 */
export function emitHostEvent(input) {
  if (sinks.length === 0) return;
  let event;
  try {
    event = buildEvent(input);
  } catch {
    return;                         // a malformed call site is not worth killing a run over
  }
  for (const fn of sinks) {
    try { fn(event); } catch { /* a sink's failure is the sink's, and stops here */ }
  }
}
