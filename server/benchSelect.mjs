/**
 * benchSelect.mjs - DETERMINISTIC SELECTION of external benchmark tasks.
 *
 *   node server/benchSelect.mjs <quixbugs-dir> <out.json>
 *
 * Selection runs BEFORE our model sees anything, and its rules are fixed here. Tasks are chosen
 * on COMPATIBILITY and TASK SHAPE only - never on whether our model succeeds, which is not even
 * knowable at this point because no generation has happened.
 *
 * SOURCE: QuixBugs (James Koppel et al.), 40 single-bug Python programs with reference
 * corrections and test data. Independently authored, and NOT authored here.
 *
 * NOTE ON "INDEPENDENTLY AUTHORED": it does not mean unseen. QuixBugs is public and long-lived,
 * so these programs may well appear in the model's training data. That limitation is recorded
 * and is not solvable by choosing a different public source.
 *
 * ── THE ADAPTER, recorded because it IS a change ────────────────────────────────────────────
 *
 * QuixBugs' own tests are pytest modules (40 of 42), and the frozen offline worker has no
 * pytest. Rather than change and re-qualify the worker image, the ORIGINAL TEST DATA
 * (`json_testcases/*.json`, authored upstream) is preserved and only the RUNNER is replaced
 * with plain `python3`.
 *
 *   preserved:  the upstream buggy program, the upstream correction, the upstream test inputs
 *               and expected outputs
 *   replaced:   pytest -> a plain-python loop over the same cases
 *
 * ── REQUESTED vs PROTECTED, derived from the data rather than invented ──────────────────────
 *
 *   requested   ALL upstream cases pass
 *   protected   the subset that ALREADY PASSES on the buggy seed must still pass
 *
 * The protected set is therefore discovered, not designed: it is exactly the behaviour the
 * program already had. This satisfies the seed rule by construction - a task is eligible only
 * if at least one case fails (there is real work) and at least one passes (there is something
 * to preserve).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';

const [SRC, OUT] = process.argv.slice(2);
if (!SRC || !OUT) { console.error('usage: node server/benchSelect.mjs <quixbugs-dir> <out.json>'); process.exit(2); }

// BENCH_TARGET: how many eligible programs to select (default 15, the original set).
// BENCH_SKIP: comma-separated program names to leave out BEFORE selection - used to select a
// HELD-OUT set that excludes everything an earlier selection already took. Both are recorded.
const TARGET = parseInt(process.env.BENCH_TARGET || '15', 10);
const SKIP = new Set(String(process.env.BENCH_SKIP || '').split(',').map((x) => x.trim()).filter(Boolean));

/** Run every upstream case against one program file. Returns per-case pass/fail. */
function runCases(programFile, fnName, cases) {
  const harness = `
import json, sys, importlib.util
spec = importlib.util.spec_from_file_location("m", ${JSON.stringify(programFile)})
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
fn = getattr(m, ${JSON.stringify(fnName)})
cases = json.loads(sys.argv[1])
out = []
for c in cases:
    args, expected = c[0], c[1]
    if not isinstance(args, list): args = [args]
    try:
        got = fn(*[list(a) if isinstance(a, list) else a for a in args])
        try: got = list(got) if hasattr(got, "__iter__") and not isinstance(got, (str, dict)) else got
        except Exception: pass
        out.append(got == expected)
    except Exception:
        out.append(False)
print(json.dumps(out))
`;
  try {
    const r = execFileSync('python', ['-c', harness, JSON.stringify(cases)], { encoding: 'utf8', timeout: 20_000 });
    return JSON.parse(r.trim());
  } catch { return null; }
}

const progDir = join(SRC, 'python_programs');
const fixDir = join(SRC, 'correct_python_programs');
const caseDir = join(SRC, 'json_testcases');

// DETERMINISTIC ORDER: alphabetical by program name. Fixed before any eligibility is evaluated,
// so the order cannot be influenced by what turns out to be eligible.
const names = readdirSync(caseDir).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')).sort();

