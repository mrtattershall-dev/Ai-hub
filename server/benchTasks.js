/**
 * benchTasks.js - THE BENCHMARK QUEUE: 15 external + 5 internally authored sequential.
 *
 * TWO GROUPS, REPORTED SEPARATELY. They answer different questions and must never be summed.
 *
 *   EXTERNAL (15)    independently authored bug-fix tasks from QuixBugs, each from its own
 *                    frozen seed, independent of each other.
 *                    Question: verified performance on tasks we did not write.
 *
 *   SEQUENTIAL (5)   internally authored, one small project, each step building on the ACCEPTED
 *                    state of the last.
 *                    Question: how far accumulation gets while earlier checks keep passing.
 *
 * "INDEPENDENTLY AUTHORED" DOES NOT MEAN UNSEEN. QuixBugs is public and long-lived; these
 * programs may appear in the model's training data. No public source avoids that, and it is
 * recorded rather than argued away.
 *
 * THE ADAPTER (external group). QuixBugs' own tests are pytest modules and the frozen worker has
 * no pytest. The upstream test DATA is preserved verbatim; only the RUNNER is replaced with
 * plain python3. Nothing about the programs, the bugs or the expected outputs is changed.
 *
 * REQUESTED vs PROTECTED for the external group is DISCOVERED, not designed:
 *   requested = every upstream case passes
 *   protected = the subset that already passes on the buggy seed must still pass
 * So the protected set is exactly the behaviour the program already had.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BENCH = join(HERE, '..', 'legasus', 'bench', 'quixbugs');
// BENCH_DIRS: comma-separated bench directories (each with its own SELECTION.json), so a
// HELD-OUT set selected later can be loaded beside - or instead of - the original 15.
// Default: the original directory only, exactly as every earlier campaign ran.
const BENCH_DIRS = String(process.env.BENCH_DIRS || '').split(',').map((x) => x.trim()).filter(Boolean).map((d) => (d.startsWith('/') || /^[A-Za-z]:/.test(d) ? d : join(HERE, '..', d)));

/** Identical testing guidance for every task in both groups. */
export const BENCH_GUIDANCE = [
  'Work only in the supplied workspace.',
  'Use run_command or run_python to inspect and test your changes.',
  'Node, Python 3 and Git are available offline; network access and package installation are unavailable.',
  'Preserve existing required behavior.',
  'Before declaring completion, run relevant checks and report what passed, failed, or could not be tested.',
  'A completion declaration does not determine the evaluator\'s result.',
].join(' ');

/** The plain-python case runner. Upstream DATA, replaced runner - the recorded adapter. */
const RUNNER = (name, onlyIdx) => [
  'import json, sys, importlib.util',
  `spec = importlib.util.spec_from_file_location("m", "/candidate/${name}.py")`,
  'm = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)',
  `fn = getattr(m, ${JSON.stringify(name)})`,
  'cases = [json.loads(l) for l in open("/check/cases.jsonl") if l.strip()]',
  onlyIdx ? `cases = [cases[i] for i in ${JSON.stringify(onlyIdx)}]` : '',
  'bad = 0',
  'for c in cases:',
  '    args, expected = c[0], c[1]',
  '    if not isinstance(args, list): args = [args]',
  '    try:',
  '        got = fn(*[list(a) if isinstance(a, list) else a for a in args])',
  '        try:',
  '            got = list(got) if hasattr(got, "__iter__") and not isinstance(got, (str, dict)) else got',
  '        except Exception: pass',
  '        if got != expected:',
  '            bad += 1; print("FAIL", args, "->", got, "expected", expected)',
  '    except Exception as e:',
  '        bad += 1; print("ERROR", args, type(e).__name__, e)',
  'print(("OK " if bad == 0 else "FAILED ") + str(len(cases) - bad) + "/" + str(len(cases)))',
  'sys.exit(1 if bad else 0)',
  '',
].filter(Boolean).join('\n');

