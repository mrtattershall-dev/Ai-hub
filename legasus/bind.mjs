/**
 * bind.mjs - BIND: which witnesses notice when the region is changed?
 *
 *   node legasus/bind.mjs <out-dir>        (after mutate.mjs and discover.mjs wrote there)
 *
 * Witness selection is DISCOVER's output filtered by the frozen granularity rules:
 *   case-level   EXECUTED, prints per-case PASS|FAIL lines, DISCOVER run < 60s
 *   file-level   EXECUTED, no per-case lines, DISCOVER run < 60s
 *   UNOBSERVABLE (budget)  EXECUTED but >= 60s - named, not dropped
 *
 * Every (mutant x witness) gets one record. Binding is decided by BIND-1's four
 * conditions and nothing else. No obligation is named.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

/** Kill a child AND everything it spawned. Windows does not do this for us. */
function killTree(child) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* not a group leader */ } }
  try { child.kill(); } catch { /* already gone */ }
}
import { fileURLToPath } from 'node:url';
import { regionCountsFromFiles, fileUrl } from './coverage.mjs';
import { sample, verdict, CALIB_REFERENCE_MS, SOURCE as LOAD_SOURCE } from './loadSample.mjs';

// Frozen in BIND-1_PREREG.md before attempt 2 (and Amendment A1): the count is a SCREEN,
// the calibration workload is the MEASUREMENT. Decided by rule from the samples, never by
// looking at the result.
const LOAD_CEILING = 40;
// A2: the reference is a frozen constant (loadSample.mjs / PREREG A2), not a start baseline.
const CALIB_RATIO = 3.0;
const calibBaselineMs = CALIB_REFERENCE_MS;   // kept under this name so every record still carries it
const limits = () => ({ ceiling: LOAD_CEILING, calibReferenceMs: CALIB_REFERENCE_MS, calibRatio: CALIB_RATIO });
const loadSamples = [];
// First breach aborts at once (see discover.mjs for why): a monotonic leak passes a start
// check, and a runner that keeps going under load is also the load in someone else's run.
function abortForLoad(where, why) {
  const load = verdict(loadSamples, limits());
  const attempt = { status: 'UNOBSERVABLE_LOAD', load, sampler: LOAD_SOURCE, calibBaselineMs,
    reason: `aborted at "${where}": ${why}; the attempt is not a result` };
  try { writeFileSync(join(outDir, 'matrix.json'), JSON.stringify({ attempt, loadSamples, subject, fnName: M.fnName, records: typeof records !== 'undefined' ? records : [] }, null, 2)); } catch { /* exit code says it */ }
  try { writeFileSync(join(outDir, 'REPORT.md'), `# BIND-1 — ATTEMPT UNOBSERVABLE (load) — NOT A RESULT\n\n${attempt.reason}\n`); } catch { /* same */ }
  console.log(`load verdict: UNOBSERVABLE_LOAD - ${attempt.reason}`);
  process.exit(3);
}
const takeSample = (where) => {
  const s = sample(where);
  loadSamples.push(s);
  const v = verdict([s], limits());   // THIS sample against the frozen limits; null never passes
  if (!v.ok) abortForLoad(where, v.why);
  return s;
};
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PRELOAD = join(ROOT, 'legasus', 'preload.mjs');
const outDir = resolve(process.argv[2] || '');
if (!outDir || !existsSync(join(outDir, 'mutants.json')) || !existsSync(join(outDir, 'discover.json'))) {
  console.error('usage: node legasus/bind.mjs <out-dir>   (needs mutants.json and discover.json there)');
  process.exit(2);
}
const M = JSON.parse(readFileSync(join(outDir, 'mutants.json'), 'utf8'));
const D = JSON.parse(readFileSync(join(outDir, 'discover.json'), 'utf8'));
// A DISCOVER taken under load classified witnesses by the machine, not by execution. BIND
// built on it would inherit that, so it refuses. (A hand-written discover.json for the
// self-check carries no attempt field and is allowed through by that absence, deliberately.)
if (D.attempt && D.attempt.status !== 'OBSERVED') {
  console.error(`refusing: discover.json is ${D.attempt.status} - ${D.attempt.reason}`);
  process.exit(3);
}
const subject = M.subject;
const CASE_BUDGET_MS = 60_000;
const RUN_BUDGET_MS = 120_000;

