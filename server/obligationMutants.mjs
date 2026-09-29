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
// SPECIFICITY IS NOT "ONLY ONE CHECK FAILED". On a real dependency ladder some obligations support
// later ones, so breaking an early obligation legitimately breaks what rests on it. An earlier version
// of this file demanded a single failure and would have rejected perfectly good mutants for doing
// exactly what the ladder's structure requires. The rule is three-part:
//
//   1  the mutant MUST fail its named OWNER check
//   2  it MUST preserve the declared unrelated SENTINEL checks
//   3  failures among the owner's DECLARED DEPENDENTS are EXPECTED, and recorded as such
//
// A sentinel breach is the real over-broad signal: a mutant that takes out obligations with no
// declared relationship to its own has shown that the suite notices damage, not that the obligation is
// independently falsifiable. A mutant that breaks nearly everything trips this by construction.
//
// THE DEPENDENCY GRAPH IS DECLARED, NOT INFERRED. Inferring it from which checks happen to fail would
// make the gate unfalsifiable: every collateral failure could be relabelled a dependency after the
// fact. Declaring it up front also documents the ladder's structure, which is worth having on its own.
//
// EVERY CHECK RUNS IN A FRESH BROWSER, ON ITS OWN MINIMAL SPEC. The first version of this file ran the
// WHOLE LADDER as one sequence against one page, and that is a story rather than a measurement of each
// claim: a later check inherits whatever the earlier steps left behind. Breaking the Escape reset made
// the count-at-load check fail three steps later - not because it rests on Escape, but because the list
// was still filtered when it ran. Under a sequential spec, specificity can only ever be demonstrated
// against steps BEFORE the owner, and a longer ladder would only have made that ambiguity harder to
// see.
//
// So each obligation is validated alone:
//
//   minimal spec of N = the transitive PREREQUISITE CLOSURE of N, then N itself, from a fresh load
//
// The owner is required to fail on ITS minimal spec, and each sentinel is required to pass on ITS OWN
// minimal spec in ITS OWN fresh browser. Nothing a sentinel sees can be contaminated by a step that
// belongs to some other obligation's story.
//
// A mutant whose obligation still PASSES is an ESCAPE, and the right reading is not "the mutant was too
// weak" - it is that the check, the mutant, or the expectation is wrong, and which one must be
// established rather than assumed.
//
// MUTANTS FILE:
//   { dependsOn: { "<step>": [steps it rests on] },
//     mutants: [{ obligation, name, file, find, replace }] }
// or a bare array, in which case no dependencies are declared and the gate reports every non-owner
// failure as an UNDECLARED sentinel breach - deliberately strict, so an undeclared ladder cannot pass.
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
const mutantFile = JSON.parse(readFileSync(MUTANTS, 'utf8'));
const mutants = Array.isArray(mutantFile) ? mutantFile : (mutantFile.mutants || []);
const dependsOn = Array.isArray(mutantFile) ? null : (mutantFile.dependsOn || {});
// Obligations DECLARED not independently falsifiable, each with its reason. Two real cases turned up
// on the first ladder: an obligation that is the same assertion as an earlier one at a later position,
// and a global noErrors sentinel that any error-introducing mutation breaks. Naming them is honest;
// dropping them silently would let an unfalsified obligation ride along inside a validated suite.
const notFalsifiable = (Array.isArray(mutantFile) ? {} : (mutantFile.notIndependentlyFalsifiable || {}));

/**
 * Everything that rests on `owner`, transitively. `dependsOn` maps a step to the steps it needs, so
 * the dependents are found by inversion: if 8 depends on 7, breaking 7 is expected to break 8.
 */
function dependentsOf(owner) {
  if (!dependsOn) return null;
  const out = new Set();
  let grew = true;
  while (grew) {
    grew = false;
    for (const [stepText, needs] of Object.entries(dependsOn)) {
      const step = Number(stepText);
      if (out.has(step)) continue;
      if ((needs || []).some((n) => n === owner || out.has(n))) { out.add(step); grew = true; }
    }
  }
  return out;
}
const paths = governedFiles(DIR);