const eligible = [], excluded = [];
for (const name of names) {
  const buggy = join(progDir, `${name}.py`);
  const fixed = join(fixDir, `${name}.py`);
  const casesFile = join(caseDir, `${name}.json`);
  const reject = (why) => excluded.push({ task: name, why });

  if (SKIP.has(name)) { reject('skipped: already selected by an earlier selection (held-out rule)'); continue; }
  if (!existsSync(buggy) || !existsSync(fixed)) { reject('no buggy or no reference program'); continue; }

  let cases;
  try {
    cases = readFileSync(casesFile, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch { reject('test data could not be parsed'); continue; }
  if (cases.length < 3) { reject(`only ${cases.length} upstream cases (need >= 3)`); continue; }

  const onBuggy = runCases(buggy, name, cases);
  const onFixed = runCases(fixed, name, cases);
  if (!onBuggy || !onFixed) { reject('could not execute the program with the offline harness'); continue; }

  const passIdx = onBuggy.map((ok, i) => (ok ? i : -1)).filter((i) => i >= 0);
  const failCount = onBuggy.filter((ok) => !ok).length;

  // THE SEED RULE, applied here rather than discovered later
  if (failCount === 0) { reject('the buggy program already passes every case - no work to do'); continue; }
  if (passIdx.length === 0) { reject('no case passes on the seed - nothing to protect'); continue; }
  if (!onFixed.every(Boolean)) { reject('the upstream reference does not pass its own cases under this harness'); continue; }

  eligible.push({
    name,
    upstreamCases: cases.length,
    protectedIdx: passIdx,           // discovered, not designed
    failingOnSeed: failCount,
  });
}

const selected = eligible.slice(0, TARGET);
const result = {
  source: 'QuixBugs (github.com/jkoppel/QuixBugs)',
  sourceRevision: execFileSync('git', ['-C', SRC, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  selectionRule: 'alphabetical by program name; first N eligible; eligibility evaluated before any model run',
  adapter: 'upstream test DATA preserved; pytest runner replaced with plain python3 (the frozen worker has no pytest)',
  requestedRule: 'all upstream cases pass',
  protectedRule: 'the subset already passing on the buggy seed must still pass (discovered from the seed, not designed)',
  target: TARGET,
  skipped: [...SKIP],
  eligibleCount: eligible.length,
  selected,
  excluded,
};
writeFileSync(OUT, JSON.stringify(result, null, 2), 'utf8');

// VENDORING, recorded as part of selection: the buggy program as seed.py, the upstream
// correction as reference.py (never mounted into a task; acceptance's oracle only), and the
// upstream cases as cases.jsonl, each into <dir of OUT>/<name>/. The original 15 were vendored
// this way by hand for BENCH-1; a held-out set must be reproducible from one command.
if (process.env.BENCH_VENDOR === '1') {
  const outDir = dirname(OUT);
  for (const t of selected) {
    const d = join(outDir, t.name);
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, 'seed.py'), readFileSync(join(progDir, `${t.name}.py`), 'utf8'), 'utf8');
    writeFileSync(join(d, 'reference.py'), readFileSync(join(fixDir, `${t.name}.py`), 'utf8'), 'utf8');
    writeFileSync(join(d, 'cases.jsonl'), readFileSync(join(caseDir, `${t.name}.json`), 'utf8').trim().split('\n').filter(Boolean).join('\n') + '\n', 'utf8');
  }
  console.log(`vendored ${selected.length} task(s) under ${outDir}`);
}

console.log(`inspected ${names.length} upstream programs`);
console.log(`eligible  ${eligible.length}`);
console.log(`selected  ${selected.length} (target ${TARGET})`);
console.log(`excluded  ${excluded.length}`);
const why = {};
for (const e of excluded) why[e.why] = (why[e.why] || 0) + 1;
for (const [k, v] of Object.entries(why).sort((a, b) => b[1] - a[1])) console.log(`   ${v}x  ${k}`);
console.log(`\nwritten: ${OUT}`);