/** The 15 external tasks, built from the vendored material and the frozen selection record. */
export function externalTasks() {
  const dirs = BENCH_DIRS.length ? BENCH_DIRS : [BENCH];
  return dirs.flatMap((dir) => externalTasksFrom(dir));
}
function externalTasksFrom(dir) {
  const selPath = join(dir, 'SELECTION.json');
  if (!existsSync(selPath)) return [];
  const sel = JSON.parse(readFileSync(selPath, 'utf8'));
  return sel.selected.map((t) => {
    const cases = readFileSync(join(dir, t.name, 'cases.jsonl'), 'utf8');
    const seed = readFileSync(join(dir, t.name, 'seed.py'), 'utf8');
    return {
      id: `ext-${t.name}`,
      group: 'EXTERNAL',
      source: 'QuixBugs',
      benchDir: dir,
      language: 'python',
      kind: 'bug-fix',
      goal: `The file ${t.name}.py contains a bug: it does not produce the correct result for all inputs. Fix ${t.name}() so that it is correct for every input. Keep the behaviour it already gets right.`,
      seed: { [`${t.name}.py`]: seed },
      requested: { script: `python3 /check/requested.py`, files: { 'requested.py': RUNNER(t.name, null), 'cases.jsonl': cases } },
      protected: { script: `python3 /check/protected.py`, files: { 'protected.py': RUNNER(t.name, t.protectedIdx), 'cases.jsonl': cases } },
      upstreamCases: t.upstreamCases,
      protectedCases: t.protectedIdx.length,
    };
  });
}

// ── THE SEQUENTIAL GROUP: internally authored, one small project ────────────────────────────
//
// Each step starts from the ACCEPTED state of the previous one and must keep every earlier
// check passing. A step whose prerequisite was not accepted is BLOCKED, not attempted - running
// it from a seed would silently convert a chain into five independent tasks.

const PKG = '{"name":"ledger","type":"commonjs"}\n';
const LEDGER0 = [
  'function addEntry(entries, item) { return [...entries, item]; }',
  'function total(entries) { return entries.reduce((a, e) => a + e.amount, 0); }',
  'module.exports = { addEntry, total };',
  '',
].join('\n');

const node = (expr) => ({ script: `node -e ${JSON.stringify(expr)}` });

/** Checks accumulate: step N's protected check is every earlier step's requested check. */
const S1 = "const l=require('/candidate/ledger.js'); const e=l.addEntry([], {item:'a',amount:5}); if (l.total(e)!==5) process.exit(1); if (typeof l.count!=='function'||l.count(e)!==1) process.exit(1); console.log('ok')";
const S2 = "const l=require('/candidate/ledger.js'); const e=[{item:'a',amount:5},{item:'b',amount:15}]; if (typeof l.largest!=='function') process.exit(1); if (l.largest(e).item!=='b') process.exit(1); if (l.largest([])!==null) process.exit(1); console.log('ok')";
const S3 = "const l=require('/candidate/ledger.js'); const e=[{item:'a',amount:5},{item:'b',amount:15}]; if (typeof l.byItem!=='function') process.exit(1); const m=l.byItem(e); if (m.a!==5||m.b!==15) process.exit(1); console.log('ok')";
const S4 = "const l=require('/candidate/ledger.js'); if (typeof l.removeItem!=='function') process.exit(1); const e=[{item:'a',amount:5},{item:'b',amount:15}]; const r=l.removeItem(e,'a'); if (r.length!==1||r[0].item!=='b') process.exit(1); console.log('ok')";
const S5 = "const l=require('/candidate/ledger.js'); if (typeof l.summary!=='function') process.exit(1); const s=l.summary([{item:'a',amount:5},{item:'b',amount:15}]); if (s.count!==2||s.total!==20||s.largest.item!=='b') process.exit(1); console.log('ok')";

const BASE = "const l=require('/candidate/ledger.js'); if (l.total([{item:'a',amount:5}])!==5) process.exit(1); if (l.addEntry([],{item:'x',amount:1}).length!==1) process.exit(1); console.log('base ok')";

/** Every earlier requested check, plus the original behaviour, as one protected script. */
const accumulated = (earlier) => node([BASE, ...earlier].map((c, i) => `try{ ${c.replace(/console\.log\('(?:base )?ok'\)/, '')} }catch(e){ console.log('step ${i} broke:', e.message); process.exit(1) }`).join('; ') + "; console.log('all earlier checks still pass')");

