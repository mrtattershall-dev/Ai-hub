/**
 * gateLoop.mjs - drive a goal with ONE NARROW PROMPT PER STEP, no conversation history.
 *
 *   node server/gateLoop.mjs                 # level 1
 *   GATE_GOAL="..." node server/gateLoop.mjs
 *
 * tatte 2026-09-12: "Each check should technically be a new prompt right? Wouldn't that keep 1.5b
 * focused?"
 *
 * WHY THIS EXISTS, from measurements taken today rather than from taste:
 *
 *   the gate ladder, one narrow job per call, no history     154/170 = 91%
 *   the full hub ReAct loop, same model, same goal           level 1 never completed, 6 firings
 *
 * and the sharpest single result in the ladder:
 *
 *   `finish` chosen from a four-way menu                     0/10
 *   the identical judgement asked ALONE                     10/10
 *
 * Same model, same state, same information. Only the framing differed.
 *
 * THE FAILURE THIS IS BUILT AGAINST. The last hub run wrote add.js, then called outline_file SIX
 * TIMES on a three-line file and died on the loop guard. The hub handed it the file contents twice
 * (mechanical substitution) and pardoned the repeat twice, and it still never added module.exports.
 * promptTok went 4,810 -> 8,590 while it re-read three lines. That is not a tooling failure; every
 * recovery the hub owns fired in order. It is a FOCUS failure, and the fix for focus is a smaller
 * question.
 *
 * WHY IT ECHOES, and why this design cannot. The model replays the BUILD PLAN because the plan is the
 * previous assistant turn sitting in history. There is no history here, so there is nothing to echo.
 *
 * THE STATE RULE, because the north star is LONG runs staying accurate and statelessness is how you
 * lose that: state lives ON DISK (the real workspace, and a tiny explicit summary), never in a
 * transcript. Each gate is handed the few facts it needs, freshly rendered. That is the same
 * substrate the hub already uses for TASKS.md and NOTES.md, and runSubtask is already a fresh-context
 * loop, so this is not a new idea in this codebase - only a smaller unit.
 *
 * WHAT IS HELD CONSTANT AGAINST THE HUB RUNS: the same model, the same goal text, and the same GOAL MET
 * content check.
 *
 * WHAT IS *NOT* HELD CONSTANT - corrected 2026-09-13 after an audit measured it, having been claimed
 * wrongly here and repeated in every comparison I gave. This header used to say writes go through the
 * real write_file "so the marker guard, the destructive-write guard and the syntax check all still
 * apply". Two of those three are true; the rest is false, because __toolPolicyTest.callTool is
 * `(name, args) => tools[name](args)` - the RAW tool function, not the drive() dispatch path.
 *
 *   still applies   the boundary-marker guard, safePath confinement   (inside tools.write_file)
 *   still applies   the destructive prose-over-code shrink refusal    (inside tools.write_file)
 *   SKIPPED         quickCheck syntax verdict                         (drive(), agent.js:3787)
 *   SKIPPED         lostDefs / lostExports refusals                   (drive(), agent.js:3834)
 *   SKIPPED         duplicate-definition refusal                      (drive(), agent.js:3872)
 *   SKIPPED         the missing-export note added today               (drive(), agent.js:3789)
 *   SKIPPED         repeat-call detection / run.callLog               (drive(), agent.js:3722)
 *   SKIPPED         auto-checkpoint, so there is NO git repo here     (drive(), agent.js:3417)
 *                   -> no undo, no git_diff/git_log, and the end-of-run syntax repair can never fire
 *                      because it keys on checkpoint steps to compute floorSha
 *
 * So this ladder runs with WEAKER write protection than the hub, not equal protection. That does not
 * undo its scores - each rung's proof is independent and stricter than the hub's - but it does mean the
 * only honest phrasing is "same model, same goal, same proof, fewer guards, different prompting".
 * A per-gate hub must re-acquire these, or it trades a finish problem for a destruction problem.
 */
import { mkdtempSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
// THE PER-GATE INDEX. tatte, 2026-09-13: "Build an index for each gate as well... that way they know
// where to grab tools, they know where XY and Z is, they don't have to go hunting and wasting more CPU
// room." Every discovery call a gate does NOT have to make is a whole prompt prefill saved - measured at
// 4,848-6,992 tokens per call at 0.2-1.2 tok/s. renderIndex costs 79 characters for a three-file
// workspace, so the trade is not close.
import { gateIndex, renderIndex } from './gateIndex.mjs';

const OLLAMA = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const MODEL = process.env.LADDER_MODEL || 'qwen2.5:1.5b';
const MAX_STEPS = parseInt(process.env.GATE_MAX_STEPS || '10', 10);
/**
 * THE LADDER. tatte: "If you keep getting perfect scores, complicate the prompts even more. Start
 * simple, perfect that, then expand." Level 1 is 5/5, so the rungs above it exist to find where the
 * per-gate design actually breaks.
 *
 * Each rung carries its own PROOF, run in a child process against the real file: the bar is that the
 * code LOADS and BEHAVES, never that it matches a regex. That is the lesson from level 1, where a
 * regex accepted ESM that could not load, and then a too-narrow criterion rejected valid CommonJS.
 */
const LEVELS = {
  1: {
    goal: 'Create add.js exporting a function add(a, b) that returns a + b.',
    file: 'add.js',
    proof: 'const m = require(process.argv[1]); const fn = typeof m === "function" ? m : m.add;'
      + ' if (typeof fn !== "function") { console.log("NOEXPORT:" + JSON.stringify(Object.keys(m))); process.exit(3); }'
      + ' if (fn(2,3) !== 5) { console.log("WRONG:" + fn(2,3)); process.exit(4); }'
      // THIS PROOF COULD NOT SEE THE BLEED. It called add(2,3) and nothing else, so it returned 12/12
      // while EVERY ONE of those twelve files had grown a guard the goal never asked for:
      //     if (typeof a !== "number" || typeof b !== "number") throw new TypeError(...)
      // add("2","3") throws in all of them. The rate was clean because the check only ever passed the
      // one input that could not expose the problem - the identical weakness that produced the false
      // level-3 12/12 two entries earlier, still live in a rung I had just called clean.
      // The goal is "a function add(a, b) that returns a + b". It says nothing about validating, so a
      // guard that REJECTS input is unrequested behaviour and the proof must be able to see it.
      // ONE CLAIM, NOT TWO. The first version of this asserted BOTH that add must not reject input
      // AND that add("2","3") === "23" - i.e. that the model reproduce JS string-concat semantics.
      // Only the first is supported by the goal ("returns a + b"). A guarded add fails both, so the
      // 0/12 it produced was directionally right; but an add returning NaN for strings would fail
      // ONLY the second, and that would be a false failure. Having been wrong in both directions
      // today - too narrow on the export shape, too lenient on the integer and round-trip checks -
      // the claim is narrowed to the defect actually observed: the model added a guard that REJECTS
      // input the goal never asked it to validate.
      + ' var extra = null;'
      + ' try { fn("2","3"); } catch (e) { extra = "add(\\"2\\",\\"3\\") threw " + e.constructor.name + " - the goal never asked add to validate"; }'
      + ' if (extra) { console.log("UNASKED: " + extra); process.exit(8); }'
      // TIGHTENED 2026-09-13, on tatte's instruction: "If it's perfect, make it perfecter."
      // Twelve runs passed everything above. Run against deliberate mutants, those checks STILL let
      // three defects through as PERFECT:
      //   () => 5                       - add(2,3)===5 cannot tell a function from a constant
      //   if (a<0||b<0) throw           - "2"<0 is false, so the string probe never fires
      //   if (a%1!==0||b%1!==0) throw   - "2"%1 is 0, the same blind spot
      // One input can never distinguish a function from a table holding one answer, and a string probe
      // only sees guards that reject STRINGS. Each check below is tied to one of those mutants and was
      // run against it before being trusted: 10/10, with both correct export shapes still accepted.
      // Tonight's twelve files were re-judged with this proof BEFORE it was installed - still 12/12.
      // That is the point: this tightens the QUESTION without moving the score, which is the only
      // honest way to raise a bar. A tightening that changed the score would need explaining first.
      + ' if (fn(10,7) !== 17) { console.log("CONSTANT: add(2,3) was right but add(10,7)=" + fn(10,7)); process.exit(9); }'
      + ' if (fn(0,0) !== 0) { console.log("ZERO: add(0,0)=" + fn(0,0)); process.exit(10); }'
      + ' var neg; try { neg = fn(-4,9); } catch (e) { console.log("UNASKED_NEG: add(-4,9) threw " + e.constructor.name + " - the goal never asked add to reject negatives"); process.exit(11); }'
      + ' if (neg !== 5) { console.log("WRONG_NEG: add(-4,9)=" + neg); process.exit(12); }'
      + ' var fl; try { fl = fn(1.5,2.25); } catch (e) { console.log("UNASKED_FRAC: add(1.5,2.25) threw " + e.constructor.name + " - the goal never said integers"); process.exit(13); }'
      + ' if (fl !== 3.75) { console.log("WRONG_FRAC: add(1.5,2.25)=" + fl); process.exit(14); }'
      + ' if (fn(2,3) !== 5) { console.log("STATEFUL: add(2,3) became " + fn(2,3) + " after other calls"); process.exit(15); }'
      + ' console.log("OK");',
  },
  2: {
    goal: 'Create s1_library.js exporting a Library class. It has addBook(isbn, title, copies) which throws a TypeError unless copies is a positive integer, and otherwise stores the book.',
    file: 's1_library.js',
    proof: 'const m = require(process.argv[1]); const L = typeof m === "function" ? m : m.Library;'
      + ' if (typeof L !== "function") { console.log("NOEXPORT:" + JSON.stringify(Object.keys(m))); process.exit(3); }'
      + ' const lib = new L();'
      + ' if (typeof lib.addBook !== "function") { console.log("NOADDBOOK"); process.exit(4); }'
      + ' lib.addBook("i1", "t", 2);'
      + ' let threw = false; try { lib.addBook("i2", "t", 0); } catch (e) { threw = e instanceof TypeError; }'
      + ' if (!threw) { console.log("NOTHROW: copies=0 was accepted, or the error was not a TypeError"); process.exit(5); }'
      // THE GOAL SAYS "POSITIVE INTEGER" AND THE FIRST VERSION OF THIS PROOF ONLY TESTED 0 AND 2.
      // A model writing `typeof copies !== "number" || copies <= 0` passes that and still accepts 2.5,
      // which is not an integer. That is a checker too LENIENT - the exact mirror of the too-narrow
      // export criterion that produced a false 0/5 at level 1. Both directions manufacture a wrong
      // answer; this one is worse because it manufactures a PASS.
      // Tightened to test what the goal actually states, not a weaker version of it.
      + ' let frac = false; try { lib.addBook("i3", "t", 2.5); } catch (e) { frac = e instanceof TypeError; }'
      + ' if (!frac) { console.log("NOTINT: copies=2.5 was accepted, but the goal says positive INTEGER"); process.exit(6); }'
      + ' console.log("OK");',
  },
  3: {
    goal: 'Create s2_stack.js exporting a Stack class with push(x), pop() and size(). pop() on an empty stack must throw a RangeError.',
    file: 's2_stack.js',
    proof: 'const m = require(process.argv[1]); const S = typeof m === "function" ? m : m.Stack;'
      + ' if (typeof S !== "function") { console.log("NOEXPORT:" + JSON.stringify(Object.keys(m))); process.exit(3); }'
      + ' const s = new S(); s.push(1); s.push(2);'
      + ' if (s.size() !== 2) { console.log("SIZE:" + s.size()); process.exit(4); }'
      + ' if (s.pop() !== 2) { console.log("POP_ORDER"); process.exit(5); }'
      // ROUND-TRIP FIDELITY. The first version of this proof only ever pushed 1 and 2, so it could
      // not see that push() was MANGLING its input:
      //     push(x) { this.items.push(Number.isInteger(x) ? x : Number.parseInt(x)); }
      // Integers pass through that ternary untouched, so twelve runs came back clean while a string
      // would have been turned into NaN. That is the lenient-proof failure from [81] repeating: a
      // check that only exercises the easy input manufactures a pass.
      // This asserts what push/pop MEAN rather than adding a requirement - a stack that does not
      // return what you put into it is not a stack, and the goal never asked for any coercion.
      + ' const r = new S(); r.push("hello");'
      + ' const back = r.pop();'
      + ' if (back !== "hello") { console.log("MANGLED: push(\\"hello\\") came back as " + JSON.stringify(back)); process.exit(7); }'
      + ' s.pop();'
      + ' let threw = false; try { s.pop(); } catch (e) { threw = e instanceof RangeError; }'
      + ' if (!threw) { console.log("NOTHROW: empty pop did not throw a RangeError"); process.exit(6); }'
      + ' console.log("OK");',
  },
  // RUNG 4 - TWO FILES THAT MUST AGREE. The first rung testing whether the gate SET generalises past
  // "write one file": it needs two path decisions, two body writes, and a relationship BETWEEN files.
  // tatte, 2026-09-13: "the only way we're gonna get a good result is by individualistic prompts not
  // one single monolithic prompt." This is the rung that tests that claim where it is still unproven.
  //
  // `wants` makes the finish-check use this rung's own proof (see the note there). Without it the run
  // would stop the moment math.js existed and report success on half the goal.
  //
  // THE CROSS-FILE CLAIM CANNOT BE MADE WITH TEXT. main.js printing "5" does not show that it USES
  // math.js, because console.log(5) prints 5 too. So math.js is mutated to return a sentinel, main.js is
  // re-run, and the output MUST change - then math.js is restored. Same reasoning as the second argument
  // pair that caught `() => 5` at level 1, where one input could not tell a function from a constant.
  //
  // Validated standalone before installation, 8/8: both correct styles accepted (destructured require
  // and namespace require), every fake rejected with its own code - missing math.js (7), no export (3),
  // wrong arithmetic (4), wrong output (5), HARDCODED print (6), crash (8).
  //
  // NO BACKSLASH APPEARS IN THIS PROOF, deliberately. Three attempts to author it through a shell
  // heredoc were destroyed by escape collapse - /(^|\D)5/ arrived as /(^|D)5/, a "\n" became a real
  // newline that unterminated a string, and even the line counting backslashes was itself collapsed.
  // So the sentinel file is written on ONE line and the output check uses indexOf, not a regex.
  4: {
    goal: 'Create math.js exporting a function add(a, b) that returns a + b, and main.js that requires math.js and prints add(2, 3).',
    file: 'main.js',
    wants: ['math.js', 'main.js'],
    proof: 'const fs = require("fs"), path = require("path"), cp = require("child_process");'
      + ' const mainPath = process.argv[1]; const dir = path.dirname(mainPath);'
      + ' const mathPath = path.join(dir, "math.js");'
      + ' if (!fs.existsSync(mathPath)) { console.log("NOMATH: math.js was never written"); process.exit(7); }'
      + ' const m = require(mathPath); const fn = typeof m === "function" ? m : m.add;'
      + ' if (typeof fn !== "function") { console.log("NOEXPORT_MATH:" + JSON.stringify(Object.keys(m))); process.exit(3); }'
      + ' if (fn(2,3) !== 5) { console.log("WRONG_ADD:" + fn(2,3)); process.exit(4); }'
      + ' const run = () => String(cp.execFileSync(process.execPath, [mainPath], { cwd: dir, encoding: "utf8", timeout: 15000 })).trim();'
      + ' let out1; try { out1 = run(); } catch (e) { console.log("MAIN_CRASHED:" + String(e.message).slice(0,60)); process.exit(8); }'
      + ' if (out1.indexOf("5") === -1) { console.log("MAIN_OUTPUT:" + JSON.stringify(out1)); process.exit(5); }'
      + ' const orig = fs.readFileSync(mathPath, "utf8");'
      + ' try {'
      + ' fs.writeFileSync(mathPath, "function add(a, b) { return 99; } module.exports = { add };", "utf8");'
      + ' let out2 = ""; try { out2 = run(); } catch (e) { out2 = "CRASH"; }'
      + ' if (out2 === out1) { console.log("MAIN_IGNORES_MATH: output unchanged after math.js was altered - main.js does not really use it"); process.exit(6); }'
      + ' } finally { fs.writeFileSync(mathPath, orig, "utf8"); }'
      + ' console.log("OK");',
  },
};
const LEVEL = parseInt(process.env.GATE_LEVEL || '1', 10);
const rung = LEVELS[LEVEL] || LEVELS[1];
const GOAL = process.env.GATE_GOAL || rung.goal;

process.env.AGENT_WORKSPACE = mkdtempSync(join(tmpdir(), 'gateloop-'));
const WS = process.env.AGENT_WORKSPACE;

// THE BOUNDARY MARKER, because leaving it out silently changed the answer.
//
// The first run of this loop reported GOAL MET: YES for a file containing `export const add = ...`.
// It was wrong, and MY harness made it wrong: this loop calls write_file through callTool and never
// goes through the path that runs ensureWorkspace(), so no package.json existed. With nothing
// declaring CommonJS, Node 24 will happily require() an ESM file - so it loaded for a reason the real
// hub would never give it. With the marker present the SAME file fails:
//     node --check -> SyntaxError: Unexpected token 'export'
//     require      -> throws
// and the hub's own quickCheck would have flagged that write at the moment it happened.
//
// This is the project's own recorded trap - "unstated env fact looks like model quality", where an
// int4 result of 1/6 vs 5/6 turned out to be CommonJS-vs-ESM rather than quantization. Same trap,
// same file type. The comparison against the hub is only honest if the ENVIRONMENT matches too, not
// just the model and the goal.
writeFileSync(join(WS, 'package.json'), JSON.stringify({
  name: 'agent-workspace', version: '0.0.0', private: true, type: 'commonjs',
}, null, 2) + '\n', 'utf8');
const { __toolPolicyTest } = await import('./agent.js');
const call = (tool, args) => __toolPolicyTest.callTool(tool, args);

/**
 * WHICH MODEL ACTUALLY ANSWERED. Every name Ollama reports back, across every gate of every step.
 *
 * tatte, 2026-09-13: "Every run should be 1.5b." It always has been - LADDER_MODEL is unset, both
 * runners default to qwen2.5:1.5b, and nothing else was ever loaded. But this file could not PROVE
 * that: it sent `model: MODEL` and trusted the request, while qwen15bRun.mjs asserts run.model from
 * the response and prints it.
 *
 * That asymmetry matters here more than it would elsewhere. SEVEN run outcomes today were decided by
 * my harness rather than the model, and two published claims had to be retracted. A measurement that
 * cannot state its own conditions is exactly the kind of artefact this session kept producing, and
 * "which model answered" is the most basic condition there is.
 */
const served = new Set();

/**
 * The validation guidance for THIS goal, or nothing at all.
 *
 * The whole point: a gate whose goal never mentions validating a value must not be told how to
 * validate values. Measured three times over, a permanent sentence in the shared write gate leaked
 * into whichever rung did not want it - coercion in level 3's push(), then validation in level 3's
 * push(), then an unrequested TypeError guard in level 1's add(). Every wording leaked somewhere.
 *
 * So the rule now travels with the GOAL rather than living in the prompt. If the goal says nothing
 * about validating, throwing, or rejecting, the model is told nothing about it - and the one thing it
 * IS told is to leave input alone, because that is the failure actually observed at levels 1 and 3.
 *
 * Deliberately keyed on the goal TEXT, not on the level number: the level is my bookkeeping, the goal
 * is what the model is actually being asked to do, and a gate should be driven by its own task.
 */
function validationHint(goal = GOAL) {
  const asksToValidate = /\bthrow\b|\bvalidat|\brejects?\b|\bmust be\b|\bunless\b|\binvalid\b/i.test(String(goal));
  if (!asksToValidate) {
    return 'This goal does not ask you to validate anything. Store and return values EXACTLY as given - do not check their types, do not convert them, and do not throw.\n';
  }
  // A BINARY "does this goal validate?" FLAG IS NOT ENOUGH, and my own probe caught that before it
  // cost a block. Level 3's goal says "must throw a RangeError" - about pop() on an EMPTY stack - so
  // any test for the word "throw" classifies it as a validating goal and hands it the
  // Number.isInteger line. That is the exact sentence whose leak made push() coerce, then validate.
  // I had rebuilt the same leak one layer up.
  //
  // So the whole-number rule is gated on the goal ACTUALLY MENTIONING whole numbers, not on the goal
  // merely throwing somewhere. Level 2 says "positive integer" and keeps the lever that took it from
  // 0/5 to 12/12; level 3 never mentions numbers and is told nothing about them.
  const asksWholeNumber = /\binteger\b|\bwhole number\b/i.test(String(goal));
  return 'This goal asks you to reject some input. Validate ONLY what the goal names, and nothing else - '
    + 'leave every other value exactly as given.\n'
    // THE THROW SHAPE MOVED IN HERE, and this is the whole fix for the level-1 leak.
    //
    // It used to sit in the write gate unconditionally, about thirteen lines BELOW this function's
    // own "do not throw" sentence. So a level-1 goal was told in prose not to throw and SHOWN, as a
    // literal example, `throw new TypeError("...")`. Measured over 20 runs of the wording
    //     "Build add.js. Required export: add, a function of two numbers returning their addition."
    // that produced an unrequested guard 3 times (15%), every failure reading
    //     UNASKED: add("2","3") threw TypeError
    // and one of them writing the error text "Both arguments must be numbers" - the goal's own phrase
    // "of two numbers" echoed back. Prose said no, the example said yes, and the example won.
    //
    // Which is this file's own measured lesson used against it: on this model a SHOWN SHAPE beats a
    // STATED RULE (a prohibition scored 0/5; showing the closing line worked). An instruction in a
    // shared prompt is a GLOBAL instruction - so the shape has to travel with the goals that want it,
    // exactly like the Number.isInteger line below and the CommonJS fact in the gate itself.
    //
    // Level 2 KEEPS it: its history says one combined guard was 6/6 correct while two split guards
    // were 4/4 wrong, so this shape is load-bearing there. That is why the fix is scoping and not
    // deletion, and why level 2 must be re-run as a control rather than assumed unaffected - moving
    // this sentence has broken a neighbouring rung three times already.
    + 'Put ALL the checks for one value in ONE if-statement with ONE throw, never several. For example:\n'
    + 'if (<check A> || <check B> || <check C>) { throw new TypeError("..."); }\n'
    + (asksWholeNumber
      ? 'When the goal says a value must be a whole number, test it with Number.isInteger(x) - typeof x === "number" is NOT enough, it accepts 2.5.\n'
      : '');
}

/**
 * TEMPERATURE IS PART OF THE BAR, so it must be settable and it must be stated.
 *
 * The gates ran at 0.1 while the hub runs at TEMPERATURE = 0.2 (agent.js:176), so every "perfect"
 * level-1 score so far was measured under EASIER, more deterministic sampling than the product
 * actually uses. That is a softer bar hiding inside a constant - the same way a lenient proof hides
 * inside a passing test. Default stays 0.1 so existing numbers remain reproducible; raising it is
 * now a deliberate, recorded act rather than an edit.
 *
 * qwen2.5's own card recommends 0.7, so 0.2 is hub parity and not yet the model's intended setting.
 */
const GATE_TEMP = parseFloat(process.env.GATE_TEMP || '0.1');

/** One gate = one model call. Narrow system rule, minimal state, hard stop, tiny budget. */
async function gate(system, user, { predict = 200, stop = ['\n\n'], temp = GATE_TEMP } = {}) {
  // A TRANSIENT OLLAMA STALL MUST NOT KILL A RUN. Level-2 run 4 died here with
  //     TypeError: fetch failed   { cause: UND_ERR_HEADERS_TIMEOUT }
  // right after route-gate: the 1.5B was mid-reload under CPU pressure and no response headers
  // arrived inside undici's 300s default. There was no timeout and no retry, so an unhandled
  // rejection took the whole process down and the run was recorded as a failure the model never
  // caused - the eighth harness fault to decide an outcome in one session.
  //
  // Worse, that inherited 300s is TIGHTER than the hub's own patience: agent.js waits
  // MODEL_FIRST_BYTE_S=420 with MODEL_TIMEOUT_S=1800 and MODEL_RETRIES=3. The ladder was therefore
  // STRICTER than the product it exists to be compared against, losing runs for a reason the hub
  // would have survived. Matched to the hub's numbers and its retry shape, including the lesson
  // recorded at agent.js:2165 - EACH ATTEMPT GETS ITS OWN BUDGET, because one shared timeout let
  // later attempts begin already dead.
  const RETRIES = parseInt(process.env.GATE_RETRIES || '3', 10);
  const PER_ATTEMPT_MS = (parseInt(process.env.GATE_ATTEMPT_S, 10) || 420) * 1000;
  const RETRY_MS = parseInt(process.env.GATE_RETRY_MS || '15000', 10);
  // The hub's isDropError predicate, over name + message + cause code. A headers timeout surfaces as
  // 'fetch failed', which this catches - checked against the actual run-4 error rather than assumed,
  // because a retry guard that cannot match the failure it was written for retries nothing.
  const isDrop = (e) => /Premature close|terminated|before any content|ECONNRESET|socket hang up|EPIPE|fetch failed|HeadersTimeout|UND_ERR/i
    .test(`${e?.name} ${e?.message} ${e?.cause?.code || ''}`);

  let r = null, lastErr = null;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      r = await fetch(`${OLLAMA}/api/chat`, {
        method: 'POST',
        // Per ATTEMPT, not per gate: a fresh budget each time round.
        signal: AbortSignal.timeout(PER_ATTEMPT_MS),
        body: JSON.stringify({
          model: MODEL, stream: false,
          options: { num_predict: predict, temperature: temp, num_ctx: 4096, stop, top_p: 0.8, top_k: 20, repeat_penalty: 1.05 },
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        }),
      });
      break;
    } catch (e) {
      lastErr = e;
      if (!isDrop(e) || attempt === RETRIES) throw e;
      console.log(`  (model connection dropped: ${String(e.message).slice(0, 60)} - nothing ran; waiting ${(RETRY_MS * attempt) / 1000}s and retrying the same gate, ${attempt}/${RETRIES})`);
      await new Promise((res) => setTimeout(res, RETRY_MS * attempt));
    }
  }
  if (!r) throw (lastErr || new Error('no response from the model'));
  const j = await r.json();
  // Record what the RESPONSE says, not what the request asked for. Ollama echoes the model it used.
  if (j.model) served.add(String(j.model));
  return { text: String((j.message || {}).content || '').trim(), tok: j.eval_count || 0, ms: 0 };
}