// ---- witness selection, by the frozen rules ----------------------------------------------
const witnesses = [];
const unobservable = [];
for (const r of D.results) {
  if (r.status !== 'EXECUTED') continue;
  if (r.ms >= CASE_BUDGET_MS) { unobservable.push({ file: r.file, reason: `DISCOVER took ${r.ms}ms >= ${CASE_BUDGET_MS}ms budget` }); continue; }
  witnesses.push({ file: r.file, granularity: r.perCaseLines > 0 ? 'case' : 'file', baselineValidFile: r.baselineValid });
}

/** Run one witness file against one served subject (original or mutant), with the tracer. */
function runWitness(w, mutant) {
  return new Promise((done) => {
    const tag = `${w.file.replace(/[\\/]/g, '__')}--${mutant ? mutant.id : 'baseline'}`;
    const trace = join(outDir, 'trace', `${tag}.jsonl`);
    const covDir = join(outDir, 'cov-bind', tag);
    rmSync(trace, { force: true });
    rmSync(covDir, { recursive: true, force: true });
    mkdirSync(dirname(trace), { recursive: true });
    mkdirSync(covDir, { recursive: true });
    const region = mutant ? mutant.region : { fnStart: M.region.fnStart, fnEnd: M.region.fnEnd, site: M.region.fnStart + 1 };
    const env = {
      ...process.env,
      NODE_V8_COVERAGE: covDir,
      LEGASUS_SUBJECT: subject,
      ...(w.granularity === 'case' ? { LEGASUS_TRACE: trace } : {}),
      LEGASUS_REGION: JSON.stringify(region),
      ...(mutant ? { LEGASUS_MUTANT: mutant.file } : {}),
    };
    let out = '';
    const child = spawn(process.execPath, ['--import', fileUrl(PRELOAD), w.file], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; killTree(child) }, RUN_BUDGET_MS);
    child.on('close', (code) => {
      clearTimeout(timer);
      let cases = [];
      let armed = false;
      try {
        const recs = readFileSync(trace, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
        armed = recs.some((x) => x.phase === 'ARMED');
        cases = recs.filter((x) => !x.phase);
      } catch { cases = []; }
      let files = [];
      try { files = readdirSync(covDir).filter((f) => f.endsWith('.json')).map((f) => join(covDir, f)); } catch { /* none */ }
      const served = fileUrl(mutant ? mutant.file : subject);
      const fileCov = regionCountsFromFiles(files, served, region);
      // Did the process die INSIDE the served subject? Only then can a case that never
      // printed be credited as an observation of the region (BIND rule 3).
      const servedPath = mutant ? mutant.file : subject;
      const diedInSubject = code !== 0 && !timedOut && (out.includes(servedPath) || out.includes(servedPath.replace(/\\/g, '/')));
      done({ exitCode: code, timedOut, cases, fileCov, diedInSubject, armed, tail: out.trim().split('\n').slice(-3).join(' | ').slice(0, 200) });
    });
  });
}

/** Stable case identity: printed id plus its occurrence index among identical ids. */
function keyed(cases) {
  const seen = {};
  return cases.map((c) => { const n = (seen[c.id] = (seen[c.id] || 0) + 1); return { ...c, key: n > 1 ? `${c.id} #${n}` : c.id }; });
}

// ---- baseline ---------------------------------------------------------------------------------
console.log(`BIND ${subject} :: ${M.fnName}`);
console.log(`load sampler: ${LOAD_SOURCE}; ceiling ${LOAD_CEILING} node processes; start=${takeSample('start').nodeProcs}`);
console.log(`witnesses: ${witnesses.length} (${witnesses.filter((w) => w.granularity === 'case').length} case-level), unobservable(budget): ${unobservable.length}`);
const baseline = {};
for (const w of witnesses) {
  const r = await runWitness(w, null);
  baseline[w.file] = r;
  const cs = keyed(r.cases);
  console.log(`  baseline ${w.file}: exit=${r.exitCode} cases=${cs.length} fn=${r.fileCov.fnCount}`);
}

