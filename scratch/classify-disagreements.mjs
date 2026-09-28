// Classify the nine X2 disagreements. No repair until each has a named cause.
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, readdirSync, copyFileSync }
  from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mutate } from '../legasus/legalabs/mutate.mjs';

const NL = String.fromCharCode(10);
const ROOT = 'benchmarks/repoB/pristine';
const PKG = 'packaging';
const src = readFileSync('benchmarks/repoB/external-doctest.mjs', 'utf8');
const lift = (name) => {
  const m = new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\]\\.join\\(NL\\);').exec(src);
  return m[1].split(NL).map((l) => l.trim()).filter((l) => l.startsWith("'"))
    .map((l) => l.replace(/^'/, '').replace(/',?$/, '')).join(NL);
};
const DOCTEST = lift('DOCTEST'); const MINE = lift('MINE');

const sweep = JSON.parse(readFileSync('benchmarks/repoB/sweep.json', 'utf8'));
const rows = sweep.runs.map((r) => ({ module: r.module.replace(/\.py$/, ''), dotted: r.dotted,
  setup: r.setup, invocation: r.invocation, wants: r.wants }));
const MODULES = [...new Set(rows.map((r) => r.module))];
const rowsFile = join(tmpdir(), 'rows-cls.json');
writeFileSync(rowsFile, JSON.stringify(rows), 'utf8');
const wantsOf = new Map(rows.map((r) => [r.module + '|' + r.invocation.trim(), r.wants]));

const run = (prog, args) => {
  try {
    return JSON.parse(execFileSync('python', ['-c', prog, ...args],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120000,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } }));
  } catch (e) { return null; }
};
const failMap = (l) => new Map((l || []).filter((x) => x.outcome === 'OUTPUT_MISMATCH'
  || x.outcome === 'UNEXPECTED_EXCEPTION').map((x) => [x.module + '|' + String(x.source).trim(), x]));

const candidates = JSON.parse(readFileSync('benchmarks/repoB/candidates.json', 'utf8'));
const seen = new Set();
for (const c of candidates) {
  const dir = mkdtempSync(join(tmpdir(), 'cls-'));
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
  const D = failMap(run(DOCTEST, [dir, PKG, JSON.stringify(MODULES)]));
  const M = failMap(run(MINE, [dir, PKG, rowsFile]));
  for (const [k, v] of D) {
    if (!M.has(k) && !seen.has('D' + k)) {
      seen.add('D' + k);
      console.log('ONLY CPYTHON  ' + c.file + '/' + c.fn);
      console.log('   example : ' + k.split('|')[1].slice(0, 70));
      console.log('   wants   : ' + JSON.stringify(String(wantsOf.get(k) || '').slice(0, 70)));
      console.log('   cpython : ' + v.outcome);
      console.log('');
    }
  }
  for (const [k, v] of M) {
    if (!D.has(k) && !seen.has('M' + k)) {
      seen.add('M' + k);
      console.log('ONLY MINE     ' + c.file + '/' + c.fn);
      console.log('   example : ' + k.split('|')[1].slice(0, 70));
      console.log('   wants   : ' + JSON.stringify(String(wantsOf.get(k) || '').slice(0, 70)));
      console.log('   mine    : ' + v.outcome + '  printed=' + v.printed);
      console.log('');
    }
  }
  rmSync(dir, { recursive: true, force: true });
  if (seen.size > 14) break;
}
console.log('distinct disagreeing examples: ' + seen.size);
