#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// obligationMutants.mjs — are the obligations INDEPENDENTLY FALSIFIABLE?
//
//   node server/obligationMutants.mjs --dir <app dir> --mutants <mutants.json>
//
// A bigger benchmark is worthless if it is a bigger UNKNOWN HARNESS. Twenty-five obligations that have
// never been shown to detect anything are twenty-five opportunities for a check that cannot fail, and
// this project has already shipped one of those (`[].every()` is true) and caught another (`|| true`).
//
// So two things must hold before any model sees the benchmark:
//
//   SENSITIVITY   a hand-written CORRECT artifact passes every obligation
//   SPECIFICITY   for each obligation, one TARGETED mutant fails THAT obligation
//
// The second is the one that does the work, and it has a trap worth naming: a mutant that breaks its
// own check AND several others has not demonstrated specificity - it has demonstrated that the suite
// notices damage. What is required is that the mutant's own obligation fails. Collateral failures are
// recorded per mutant so over-broad mutants are visible rather than counted as successes.
//
// A mutant whose obligation still PASSES is an ESCAPE, and the right reading is not "the mutant was too
// weak" - it is that the check, the mutant, or the expectation is wrong, and which one must be
// established rather than assumed.
//
// MUTANTS FILE: [{ obligation: <step n>, name, file, find, replace }]
// `find` must appear exactly once in `file`, so a mutant is a precise edit and never a broad rewrite.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const DIR = opt('dir', null);
const MUTANTS = opt('mutants', null);
const SPEC = opt('spec', 'play.json');
if (!DIR || !MUTANTS) { console.error('usage: node server/obligationMutants.mjs --dir <app dir> --mutants <file.json>'); process.exit(2); }

const NL = String.fromCharCode(10);
const { playCheck } = await import('./playCheck.js');
const { governedFiles, copyApp } = await import('./workspaceFiles.mjs');

const spec = JSON.parse(readFileSync(join(DIR, SPEC), 'utf8'));
const mutants = JSON.parse(readFileSync(MUTANTS, 'utf8'));
const paths = governedFiles(DIR);

/** Run the whole spec against a workspace built from the app, with one optional mutation applied. */
async function run(mutation) {
  const ws = mkdtempSync(join(tmpdir(), 'mut-'));
  try {
    copyApp(DIR, ws, paths);
    if (mutation) {
      const target = join(ws, mutation.file);
      if (!existsSync(target)) return { error: `mutant targets ${mutation.file}, which is not in the manifest` };
      const src = readFileSync(target, 'utf8');
      const hits = src.split(mutation.find).length - 1;
      if (hits !== 1) return { error: `mutant's find text appears ${hits} times in ${mutation.file}; a mutant must be a precise edit` };
      writeFileSync(target, src.replace(mutation.find, mutation.replace), 'utf8');
    }
    const r = await playCheck(ws, spec);
    return { passing: [...(r.passing || [])], failing: [...(r.failing || [])] };
  } finally { if (existsSync(ws)) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } } }
}

const all = spec.steps.map((s) => s.n);
console.log(`app          ${DIR}`);
console.log(`manifest     ${paths.length} files: ${paths.join(', ')}`);
console.log(`obligations  ${all.length}`);
console.log(`mutants      ${mutants.length}`);

// ══ SENSITIVITY ═════════════════════════════════════════════════════════════════════════════════
const clean = await run(null);
if (clean.error) { console.error(`the correct artifact could not be run: ${clean.error}`); process.exit(3); }
const cleanOk = all.every((n) => clean.passing.includes(n));
console.log(`${NL}SENSITIVITY  the correct artifact passes ${clean.passing.length} of ${all.length}` + (cleanOk ? '' : `  FAILING: ${clean.failing.join(',')}`));
if (!cleanOk) {
  console.error('NOT VALIDATED: the hand-written correct artifact does not satisfy its own obligations, so no mutant result means anything yet');
  process.exit(4);
}

// ══ SPECIFICITY ═════════════════════════════════════════════════════════════════════════════════
console.log(`${NL}SPECIFICITY  one targeted mutant per obligation`);
const rows = [];
for (const m of mutants) {
  const r = await run(m);
  if (r.error) { rows.push({ ...m, verdict: 'MUTANT_INVALID', detail: r.error }); continue; }
  const ownFailed = r.failing.includes(m.obligation);
  const collateral = r.failing.filter((n) => n !== m.obligation);
  rows.push({
    obligation: m.obligation, name: m.name,
    verdict: ownFailed ? 'CAUGHT' : 'ESCAPED',
    collateral,
  });
}
for (const r of rows) {
  const tag = r.verdict === 'CAUGHT' ? 'CAUGHT ' : r.verdict === 'ESCAPED' ? 'ESCAPED' : 'INVALID';
  const extra = r.verdict === 'MUTANT_INVALID' ? `  ${r.detail}`
    : r.collateral.length ? `  (also failed ${r.collateral.join(',')} - over-broad, recorded not credited)` : '  (only its own check)';
  console.log(`  ${tag}  obligation ${String(r.obligation).padStart(3)}  ${String(r.name).slice(0, 44).padEnd(46)}${extra}`);
}

const caught = rows.filter((r) => r.verdict === 'CAUGHT').length;
const escaped = rows.filter((r) => r.verdict === 'ESCAPED');
const invalid = rows.filter((r) => r.verdict === 'MUTANT_INVALID');
const precise = rows.filter((r) => r.verdict === 'CAUGHT' && r.collateral.length === 0).length;
const covered = new Set(rows.filter((r) => r.verdict === 'CAUGHT').map((r) => r.obligation));
const uncovered = all.filter((n) => !covered.has(n));

console.log(`${NL}  caught ${caught} of ${mutants.length}, of which ${precise} failed ONLY their own check`);
if (invalid.length) console.log(`  ${invalid.length} mutant(s) were INVALID and prove nothing about the obligations they targeted`);
if (escaped.length) console.log(`  ESCAPED: obligations ${escaped.map((r) => r.obligation).join(', ')} - the check, the mutant, or the expectation is wrong, and which must be established`);
if (uncovered.length) console.log(`  NO MUTANT EXERCISES: obligations ${uncovered.join(', ')} - unfalsified, and not to be counted as validated`);

const validated = escaped.length === 0 && invalid.length === 0 && uncovered.length === 0;
console.log(`${NL}${validated ? 'VALIDATED: every obligation is independently falsifiable' : 'NOT VALIDATED: see above'}`);
process.exit(validated ? 0 : 1);
