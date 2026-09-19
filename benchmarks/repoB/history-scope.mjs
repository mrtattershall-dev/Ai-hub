// IS `history` A REAL SCOPE DIMENSION, OR A CONVENIENT STORY? — preregistered, frozen before running.
//
// The claim: an example that runs after others is not an assertion about the source alone. Its subject is
// SOURCE x EXECUTION HISTORY. If that is true, then two systems evaluating "the same example" under
// different histories are evaluating DIFFERENT SUBJECTS, and the honest verdict is SCOPE_INCOMPATIBLE -
// a refusal to compare - rather than a disagreement.
//
// That story is cheap to tell and it must be made to predict something.
//
//   H1  Among the residual disagreements, the ones MINE_SEQ resolves (by adopting doctest's shared-globals
//       execution) are EXACTLY the examples with a NON-EMPTY execution prefix.
//   H2  The ones MINE_SEQ does NOT resolve include examples with an EMPTY prefix - identical subjects,
//       and therefore genuine disagreements that `history` does not excuse.
//
// FALSIFICATION, and it is sharp: if resolved-by-MINE_SEQ is uncorrelated with prefix length, then
// `history` explains nothing and the C classification was a just-so story. If EVERY residual case has a
// non-empty prefix, `history` absorbs all of them and H2 fails - which would be suspicious rather than
// pleasing, because it would mean the dimension is unfalsifiable on this corpus.
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, readdirSync, copyFileSync }
  from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mutate } from '../../legasus/legalabs/mutate.mjs';

const NL = String.fromCharCode(10);
const ROOT = 'benchmarks/repoB/pristine';
const PKG = 'packaging';
const src = readFileSync('benchmarks/repoB/external-doctest.mjs', 'utf8');
const lift = (name) => {
  const m = new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\]\\.join\\(NL\\);').exec(src);
  return m[1].split(NL).map((l) => l.trim()).filter((l) => l.startsWith("'"))
    .map((l) => l.replace(/^'/, '').replace(/',?$/, '')).join(NL);
};
const DOCTEST = lift('DOCTEST'); const MINE = lift('MINE'); const MINE_SEQ = lift('MINE_SEQ');

const sweep = JSON.parse(readFileSync('benchmarks/repoB/sweep.json', 'utf8'));
const rows = sweep.runs.map((r) => ({ module: r.module.replace(/\.py$/, ''), dotted: r.dotted,
  owner: r.owner, setup: r.setup, invocation: r.invocation, wants: r.wants }));
const MODULES = [...new Set(rows.map((r) => r.module))];
const rowsFile = join(tmpdir(), 'rows-hist.json');
writeFileSync(rowsFile, JSON.stringify(rows), 'utf8');

// THE EXECUTION PREFIX of each example: how many examples precede it in its own docstring. This is the
// `history` coordinate, read off the corpus and not from any outcome.
const prefixOf = new Map();
for (const r of rows) prefixOf.set(r.module + '|' + r.invocation.trim(), r.setup.length);

const run = (prog, args) => {
  try {
    return JSON.parse(execFileSync('python', ['-c', prog, ...args],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120000,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } }));
  } catch (e) { return null; }
};
const must = (r, what) => {
  if (r === null) { console.error('REFUSING TO SCORE: ' + what + ' unobservable'); process.exit(2); }
  return r;
};
const failSet = (l) => new Set((l || []).filter((x) => x.outcome === 'OUTPUT_MISMATCH'
  || x.outcome === 'UNEXPECTED_EXCEPTION').map((x) => x.module + '|' + String(x.source).trim()));

const candidates = JSON.parse(readFileSync('benchmarks/repoB/candidates.json', 'utf8'));
const cells = { resolvedWithHistory: 0, resolvedNoHistory: 0,
  unresolvedWithHistory: 0, unresolvedNoHistory: 0 };
const detail = [];

for (const c of candidates) {
  const dir = mkdtempSync(join(tmpdir(), 'hist-'));
  mkdirSync(join(dir, PKG), { recursive: true });
  for (const f of readdirSync(join(ROOT, PKG))) {
    if (f.endsWith('.py')) copyFileSync(join(ROOT, PKG, f), join(dir, PKG, f));
  }
  const target = join(dir, PKG, c.file);
  const s0 = readFileSync(target, 'utf8');
  const eol = s0.includes('\r\n') ? '\r\n' : NL;
  const m = mutate({ file: target, write: true, language: 'python', expectParses: true,
    find: c.anchorLF.split('\n').join(eol), replace: c.replacement.split('\n').join(eol) });
  if (!m.ok) { rmSync(dir, { recursive: true, force: true }); continue; }

  const D = failSet(must(run(DOCTEST, [dir, PKG, JSON.stringify(MODULES)]), 'doctest'));
  const M = failSet(must(run(MINE, [dir, PKG, rowsFile]), 'mine'));
  const S = failSet(must(run(MINE_SEQ, [dir, PKG, rowsFile]), 'mine_seq'));

  // Examples on which MINE disagrees with doctest, in either direction.
  const disagree = [...new Set([...D, ...M])].filter((k) => D.has(k) !== M.has(k));
  for (const k of disagree) {
    const resolved = (D.has(k) === S.has(k));          // does doctest's execution model fix this one?
    const hist = (prefixOf.get(k) || 0) > 0;
    const cell = (resolved ? 'resolved' : 'unresolved') + (hist ? 'WithHistory' : 'NoHistory');
    cells[cell]++;
    if (detail.length < 20) {
      detail.push({ k: k.slice(0, 62), prefix: prefixOf.get(k) ?? '?', resolved,
        mut: c.file + '/' + c.fn });
    }
  }
  rmSync(dir, { recursive: true, force: true });
}

const total = Object.values(cells).reduce((a, b) => a + b, 0);
console.log('disagreeing (example, mutation) pairs: ' + total);
console.log('');
console.log('                        prefix > 0    prefix == 0');
console.log('  MINE_SEQ resolves   ' + String(cells.resolvedWithHistory).padStart(10)
  + String(cells.resolvedNoHistory).padStart(15));
console.log('  MINE_SEQ does not   ' + String(cells.unresolvedWithHistory).padStart(10)
  + String(cells.unresolvedNoHistory).padStart(15));
console.log('');
const h1 = cells.resolvedNoHistory === 0 && cells.resolvedWithHistory > 0;
const h2 = cells.unresolvedNoHistory > 0;
console.log('H1  everything the execution model fixes has a NON-EMPTY prefix : '
  + (h1 ? 'HELD' : 'FAILED'));
console.log('H2  some residual has an EMPTY prefix - genuine disagreement    : '
  + (h2 ? 'HELD' : 'FAILED')
  + (cells.unresolvedNoHistory === 0 && cells.unresolvedWithHistory === 0
    ? '   (nothing residual at all)' : ''));
console.log('');
console.log(h1 && h2
  ? 'history EXPLAINS the execution-model residual and does NOT absorb everything - which is what makes'
    + NL + 'it a dimension rather than an excuse.'
  : h1 ? 'history absorbs every residual case. Unfalsifiable on this corpus; treat with suspicion.'
    : 'history does not predict which cases the execution model fixes. The C classification was a story.');
console.log('');
for (const d of detail.slice(0, 10)) {
  console.log('  prefix=' + String(d.prefix).padStart(2) + '  resolved=' + String(d.resolved).padEnd(6)
    + d.mut.padEnd(30) + d.k);
}
rmSync(rowsFile, { force: true });