/** The durable state, rendered fresh for every gate. Never a transcript. */
const state = () => {
  const files = existsSync(WS) ? readdirSync(WS).filter((f) => !f.startsWith('.') && f !== 'package.json') : [];
  return { files, listing: files.length ? files.join(', ') : '(none)' };
};

let steps = 0, log = [];
const note = (s) => { log.push(s); console.log('  ' + s); };

console.log(`\n=== GATE LOOP - one prompt per step, no history ===`);
console.log(`MODEL ${MODEL}   GOAL ${GOAL}\nworkspace ${WS}\n`);

while (steps < MAX_STEPS) {
  steps++;
  const st = state();

  // ── GATE 1: FINISH, asked ALONE. 10/10 in the ladder; 0/10 as a menu item. ──────────────
  // ── FINISH IS A HARNESS CHECK, NOT A MODEL CALL. ───────────────────────────────────────
  //
  // It used to ask the model "is it finished?" and the model answered DONE, five times out of five,
  // about a file containing `function add(a, b) { return a + b; }` and no export whatsoever. It was
  // not lying - it was being asked a JUDGEMENT, and the gate ladder measured this model at 10/10 on
  // EXTRACTION and unreliable on judgement (the original done-gate answered YES to "is the goal
  // complete?" even for an empty workspace).
  //
  // The ladder's own conclusion was: ask for something checkable and let the HARNESS judge. Here the
  // harness can do better than checkable - it can just RUN the thing, which is exactly what the hub's
  // own finish gate does with verify_project. A model should never be asked a question the harness
  // can answer by executing the code.
  //
  // Deliberately GENERAL rather than hardcoded to add.js: every .js file in the workspace must load,
  // and at least one must export a function. That catches both failures seen so far - ESM in a
  // CommonJS workspace (throws on require) and a bare function with no exports ({} has no functions).
  // A RUNG THAT NEEDS SEVERAL FILES DECIDES ITS OWN "DONE", because the criterion below cannot.
  //
  // Demonstrated 2026-09-13 against a two-file goal (math.js exporting add, main.js requiring it and
  // printing add(2,3)), the criterion below is wrong in BOTH directions:
  //   only math.js written  -> targets is ['math.js'], it exports a function, so finished = true. The
  //                            run STOPS on half the goal and reports success. A fabricated victory.
  //   both files written    -> main.js is an entry SCRIPT and exports nothing, so the probe fails it
  //                            forever and the loop can NEVER finish.
  // There was also a second definition of done in this file: finish-check asked "does every .js export
  // a function?" while the VERDICT asks "does rung.proof pass?" - two criteria that can disagree, which
  // is how a run stops early and then fails its own proof. A rung carrying `wants` uses ONE criterion,
  // the same one the verdict uses.
  //
  // OPT-IN ON PURPOSE. Levels 1-3 carry no `wants`, so their path below is untouched and the 128-run
  // level-1 result stands without re-measurement. Changing the deciding path for existing consumers to
  // add a feature for a new one is the "fix on one route, not its sibling" mistake.
  // HOISTED so the PATH gate can see it. Measured 2026-09-13: rung 4 failed 2/2 with `NOMATH: math.js
  // was never written`, ten steps, every one writing main.js again. The finish-check computed `missing`
  // correctly and rendered it into a CONTINUE note for the LOG, then threw it away - while the path gate
  // sixty lines below was told only "Files that exist" and "Which file does this step write?". main.js
  // existed, so it kept answering main.js, for ever. Nothing in its prompt distinguished "already there"
  // from "still needed", and the one fact that decides the answer was one scope away.
  //
  // That is detect-but-don't-act, the pattern this project has named five times - and I built a fresh
  // instance of it in this file an hour ago. Empty for rungs 1-3, which carry no `wants`, so their path
  // gate prompt stays byte-identical and the 128-run level-1 result needs no re-measurement.
  let stillMissing = [];
  if (Array.isArray(rung.wants) && rung.wants.length) {
    const missing = rung.wants.filter((f) => !existsSync(join(WS, f)));
    stillMissing = missing;
    let ok = !missing.length, reason = missing.length ? `${missing.join(', ')} not written yet` : '';
    if (ok) {
      try {
        execFileSync(process.execPath, ['-e', rung.proof, join(WS, rung.file)], { cwd: WS, encoding: 'utf8', timeout: 40_000 });
      } catch (e) {
        ok = false;
        reason = String(e.stdout || '').trim().split('\n')[0] || 'the rung proof does not pass yet';
      }
    }
    note(`[${steps}] finish-check-> ${ok ? 'DONE' : `CONTINUE (${reason})`}  (0 tok - harness, not the model)`);
    if (ok) break;
  } else {
  const targets = st.files.filter((f) => f.endsWith('.js'));
  let finished = targets.length > 0;
  let why = targets.length ? '' : 'no .js file yet';
  for (const f of targets) {
    try {
      // ACCEPT EITHER EXPORT SHAPE. This demanded a NAMED function property, so it rejected
      //     module.exports = function add(a, b) { return a + b; };
      // which is perfectly valid CommonJS and exports exactly what the goal asked for - the module
      // IS the function. That cost a whole n=5 run reported as 0/5 against the model when the fault
      // was my acceptance criterion. Both shapes are correct JavaScript and a checker that knows only
      // one of them is measuring my taste, not the goal.
      const probe = 'const m = require(process.argv[1]); const ok = typeof m === "function" || Object.keys(m).some((k) => typeof m[k] === "function"); if (!ok) { console.log("NOEXPORT"); process.exit(3); } console.log("OK");';
      const out = execFileSync(process.execPath, ['-e', probe, join(WS, f)], { cwd: WS, encoding: 'utf8', timeout: 20_000 }).trim();
      if (out !== 'OK') { finished = false; why = `${f}: exports no function`; }
    } catch (e) {
      finished = false;
      why = `${f}: ${String(e.stdout || '').trim() === 'NOEXPORT' ? 'exports no function' : 'does not load'}`;
    }
  }
  note(`[${steps}] finish-check-> ${finished ? 'DONE' : `CONTINUE (${why})`}  (0 tok - harness, not the model)`);
  if (finished) break;
  }

  // ── GATE 2: ROUTE, with the decision rule STATED. 3/4 with the rule, 1/4 without. ───────
  const route = await gate(
    'You choose the next step of a coding task. Apply the FIRST rule that matches:\n'
    + '1. If a file the goal needs does not exist yet -> write_file\n'
    + '2. If a file exists but is MISSING something the goal asked for -> write_file\n'
    + 'Reply with EXACTLY one line:\nACTION: write_file',
    `GOAL: ${GOAL}\nFiles that exist: ${st.listing}\nWhat is the next step?`,
    { predict: 16 },
  );
  const tool = (route.text.match(/\b(write_file|read_file)\b/) || [])[0] || 'write_file';
  note(`[${steps}] route-gate  -> ${tool}  (${route.tok} tok)`);

  // ── GATE 3: PATH, bare value. 10/10 when the label is not demanded. ────────────────────
  const pathA = await gate(
    'You name one file. Reply with the filename and NOTHING else. No label, no quotes, no explanation.',
    // THE MISSING FILE IS A FACT, NOT SOMETHING TO INFER. Added only when the rung declares `wants`, so
    // rungs 1-3 render exactly as before. Without it this gate re-answered an already-written filename
    // ten times in a row while the harness knew, and had already printed, which file was absent.
    `GOAL: ${GOAL}\nFiles that exist: ${st.listing}\n`
    + (stillMissing.length ? `Still missing: ${stillMissing.join(', ')} — write one of these.\n` : '')
    + 'Which file does this step write?',
    { predict: 16 },
  );
  const path = pathA.text.split(/\s+/)[0].replace(/[`"',]/g, '');
  note(`[${steps}] path-gate   -> ${path}  (${pathA.tok} tok)`);

  // ── GATE 4: WRITE. Code only, no prose. 10/10 parsing in the ladder. ───────────────────
  const cur = existsSync(join(WS, path)) ? readFileSync(join(WS, path), 'utf8') : '';
  const body = await gate(
    // THE ENVIRONMENT FACT BELONGS IN THE GATE THAT NEEDS IT.
    //
    // Without the CommonJS line this gate scored 0/5: every run wrote `export const add = ...`, which
    // is a CORRECT export in the WRONG MODULE FORMAT and does not load in a workspace whose
    // package.json says "type": "commonjs". The hub's SYSTEM_PROMPT states that fact outright; I cut
    // the prompt down to one narrow instruction and cut a load-bearing fact out with it.
    //
    // That is the counterweight to the whole prompt-size thesis, and worth keeping in view: shrinking
    // the prompt made the model faster and stopped it echoing and looping, AND removed something it
    // genuinely needed. So the rule is not "less prompt" - it is "each gate carries exactly the facts
    // ITS decision depends on, and no others".
    // SHOW THE SHAPE, DO NOT STATE THE RULE. Measured across three n=5 runs of this exact gate:
    //   no format fact at all          -> 0/5, every run wrote `export const add = ...`  (SyntaxError)
    //   "use module.exports. NEVER
    //    use export or import"          -> 0/5, every run wrote a bare function and NO export at all
    // The prohibition was obeyed perfectly and the requirement was not heard. That is not the model
    // being stupid; it is the same thing the gate ladder measured at the start - this model's single
    // strongest ability is COPYING A FORMAT IT HAS BEEN SHOWN, and its weakest is inferring an
    // unstated rule. I gave it a rule twice and a shape zero times.
    // So the gate now ends with the literal line the file must finish with. Same reason the hub keeps
    // its examples rather than deleting them (see the example window in agentParse.js).
    // SECOND SHAPE ADDED, testing the [82] question: is the integer gap a WORDING gap or a ceiling?
    //
    // Level 2 is 0/5 because every run writes `typeof copies !== "number" || copies <= 0` while its
    // own error message says "must be a positive integer". It states the rule in prose and fails to
    // encode it. The only lever measured to work on this model is showing a SHAPE rather than stating
    // a RULE ([75]: rule -> 0/5 twice, shape -> 5/5), so this shows the predicate form.
    //
    // DELIBERATELY GENERIC. `Number.isInteger(x)` is a language fact, the same kind of thing as
    // `module.exports = { foo };`. Writing out the actual addBook guard would be handing over the
    // answer and the 5/5 would mean nothing. If a generic form is not enough, that is a real result:
    // it would say the model cannot map a stated constraint onto the right predicate, which is a
    // capability ceiling rather than a prompt defect - and worth knowing before betting on models
    // this size.
    'You write JavaScript source code for a CommonJS Node project.\n'
    // SCOPED TO WHAT THE FILE IS FOR. Unconditionally, "MUST end with module.exports" is correct for a
    // required module and destructive for an ENTRY SCRIPT - and rung 4 measured exactly that: 5 of 5 runs
    // wrote both files, and 4 of the 5 failed because main.js EXPORTED instead of printing.
    //     module.exports = { add: (a, b) => a + b, b: 42 };      -> MAIN_OUTPUT:""   (x3)
    //     module.exports = require('./math.js').add(2, 3);       -> ReferenceError   (x1)
    // 4 of 4 failing main.js files contained module.exports; 0 of 4 contained a print call. The single
    // PASS is the one run that ignored the instruction and wrote
    //     var math = require('./math.js'); console.log(math.add(2, 3));
    // So on this rung the instruction was ANTI-CORRELATED with success. The model was not failing the
    // task, it was obeying me - run 3 tried to satisfy both demands at once and produced nonsense.
    //
    // This is the same defect as the unconditional Number.isInteger line documented below (level 3, 0/12)
    // and as the throw-shape leak fixed today (3/20 -> 0/32): an instruction in a shared prompt is a
    // GLOBAL instruction. rung.file is the file the PROOF executes, so the harness already knows which
    // one is the entry - it just was not telling the gate whose decision depends on it.
    // THE CONDITION IS "DOES ANYTHING REQUIRE THIS FILE", NOT "IS IT rung.file".
    //
    // `path === rung.file` alone was WRONG and a rendered-text check caught it before any model call was
    // spent. At level 1, rung.file IS add.js and the path gate answers add.js, so that test is true - so
    // level 1 would have received the ENTRY wording and LOST the "must end with module.exports" line that
    // all 96 of its passing runs had. Its goal is "Create add.js EXPORTING a function add(a, b)" and its
    // proof requires that export: the fix would have told level 1 not to export the thing being proved.
    // Fourth instance today of fixing one route and breaking its sibling; the first one caught for free.
    //
    // A file is an entry SCRIPT only when the rung wants SEVERAL files and this is the one the proof runs.
    // With one file, the entry and the required module are the same file and it must still export.
    // Rungs 1-3 declare no `wants`, so they are excluded by construction and need no re-measurement.
    + (Array.isArray(rung.wants) && rung.wants.length > 1 && path === rung.file
      ? `${rung.file} is the ENTRY script - it is RUN, not required by anything. It must require what it needs and PRINT the result, for example:\n`
        + "var helper = require('./helper.js');\nconsole.log(helper.thing(1, 2));\n"
        + 'Do NOT end it with module.exports: nothing requires it, and exporting instead of printing produces no output.\n'
      // SHOW THE WHOLE FILE, NOT ITS LAST LINE. The example used to be the export statement ALONE -
      // "a file defining foo must end with: module.exports = { foo };" - which leaves the definition
      // implied by the words "a file defining foo" and shows, literally, a one-line file.
      //
      // Measured: after the entry/module split, main.js was correct in 10 of 10 runs and rung 4 still
      // failed 6 of 10 - every failure a byte-identical math.js reading exactly
      //     module.exports = { add };
      // i.e. exporting a name that was never declared -> "ReferenceError: add is not defined". The four
      // passes wrote the definition too. Six runs copied the shape they were shown; four inferred the
      // missing half. The example WAS a complete file as written, and it was a broken one.
      //
      // This is the show-a-shape mechanism that has decided every outcome today, pointed the wrong way:
      // a prohibition scored 0/5 where a shown closing line worked, an ESM example produced ESM files,
      // and an unconditional exports demand made the entry script export instead of print. A truncated
      // example teaches a truncated file.
      : 'This file is required by other files, so it must DEFINE what it exports and END with a '
        + 'module.exports line. A complete file looks exactly like this:\n'
        + 'function foo(a, b) {\n  return a + b;\n}\nmodule.exports = { foo };\n'
        + 'Never write module.exports = { foo }; without defining foo above it - that throws '
        + 'ReferenceError: foo is not defined.\n')
    // SCOPED TO VALIDATION THE GOAL ASKS FOR. Unconditional, this line read as "use Number.isInteger
    // wherever a number appears", and at level 3 - where nothing asks for validation at all - the
    // model put it inside push():
    //     push(x) { this.items.push(Number.isInteger(x) ? x : Number.parseInt(x)); }
    // 12 of 12 runs. push("hello") became null. Level 3 went 0/12 on the honest proof.
    //
    // That is [83]'s budget hypothesis in a form I was not watching for: not an instruction being
    // DROPPED, but one BLEEDING into a decision it was never meant to touch. Contamination, not
    // omission - and counting passes could never have revealed it, because my proof only ever pushed
    // integers, which survive that ternary untouched.
    //
    // NOT DELETED. Level 2 went 0/5 -> 12/12 on the strength of this line; removing it would trade a
    // level-3 failure for a level-2 one. The fix is a CONDITION on when it applies, which is the same
    // discipline the fix itself teaches: say what decision the instruction belongs to.
    // VALIDATION GUIDANCE IS NOW INJECTED PER GOAL, not carried permanently. See validationHint().
    //
    // Three wordings were measured and all three leaked, because the sentence lived in a prompt that
    // three different rungs share:
    //     unconditional  -> level 3 COERCED in push()            12/12 wrong
    //     scoped         -> level 3 VALIDATED in push()            9/12 wrong
    //     scoped, again  -> level 3 clean, level 1 now VALIDATES  12/12 wrong at level 1
    // Squeezing it at one end pushed it out the other. The defect was never the phrasing - it was that
    // an instruction in a shared prompt is a GLOBAL instruction, and it surfaces in every gate whether
    // or not that gate's goal asked for it.
    + validationHint()
    // THE SHAPE OF THE WHOLE DECISION, not of its parts. Measured across n=10 at level 2, the
    // correlation was PERFECT:
    //     one combined guard  -> 6/6 correct
    //     two split guards    -> 4/4 wrong (TypeError on the first branch, plain Error on the second)
    // So the model is not unreliable here - it is deterministic given a structural choice, and it
    // picks the good structure about two thirds of the time. Showing that structure is the direct
    // test of whether the choice can be made for it.
    //
    // DELIBERATELY PLACEHOLDERS, NOT THE REAL PREDICATES. Writing out
    // `typeof n !== "number" || !Number.isInteger(n) || n <= 0` would be handing over level 2's answer
    // and any 10/10 would mean nothing. <check A> teaches the shape and supplies no logic - the same
    // line I held at [83] when showing Number.isInteger generically rather than the addBook guard.
    // The one-if/one-throw shape that used to live here has moved INTO validationHint()'s validating
    // branch (see the note there). Shown to a goal that must not throw, it caused the very defect the
    // sentence above it forbade - 3/20 on a level-1 rewording. It still reaches every goal that does
    // ask for validation, which is why level 2 is re-run as a control rather than trusted.
    + 'Reply with the COMPLETE file contents and nothing else. No explanation, no markdown fences.',
    // THE INDEX GOES TO THE GATE THAT NEEDS IT, not to every gate.
    //
    // The write gate is the one that has to AGREE with files it did not write. Before this it saw only
    // `state().listing` - a bare comma-separated filename list - so on a two-file goal it had to GUESS
    // what the other file exported and how to require it. That is not a model weakness, it is missing
    // information: the answer was on disk and nobody handed it over. rung 4 (math.js + main.js that
    // must agree) is the first rung where guessing is fatal, which is exactly why the index lands here
    // first rather than everywhere at once.
    //
    // It carries exported NAMES, from exportNames() in defNames.js - the same function the hub uses on
    // its write path, fixed and pinned at 10/10 today after it turned out to be blind to
    // `module.exports = function NAME` and `module.exports = class NAME`.
    `GOAL: ${GOAL}\nFile: ${path}\n`
    + `Files already in the workspace and what each one exports:\n${renderIndex(gateIndex(WS))}\n`
    + (cur ? `It currently contains:\n${cur}\nRewrite it COMPLETE, keeping what is right and adding whatever the goal still needs.`
           : 'Write the complete file.'),
    { predict: 400, stop: [] },
  );
  let code = body.text;
  const fence = code.match(/```(?:javascript|js)?\n([\s\S]*?)(?:```|$)/);
  if (fence) code = fence[1];
  const res = String(call('write_file', { path, content: code.trim() + '\n' }));
  note(`[${steps}] write-gate  -> ${res.slice(0, 70)}  (${body.tok} tok)`);
  if (/^ERROR/.test(res)) note(`      refused: ${res.slice(0, 120)}`);
}

// ── the same content check the hub runner uses, so the two are comparable ────────────────
console.log(`\n--- VERDICT after ${steps} step(s) ---`);
// rung.file, NOT a hardcoded name. I added the LEVELS table and left this line pointing at add.js,
// so level 2 would have run the Library proof against a file that does not exist and reported
// "NO - (file absent)" on every run - a fabricated 0/N blaming the model for my own wiring. That is
// the same class of harness fault that has decided four runs today; the difference is that this one
// was caught by checking before firing rather than by reading a result afterwards.
const p = join(WS, rung.file);
const src = existsSync(p) ? readFileSync(p, 'utf8') : '';
// rung.file here too. The line above was fixed to stop resolving a hardcoded add.js; this one kept
// printing the NAME "add.js" over whatever file the rung actually used, so every level-2 dump was
// labelled add.js above the contents of s1_library.js. Harmless to the verdict, and exactly the
// "a report that says something other than what it measured" shape worth never leaving in place.
console.log(existsSync(p) ? `${rung.file} (${src.length} bytes):\n${src.split('\n').map((l) => '  ' + l).join('\n')}` : `${rung.file}: NOT WRITTEN`);
// GOAL MET IS DECIDED BY LOADING THE FILE, not by a regex over it.
//
// The regex version accepted `export const add = ...` because it matched /export\s/ - and that file
// does not load in a CommonJS workspace at all. A checker that passes code which cannot run is worse
// than no checker: it manufactures a success. The hub's own checkers score the FINAL FILE by running
// it, so this does the same - require it in a child process (so a syntax error cannot kill this one)
// and call what it exports.
// THE RUNG'S OWN PROOF, run in a child process so a syntax error cannot kill this one.
// Both export shapes count as correct (module.exports = fn, and module.exports = { fn }) - demanding
// only one of them is what produced a 0/5 against valid CommonJS at level 1.
let verdict = 'NO - (file absent)';
if (existsSync(p)) {
  try {
    const out = execFileSync(process.execPath, ['-e', rung.proof, p], { cwd: WS, encoding: 'utf8', timeout: 20_000 }).trim();
    verdict = out === 'OK' ? `YES - it loads and behaves (level ${LEVEL} proof passed)` : `NO - ${out}`;
  } catch (e) {
    // SAY WHICH FAILURE THIS IS. "it does not load" was wrong for most of these: the module loads
    // perfectly well and it is the PROOF'S OWN CALL that throws - push("hello") rejected by a guard
    // the goal never asked for. Reporting "your code will not load" when the truth is "your code
    // refused my input" is the same class of defect as every other instrument fault today, and it
    // would have sent the next investigation in entirely the wrong direction.
    const said = String(e.stdout || '').trim();
    const err = String(e.stderr || '');
    const line = err.split('\n').find((l) => /Error/.test(l)) || e.message;
    const loadFailed = /Cannot find module|Unexpected token|SyntaxError/.test(err);
    verdict = said
      ? `NO - ${said}`
      : loadFailed
        ? `NO - it does not load: ${String(line).slice(0, 110)}`
        : `NO - it loads, but threw while being exercised: ${String(line).slice(0, 110)}`;
  }
}
// The conditions travel with the result. A bare GOAL MET line is not a measurement on its own.
const names = [...served];
const modelOk = names.length === 1 && names[0] === MODEL;
console.log(`\nSERVED BY: ${names.join(', ') || '(no model call completed)'}`
  + (modelOk ? '  (matches, asserted from the response)' : `  !! EXPECTED ${MODEL} ONLY`));
console.log(`GOAL MET: ${verdict}`);
console.log(`\nworkspace kept at ${WS}`);