export const SEQUENTIAL_TASKS = [
  { step: 1, id: 'seq-1-count', dependsOn: null,
    goal: 'Add a count(entries) function to ledger.js that returns how many entries there are, and export it. Keep addEntry and total working exactly as they do now.',
    requested: node(S1), protected: node(BASE) },
  { step: 2, id: 'seq-2-largest', dependsOn: 'seq-1-count',
    goal: 'Add a largest(entries) function to ledger.js returning the entry with the highest amount, or null for an empty list. Export it. Keep everything else working.',
    requested: node(S2), protected: accumulated([S1]) },
  { step: 3, id: 'seq-3-byitem', dependsOn: 'seq-2-largest',
    goal: 'Add a byItem(entries) function to ledger.js returning an object mapping each item name to the sum of its amounts. Export it. Keep everything else working.',
    requested: node(S3), protected: accumulated([S1, S2]) },
  { step: 4, id: 'seq-4-remove', dependsOn: 'seq-3-byitem',
    goal: 'Add a removeItem(entries, name) function to ledger.js returning a new list without entries for that item. Export it. Keep everything else working.',
    requested: node(S4), protected: accumulated([S1, S2, S3]) },
  { step: 5, id: 'seq-5-summary', dependsOn: 'seq-4-remove',
    goal: 'Add a summary(entries) function to ledger.js returning an object with count, total and largest for the entries. Export it. Keep everything else working.',
    requested: node(S5), protected: accumulated([S1, S2, S3, S4]) },
].map((t) => ({
  ...t, group: 'SEQUENTIAL', language: 'node', kind: 'sequential', source: 'internally authored',
  seed: { 'package.json': PKG, 'ledger.js': LEDGER0 },
}));

// ── THE FARM: the builder's own target. A request, a declared play the model did not write,
// and a state contract the request names. Built from NOTHING (empty seed); the first increment
// has nothing to protect, later increments protect every step the previous one passed.
const FARM_DIR = join(HERE, '..', 'legasus', 'bench', 'farm');
// M1-LIVE-1 (2026-09-26): asked for the whole game at once, the local 1.5B streamed 21,133
// characters in 836 s and never finished the reply. The product is built in INCREMENTS: each
// increment is a small request, a subset of the play as its requested check, and every
// earlier step as protected. Each increment starts from the previous ACCEPTED workspace
// (dependsOn); one that was not accepted blocks the next.
const FARM_INCREMENTS = [
  { id: 'farm-i1', steps: [1, 2, 3], ask: 'Increment 1: a player square that moves on a tile grid with the arrow keys, drawn on the canvas. Expose window.game.state() with player, tiles ({}), inventory ({ seeds: 5, crops: 0 }) and day (0).' },
  { id: 'farm-i2', steps: [1, 2, 3, 4, 5], ask: 'Increment 2: planting and growth. p plants a seed on the player\'s tile (a tile entry { crop, stage: 0 }, seeds go down by one); t advances time by one tick (day goes up by one, every planted tile\'s stage goes up by one until it is grown at stage 3). Draw planted tiles.' },
  { id: 'farm-i3', steps: [1, 2, 3, 4, 5, 6], ask: 'Increment 3: harvesting. h on a grown tile (stage 3 or more) removes the tile and adds one to inventory.crops.' },
  { id: 'farm-i4', steps: [1, 2, 3, 4, 5, 6, 7, 8], ask: 'Increment 4: saving. s writes the whole state to localStorage; when the page loads, a saved state is restored. No console errors anywhere.' },
];
// ONE NAMED HANDLER, WITH A STOPPING RULE. INC3-1: twenty attempts at increment 2 (planting AND
// growth, over an existing page) produced no implementation at all. farm-plant asks for ONE
// handler and states what must NOT happen as explicitly as what must: on an empty tile with seeds
// available, create a crop and spend exactly one seed; in every other case leave the state
// untouched. Its play checks the negative clause on its own - pressing p again on the same tile,
// and pressing p with no seeds left - so "it plants" cannot be scored without "it stops planting".
// Movement is checked as the protected set, separately from the handler.
const FARM_PLANT = {
  id: 'farm-plant', steps: [1, 2, 3, 4, 5, 6], protectedSteps: [1, 2, 3],
  ask: "One change only: make the p key plant. When the player's tile is empty AND inventory.seeds "
    + "is greater than zero, add a tile entry { crop: 'wheat', stage: 0 } at the player's tile and "
    + 'reduce inventory.seeds by exactly one. In every other case - the tile already has a crop, or '
    + 'there are no seeds left - p must change nothing at all. Do not add growth, harvesting or '
    + 'saving. Do not change how the arrow keys move the player.',
};