/**
 * The steps that must RUN before N, transitively, then N. `dependsOn` serves double duty: a step N
 * rests on is also a step that has to have run to put the page in the state N is about.
 */
function closureOf(n) {
  const need = new Set();
  const walk = (x) => {
    for (const p of ((dependsOn && dependsOn[String(x)]) || [])) {
      if (need.has(p)) continue;
      need.add(p);
      walk(p);
    }
  };
  walk(n);
  return [...need, n].sort((a, b) => a - b);
}

/** A spec holding only the steps in `ns`, so it runs from a fresh load and nothing else touches it. */
function minimalSpec(ns) {
  return { ...spec, contract: `minimal spec for ${ns.join(',')}`, steps: spec.steps.filter((x) => ns.includes(x.n)) };
}

/** Run a spec against a workspace built from the app, with one optional mutation applied. */
async function run(mutation, useSpec) {
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
    const r = await playCheck(ws, useSpec || spec);
    return { passing: [...(r.passing || [])], failing: [...(r.failing || [])] };
  } finally { if (existsSync(ws)) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } } }
}

const all = spec.steps.map((s) => s.n);
console.log(`app          ${DIR}`);
console.log(`manifest     ${paths.length} files: ${paths.join(', ')}`);
console.log(`obligations  ${all.length}`);
console.log(`mutants      ${mutants.length}`);

// ══ SENSITIVITY ═════════════════════════════════════════════════════════════════════════════════
// Each obligation on its OWN minimal spec, in its own fresh browser. Passing the full sequence is a
// weaker statement: it does not establish that an obligation holds when reached on its own terms.
console.log(`${NL}SENSITIVITY  the correct artifact, each obligation on its own minimal spec`);
const cleanFails = [];
for (const n of all) {
  const ns = closureOf(n);
  const r = await run(null, minimalSpec(ns));
  if (r.error || !r.passing.includes(n)) cleanFails.push({ n, ns, why: r.error || `failing [${r.failing.join(',')}]` });
}
console.log(`  ${all.length - cleanFails.length} of ${all.length} obligations hold on their own`);
for (const f of cleanFails) console.log(`  FAILS  obligation ${f.n} on minimal spec [${f.ns.join(',')}]: ${f.why}`);
if (cleanFails.length) {
  console.error(`${NL}NOT VALIDATED: an obligation does not hold on the correct artifact when run on its own, so no mutant result about it means anything`);
  process.exit(4);
}