// ---- mutants ----------------------------------------------------------------------------------
const records = [];
const validMutants = M.mutants.filter((m) => m.valid);
for (const m of M.mutants) {
  if (!m.valid) {
    records.push({ mutant: m.id, family: m.family, witness: '*', granularity: '-', klass: 'INVALID_MUTANT', detail: m.invalidReason });
    continue;
  }
  for (const w of witnesses) {
    const b = baseline[w.file];
    takeSample(`${m.id} x ${w.file}`);
    const r = await runWitness(w, m);
    if (w.granularity === 'case') {
      const base = keyed(b.cases);
      const got = keyed(r.cases);
      const gotBy = Object.fromEntries(got.map((c) => [c.key, c]));
      let sawMissing = false;
      for (const bc of base) {
        const mc = gotBy[bc.key];
        const rec = { mutant: m.id, family: m.family, witness: `${w.file} :: ${bc.key}`, granularity: 'case', baseline: bc.outcome };
        if (bc.outcome !== 'PASS') { records.push({ ...rec, klass: 'BASELINE_INVALID', detail: `baseline ${bc.outcome}` }); continue; }
        if (!mc) {
          // The process died. Only the case that was RUNNING when it died is an observation:
          // its outcome changed, and the stack names the served subject, so rule 3 holds by
          // evidence. Every case after it never ran - unobserved, not discriminated.
          if (!sawMissing) {
            sawMissing = true;
            if (!r.armed) { records.push({ ...rec, outcome: null, executedSite: null, klass: 'UNOBSERVABLE', detail: 'process died before the tracer was armed (during load)' }); continue; }
            if (r.diedInSubject) { records.push({ ...rec, outcome: 'WITNESS_ERROR', executedSite: true, klass: 'DISCRIMINATED_BY_ERROR', detail: 'process died in the served subject while this case ran' }); continue; }
            records.push({ ...rec, outcome: 'WITNESS_ERROR', executedSite: null, klass: 'UNOBSERVABLE', detail: 'process died during this case; the stack does not name the subject' }); continue;
          }
          records.push({ ...rec, outcome: null, executedSite: null, klass: 'UNOBSERVABLE', detail: 'process died before this case ran' }); continue;
        }
        const executedSite = mc.siteCount > 0;
        const executedFn = mc.fnCount > 0;
        const changed = mc.outcome !== bc.outcome;
        let klass;
        if (mc.coverageError || mc.scriptSeen === false) klass = 'UNOBSERVABLE';
        else if (!executedSite) klass = 'NOT_EXECUTED';
        else if (changed) klass = mc.outcome === 'FAIL' ? 'DISCRIMINATED_BY_FAIL' : 'DISCRIMINATED_BY_ERROR';
        else klass = 'EXECUTED_NOT_DISCRIMINATED';
        records.push({ ...rec, outcome: mc.outcome, executedSite, executedFn, klass });
      }
      // Cases that appeared under the mutant but not in baseline are noted, never counted.
      for (const gc of got) if (!base.find((bc) => bc.key === gc.key)) records.push({ mutant: m.id, family: m.family, witness: `${w.file} :: ${gc.key}`, granularity: 'case', klass: 'UNOBSERVABLE', detail: 'case not present in baseline' });
    } else {
      const baseOutcome = b.timedOut ? 'WITNESS_ERROR' : b.exitCode === 0 ? 'PASS' : 'FAIL';
      const outcome = r.timedOut ? 'WITNESS_ERROR' : r.exitCode === 0 ? 'PASS' : 'FAIL';
      const rec = { mutant: m.id, family: m.family, witness: w.file, granularity: 'file', baseline: baseOutcome, outcome };
      if (baseOutcome !== 'PASS') { records.push({ ...rec, klass: 'BASELINE_INVALID' }); continue; }
      const executedSite = r.fileCov.siteCount > 0;
      let klass;
      if (!r.fileCov.scriptSeen) klass = 'UNOBSERVABLE';
      else if (!executedSite) klass = 'NOT_EXECUTED';
      else if (outcome !== baseOutcome) klass = outcome === 'FAIL' ? 'DISCRIMINATED_BY_FAIL' : 'DISCRIMINATED_BY_ERROR';
      else klass = 'EXECUTED_NOT_DISCRIMINATED';
      records.push({ ...rec, executedSite, executedFn: r.fileCov.fnCount > 0, klass, detail: r.tail });
    }
  }
  const mine = records.filter((x) => x.mutant === m.id);
  const disc = mine.filter((x) => x.klass.startsWith('DISCRIMINATED')).length;
  console.log(`  ${m.id.padEnd(24)} ${m.describe.padEnd(30)} discriminated by ${disc}/${mine.length}`);
}
for (const u of unobservable) records.push({ mutant: '*', witness: u.file, granularity: '-', klass: 'UNOBSERVABLE', detail: u.reason });