export function farmTasks() {
  const playPath = join(FARM_DIR, 'play.json');
  if (!existsSync(playPath)) return [];
  const spec = JSON.parse(readFileSync(playPath, 'utf8'));
  const subset = (steps) => ({ ...spec, name: `${spec.name}-steps-${steps.join('')}`, steps: spec.steps.filter((s) => steps.includes(s.n)) });
  const base = `The game is a single self-contained web page, index.html: plain HTML5 canvas and JavaScript, no frameworks, no external files or CDNs. ${spec.contract}`;
  let prev = null, prevSteps = [];
  const out = [];
  for (const inc of FARM_INCREMENTS) {
    const mine = subset(inc.steps);
    out.push({
      id: inc.id, group: 'FARM', source: 'internal', language: 'javascript', kind: 'build', dependsOn: prev,
      goal: `${prev ? 'Continue the farming game already in index.html. ' : 'Build me a small farming game. '}${inc.ask} ${base}${prev ? ' Everything that already works must keep working.' : ''}`,
      seed: {},                                                    // the runner seeds a chained increment from the previous ACCEPTED workspace
      requested: { play: { spec: mine, steps: inc.steps } },
      protected: prevSteps.length ? { play: { spec: subset(prevSteps), steps: prevSteps } } : null,
      diagnostic: { kind: 'play', spec: mine, timeoutSec: 90 },
      upstreamCases: inc.steps.length, protectedCases: prevSteps.length,
    });
    prev = inc.id; prevSteps = inc.steps;
  }

  // A VERSIONED CORRECTED CHECK. The accepted increment-1 page throws five times during the arrow-key
  // movement it was accepted FOR - draw() ends with document.getElementById('day').textContent and
  // there is no such element - and step 1 cannot see it, because step 1 is evaluated before any key
  // is pressed. That is a test-coverage gap in the check, not a property of the page's successors,
  // and the honest response is to version the check rather than edit the one earlier results were
  // measured against. farm-plant-v2 adds a final step asserting that NO error was raised at any
  // point in the run. The baseline FAILS it, which is the point: comparisons already under way stay
  // on farm-plant, and new work can adopt the stricter spec deliberately.
  const plantV2Path = join(FARM_DIR, 'play-plant-v2.json');
  if (existsSync(plantV2Path)) {
    const v2 = JSON.parse(readFileSync(plantV2Path, 'utf8'));
    const sub = (steps) => ({ ...v2, name: `plant-v2-steps-${steps.join('')}`, steps: v2.steps.filter((x) => steps.includes(x.n)) });
    const requested = [1, 2, 3, 4, 5, 6, 7];
    const mine = sub(requested);
    out.push({
      id: 'farm-plant-v2', group: 'FARM', source: 'internal', language: 'javascript', kind: 'build',
      dependsOn: 'farm-i1',
      goal: `Continue the farming game already in index.html. ${FARM_PLANT.ask} No page or console error may be raised at any time. The game is a single self-contained web page, index.html: plain HTML5 canvas and JavaScript, no frameworks, no external files or CDNs. ${v2.contract} Everything that already works must keep working.`,
      seed: {},
      requested: { play: { spec: mine, steps: requested } },
      protected: { play: { spec: sub(FARM_PLANT.protectedSteps), steps: FARM_PLANT.protectedSteps } },
      diagnostic: { kind: 'play', spec: mine, timeoutSec: 90 },
      upstreamCases: requested.length, protectedCases: FARM_PLANT.protectedSteps.length,
    });
  }

  // farm-grow: the FRESH task for ASSIST-2. I supply the requirement and the checks. I do NOT supply
  // the edit site or the solution's structure - those are what the policy under test has to choose,
  // and this task exists because replaying a solved one would only show that a known procedure can be
  // automated. It starts from the page ASSIST-1 produced, so planting is already working and is
  // protected.
  const growPath = join(FARM_DIR, 'play-grow.json');
  if (existsSync(growPath)) {
    // Every requirement already accepted, looked up rather than restated.
    const v2Task = out.find((t) => t.id === 'farm-plant-v2');
    const g = JSON.parse(readFileSync(growPath, 'utf8'));
    const sub = (steps) => ({ ...g, name: `grow-steps-${steps.join('')}`, steps: g.steps.filter((x) => steps.includes(x.n)) });
    const requested = [1, 2, 3, 4, 5, 6];
    const protectedSteps = [1, 2, 3];
    out.push({
      id: 'farm-grow', group: 'FARM', source: 'internal', language: 'javascript', kind: 'build',
      dependsOn: 'farm-plant',
      // The requirement, in words, and nothing about where or how.
      goal: 'Continue the farming game already in index.html. The t key advances time: day goes up by one, and every planted tile grows by one stage, stopping at stage 3. t must not create or remove tiles. Everything that already works must keep working. The game is a single self-contained web page, index.html: plain HTML5 canvas and JavaScript, no frameworks, no external files or CDNs. ' + g.contract,
      requirement: {
        trigger: { kind: 'key', key: 't' },
        effects: ["day goes up by one", "every planted tile's stage goes up by one, stopping at 3"],
        invariants: ['no tile is created or removed', 'everything that already works keeps working'],
      },
      seed: {},
      requested: { play: { spec: sub(requested), steps: requested } },
      // THE PROTECTED SET IS COMPUTED, NOT CHOSEN. ASSIST-2 was accepted while breaking a previously
      // accepted behaviour - planting stops when seeds run out - because I hand-picked three protected
      // steps and that behaviour was not among them. The protected set is now the UNION of every
      // previously accepted requirement plus this task's own preserved subset, and each accumulated
      // requirement runs as its OWN sequence from a fresh load.
      //
      // INTENTIONAL CHANGES are explicit: `supersedes` names a requirement that a later one replaces,
      // with the reason, so dropping a check is always a recorded decision rather than an omission.
      accumulates: ['farm-plant-v2'],
      supersedes: [{
        requirement: 'farm-plant',
        replacedBy: 'farm-plant-v2',
        reason: 'the same planting requirement with the no-error clause added; checking both would test the same behaviour twice',
      }],
      protected: {
        plays: [
          ...(v2Task ? [{ from: 'farm-plant-v2', spec: v2Task.requested.play.spec, steps: v2Task.requested.play.steps }] : []),
          { from: 'farm-grow (its own preserved subset)', spec: sub(protectedSteps), steps: protectedSteps },
        ],
      },
      diagnostic: { kind: 'play', spec: sub(requested), timeoutSec: 90 },
      upstreamCases: requested.length,
      protectedCases: protectedSteps.length + (v2Task ? v2Task.requested.play.steps.length : 0),
    });
  }

  // farm-plant rides its own play spec (play-plant.json), which carries the negative clauses.
  const plantPath = join(FARM_DIR, 'play-plant.json');
  if (existsSync(plantPath)) {
    const pspec = JSON.parse(readFileSync(plantPath, 'utf8'));
    const psub = (steps) => ({ ...pspec, name: `plant-steps-${steps.join('')}`, steps: pspec.steps.filter((x) => steps.includes(x.n)) });
    const mine = psub(FARM_PLANT.steps);
    out.push({
      id: FARM_PLANT.id, group: 'FARM', source: 'internal', language: 'javascript', kind: 'build',
      dependsOn: 'farm-i1',
      // NOT `base`: that carries play.json's contract, which lists every key including t, h and s,
      // and handing back the whole feature list would contradict "one change only". play-plant's
      // own contract states the state shape and nothing else.
      goal: `Continue the farming game already in index.html. ${FARM_PLANT.ask} The game is a single self-contained web page, index.html: plain HTML5 canvas and JavaScript, no frameworks, no external files or CDNs. ${pspec.contract} Everything that already works must keep working.`,
      seed: {},
      requested: { play: { spec: mine, steps: FARM_PLANT.steps } },
      protected: { play: { spec: psub(FARM_PLANT.protectedSteps), steps: FARM_PLANT.protectedSteps } },
      diagnostic: { kind: 'play', spec: mine, timeoutSec: 90 },
      upstreamCases: FARM_PLANT.steps.length, protectedCases: FARM_PLANT.protectedSteps.length,
    });
  }
  return out;
}