// ══ SPECIFICITY ═════════════════════════════════════════════════════════════════════════════════
console.log(`${NL}SPECIFICITY  owner on its own minimal spec; each sentinel on its own, fresh`);
const rows = [];
for (const m of mutants) {
  const owner = m.obligation;
  const ownerSpec = closureOf(owner);
  const ro = await run(m, minimalSpec(ownerSpec));
  if (ro.error) { rows.push({ obligation: owner, name: m.name, verdict: 'MUTANT_INVALID', detail: ro.error }); continue; }
  const ownFailed = ro.failing.includes(owner);

  const deps = dependentsOf(owner);
  const expected = deps ? [...deps] : [];
  // Sentinels may be narrowed per mutant, which bounds the cost of a long ladder. Whatever is
  // checked is DECLARED, and how many were checked is reported alongside the verdict.
  const candidates = all.filter((n) => n !== owner && !expected.includes(n));
  const sentinels = Array.isArray(m.sentinels) ? m.sentinels.filter((n) => candidates.includes(n)) : candidates;
  const brokenSentinels = [];
  for (const sn of sentinels) {
    const rs = await run(m, minimalSpec(closureOf(sn)));
    if (rs.error || !rs.passing.includes(sn)) brokenSentinels.push(sn);
  }
  // A dependent is only reported as expectedly broken if it actually breaks on ITS OWN spec too -
  // otherwise "expected collateral" would again be an artefact of step ordering.
  const brokenDependents = [];
  for (const dn of expected) {
    const rd = await run(m, minimalSpec(closureOf(dn)));
    if (rd.error || !rd.passing.includes(dn)) brokenDependents.push(dn);
  }
  rows.push({
    obligation: owner, name: m.name, ownerSpec,
    verdict: !ownFailed ? 'ESCAPED' : (brokenSentinels.length ? 'OVER_BROAD' : 'CAUGHT'),
    brokenSentinels, brokenDependents, sentinelCount: sentinels.length, declared: !!deps,
  });
}
for (const r of rows) {
  const tag = { CAUGHT: 'CAUGHT ', ESCAPED: 'ESCAPED', OVER_BROAD: 'BROAD  ', MUTANT_INVALID: 'INVALID' }[r.verdict];
  let extra;
  if (r.verdict === 'MUTANT_INVALID') extra = `  ${r.detail}`;
  else if (r.brokenSentinels.length) extra = `  SENTINELS BROKEN: ${r.brokenSentinels.join(',')} - no declared relationship to this obligation`;
  else if (r.brokenDependents.length) extra = `  + dependents ${r.brokenDependents.join(',')} (expected: they rest on it)`;
  else extra = `  (${r.sentinelCount} sentinels intact, each checked fresh)`;
  console.log(`  ${tag}  obligation ${String(r.obligation).padStart(3)}  ${String(r.name).slice(0, 40).padEnd(42)}${extra}`);
}

const caught = rows.filter((r) => r.verdict === 'CAUGHT').length;
const escaped = rows.filter((r) => r.verdict === 'ESCAPED');
const broad = rows.filter((r) => r.verdict === 'OVER_BROAD');
const invalid = rows.filter((r) => r.verdict === 'MUTANT_INVALID');
const ownerOnly = rows.filter((r) => r.verdict === 'CAUGHT' && r.brokenDependents.length === 0).length;
const undeclared = rows.some((r) => r.declared === false);
const covered = new Set(rows.filter((r) => r.verdict === 'CAUGHT').map((r) => r.obligation));
const declaredUnfalsifiable = Object.keys(notFalsifiable).map(Number);
const uncovered = all.filter((n) => !covered.has(n) && !declaredUnfalsifiable.includes(n));

console.log(`${NL}  caught ${caught} of ${mutants.length} with every sentinel intact; ${ownerOnly} touched nothing but their owner`);
if (broad.length) console.log(`  OVER-BROAD: obligations ${broad.map((r) => r.obligation).join(', ')} - broke checks with NO declared relationship to them`);
if (undeclared) console.log('  NO DEPENDENCY GRAPH DECLARED: every non-owner failure is treated as a sentinel breach, so an undeclared ladder cannot pass');
if (invalid.length) console.log(`  ${invalid.length} mutant(s) were INVALID and prove nothing about the obligations they targeted`);
if (escaped.length) console.log(`  ESCAPED: obligations ${escaped.map((r) => r.obligation).join(', ')} - the check, the mutant, or the expectation is wrong, and which must be established`);
if (uncovered.length) console.log(`  NO MUTANT EXERCISES: obligations ${uncovered.join(', ')} - unfalsified, and not to be counted as validated`);
for (const [n, why] of Object.entries(notFalsifiable)) console.log(`  NOT INDEPENDENTLY FALSIFIABLE, declared: obligation ${n} - ${why}`);

const validated = escaped.length === 0 && broad.length === 0 && invalid.length === 0 && uncovered.length === 0;
console.log(`${NL}${validated ? 'VALIDATED: every obligation is independently falsifiable' : 'NOT VALIDATED: see above'}`);
process.exit(validated ? 0 : 1);