// ---- COVER ------------------------------------------------------------------------------------
const perMutant = validMutants.map((m) => {
  const mine = records.filter((x) => x.mutant === m.id);
  const count = (k) => mine.filter((x) => x.klass === k).length;
  return {
    mutant: m.id, family: m.family, describe: m.describe,
    discriminated: count('DISCRIMINATED_BY_FAIL') + count('DISCRIMINATED_BY_ERROR'),
    byFail: count('DISCRIMINATED_BY_FAIL'), byError: count('DISCRIMINATED_BY_ERROR'),
    executedNotDiscriminated: count('EXECUTED_NOT_DISCRIMINATED'),
    notExecuted: count('NOT_EXECUTED'), baselineInvalid: count('BASELINE_INVALID'), unobservable: count('UNOBSERVABLE'),
    discriminators: mine.filter((x) => x.klass.startsWith('DISCRIMINATED')).map((x) => x.witness),
  };
});
const witnessKeys = [...new Set(records.filter((x) => x.granularity !== '-').map((x) => x.witness))];
const perWitness = witnessKeys.map((wk) => {
  const mine = records.filter((x) => x.witness === wk && x.mutant !== '*');
  const disc = mine.filter((x) => x.klass.startsWith('DISCRIMINATED'));
  const exec = mine.filter((x) => x.klass === 'EXECUTED_NOT_DISCRIMINATED');
  const label = mine.some((x) => x.klass === 'BASELINE_INVALID') ? 'BASELINE_INVALID'
    : disc.length ? 'DISCRIMINATES' : exec.length ? 'NO_DISCRIMINATION_OBSERVED' : 'NOT_EXECUTED';
  return { witness: wk, label, validAgainst: 'BIND-1 mutation family', discriminates: disc.map((x) => x.mutant), executedNotDiscriminated: exec.length, notExecuted: mine.filter((x) => x.klass === 'NOT_EXECUTED').length };
});
const candidates = perMutant.filter((p) => p.discriminated > 0).map((p, i) => ({
  D: `D${i + 1}`, region: `${subject} :: ${M.fnName}`, perturbation: `${p.mutant}: ${p.describe}`,
  discriminators: p.discriminators, provenance: 'BIND-1, generic family, no semantics assumed',
}));
const dark = perMutant.filter((p) => p.discriminated === 0 && p.executedNotDiscriminated > 0);

// ---- load verdict: by rule, from the samples, before anything is called a result ---------------
takeSample('end');
const load = verdict(loadSamples, limits());
const attempt = load.ok
  ? { status: 'OBSERVED', load, sampler: LOAD_SOURCE, calibBaselineMs }
  : { status: 'UNOBSERVABLE_LOAD', load, sampler: LOAD_SOURCE, calibBaselineMs,
      reason: `${load.why}; the attempt is not a result` };
console.log(`load verdict: ${attempt.status} (${load.why}; count worst ${load.worst}/${LOAD_CEILING}, calibration worst ${load.calib.worstMs}ms vs frozen reference ${calibBaselineMs}ms, ${loadSamples.length} samples)`);