/**
 * THE TRANSFER TASK. A page the 1.5B wrote from a one-line request, whose structure I read only to
 * validate its baseline and write these checks - never to change a policy rule. Its keydown handler
 * DISPATCHES on key values with no early return, which is a different shape from the farm page, so the
 * site rules face a case they were not authored against.
 *
 * Requirement supplied; site and structure NOT supplied. Protected = every carried-forward check.
 */
export function panelTasks() {
  const dir = join(HERE, '..', 'legasus', 'bench', 'panel');
  const specPath = join(dir, 'play-panel.json');
  if (!existsSync(specPath)) return [];
  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  const sub = (steps) => ({ ...spec, name: `panel-steps-${steps.join('')}`, steps: spec.steps.filter((x) => steps.includes(x.n)) });
  // The lamps the page already had: load, the three toggles, and no errors.
  const existing = [1, 2, 3, 4, 8];
  const requested = [1, 2, 3, 4, 5, 6, 7, 8];
  return [{
    id: 'panel-alloff', group: 'PANEL', source: 'internal', language: 'javascript', kind: 'build',
    dependsOn: null,
    goal: 'Continue the light switch panel already in index.html. Pressing 0 turns every lamp off. It must never turn a lamp on. Everything that already works must keep working. The page is a single self-contained web page, index.html: plain HTML5 canvas and JavaScript, no frameworks, no external files or CDNs. ' + spec.contract,
    requirement: {
      trigger: { kind: 'key', key: '0' },
      effects: ['every lamp is off'],
      invariants: ['no lamp is ever turned on by this key', 'everything that already works keeps working'],
    },
    seed: {},
    requested: { play: { spec: sub(requested), steps: requested } },
    accumulates: ['the page as delivered'],
    supersedes: [],
    protected: { plays: [{ from: 'the page as delivered', spec: sub(existing), steps: existing }] },
    diagnostic: { kind: 'play', spec: sub(requested), timeoutSec: 90 },
    upstreamCases: requested.length, protectedCases: existing.length,
  }];
}

