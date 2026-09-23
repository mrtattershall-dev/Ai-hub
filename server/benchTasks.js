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
  const selPath = join(BENCH, 'SELECTION.json');
  if (!existsSync(selPath)) return [];
  const sel = JSON.parse(readFileSync(selPath, 'utf8'));
  return sel.selected.map((t) => {
    const cases = readFileSync(join(BENCH, t.name, 'cases.jsonl'), 'utf8');
    const seed = readFileSync(join(BENCH, t.name, 'seed.py'), 'utf8');
    return {
      id: `ext-${t.name}`,
      group: 'EXTERNAL',
      source: 'QuixBugs',
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

export function benchQueue() {
  return [...externalTasks(), ...SEQUENTIAL_TASKS];
}