const report = [];
report.push(`# BIND-1 result — ${subject} :: ${M.fnName}`);
if (attempt.status !== 'OBSERVED') {
  report.push('', `## ATTEMPT UNOBSERVABLE (load) — NOT A RESULT`, '', attempt.reason, '',
    `Samples: ${loadSamples.length}; worst ${load.worst}; sampler ${LOAD_SOURCE}. Raw records are preserved in matrix.json, labelled, and are not to be cited as evidence about the subject. Re-run on a quiet machine.`, '');
  writeFileSync(join(outDir, 'matrix.json'), JSON.stringify({ attempt, loadSamples, subject, fnName: M.fnName, witnesses, unobservable, records }, null, 2));
  writeFileSync(join(outDir, 'REPORT.md'), report.join('\n') + '\n');
  console.log(`records: ${records.length} (preserved, not a result)`);
  console.log(`-> ${join(outDir, 'REPORT.md')}`);
  process.exit(3);
}
report.push('', `Attempt: OBSERVED — every sample within the preregistered limits (count worst ${load.worst}/${LOAD_CEILING}; calibration worst ${load.calib.worstMs}ms against a frozen reference of ${calibBaselineMs}ms, limit ${CALIB_RATIO}x; ${loadSamples.length} samples; sampler ${LOAD_SOURCE}).`);
report.push('', 'No obligation is named here. No supersession authority is granted. Every edge below is an experiment.', '');
report.push('## Witness selection (frozen rules)', '', `- case-level: ${witnesses.filter((w) => w.granularity === 'case').map((w) => w.file).join(', ') || 'none'}`, `- file-level: ${witnesses.filter((w) => w.granularity === 'file').map((w) => w.file).join(', ') || 'none'}`, `- UNOBSERVABLE (budget): ${unobservable.map((u) => `${u.file} (${u.reason})`).join('; ') || 'none'}`, '');
report.push('## Per perturbation', '', '| mutant | perturbation | discriminated (fail/error) | executed, not discriminated | not executed | baseline invalid | unobservable |', '|---|---|---|---|---|---|---|');
for (const p of perMutant) report.push(`| ${p.mutant} | ${p.describe} | ${p.discriminated} (${p.byFail}/${p.byError}) | ${p.executedNotDiscriminated} | ${p.notExecuted} | ${p.baselineInvalid} | ${p.unobservable} |`);
const invalid = M.mutants.filter((m) => !m.valid);
if (invalid.length) { report.push('', `INVALID_MUTANT (kept, not repaired): ${invalid.map((m) => `${m.id} (${m.invalidReason})`).join('; ')}`); }
if (M.notApplicable && M.notApplicable.length) report.push('', `Families with no applicable site in this region: ${M.notApplicable.join(', ')}`);
report.push('', '## Discrimination candidates (anonymous)', '');
for (const c of candidates) report.push(`- **${c.D}** — ${c.perturbation} — discriminators: ${c.discriminators.length}`);
report.push('', '## Executed, and no witness discriminated (dark to this family)', '');
for (const p of dark) report.push(`- ${p.mutant} — ${p.describe} — executed by ${p.executedNotDiscriminated} witness(es), discriminated by none. Establishes: no witness in this set discriminated this perturbation. Does NOT establish absence of an obligation.`);
if (!dark.length) report.push('- none: every valid perturbation that was executed was discriminated by at least one witness. This does NOT make the region characterized.');
report.push('', '## Per witness', '', '| witness | label | discriminates | executed-not-discriminated | not executed |', '|---|---|---|---|---|');
for (const w of perWitness) report.push(`| ${w.witness} | ${w.label} | ${w.discriminates.length} | ${w.executedNotDiscriminated} | ${w.notExecuted} |`);
report.push('', `Records: ${records.length}. Full matrix: matrix.json.`);

writeFileSync(join(outDir, 'matrix.json'), JSON.stringify({ attempt, loadSamples, subject, fnName: M.fnName, witnesses, unobservable, records, perMutant, perWitness, candidates }, null, 2));
writeFileSync(join(outDir, 'REPORT.md'), report.join('\n') + '\n');
console.log(`records: ${records.length}  candidates: ${candidates.length}  dark: ${dark.length}`);
console.log(`-> ${join(outDir, 'REPORT.md')}`);