/**
 * ASSISTED-1's task, on page A2 (`legasus/bench/traffic/baseline-a2.html`, sha 9ae3cb01e221b98a).
 *
 * The page's OWN behaviour is a cycle: all three of keys 1, 2 and 3 call the same switchLight(), which
 * advances red -> yellow -> green -> red. That is not what the one-line request asked for, but the page
 * is the artefact and these checks describe what it ACTUALLY does, measured: steps 1-4 and 9 pass on
 * the untouched baseline.
 *
 * The addition is a new key that does NOT cycle. On the baseline, steps 6 and 7 fail because pressing r
 * does nothing - the colour stays where the cycle left it - which is the addition being absent rather
 * than the harness being broken. Step 8 fails downstream of them.
 */
export function trafficTasks() {
  const dir = join(HERE, '..', 'legasus', 'bench', 'traffic');
  const specPath = join(dir, 'play-traffic-red.json');
  if (!existsSync(specPath)) return [];
  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  const sub = (steps) => ({ ...spec, name: `traffic-steps-${steps.join('')}`, steps: spec.steps.filter((x) => steps.includes(x.n)) });
  const existing = [1, 2, 3, 4, 9];          // the page as delivered: load, three advances, no errors
  const requested = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  return [{
    id: 'traffic-red', group: 'TRAFFIC', source: 'internal', language: 'javascript', kind: 'build',
    dependsOn: null,
    goal: 'Continue the traffic light already in index.html. Pressing r sets the light straight to red, whatever colour it is showing. Everything that already works must keep working. The page is a single self-contained web page, index.html: plain HTML5 canvas and JavaScript, no frameworks, no external files or CDNs. ' + spec.contract,
    requirement: {
      trigger: { kind: 'key', key: 'r' },
      effects: ['the light is red'],
      invariants: ['the cycling keys keep working', 'everything that already works keeps working'],
    },
    seed: {},
    requested: { play: { spec: sub(requested), steps: requested } },
    accumulates: ['the page as delivered'],
    supersedes: [],
    protected: { plays: [{ from: 'the page as delivered', spec: sub(existing), steps: existing }] },
    diagnostic: { kind: 'play', spec: sub(requested), timeoutSec: 90 },
    upstreamCases: requested.length, protectedCases: existing.length,
  }];
}

export function benchQueue() {
  return [...externalTasks(), ...SEQUENTIAL_TASKS];
}
