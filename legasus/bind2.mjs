/**
 * bind2.mjs - BIND-2: from discrimination to support (legasus/BIND-2_PREREG.md, frozen first).
 *
 *   node legasus/bind2.mjs <bind1-out-dir> <witness-file> <out-dir>
 *
 * Three phases, each writing raw artifacts BEFORE the next reads them:
 *   RECORD   serve R000 (the subject with a recording wrapper around <fn>) to the witness under
 *            the BIND-1 preload, so every call's argument and raw result lands in the same
 *            trace stream as the PASS|FAIL case lines. Attribution = the case line that follows.
 *   REPLAY   for pristine, M000 (byte-identical copy) and every BIND-1 mutant: a FRESH process
 *            imports the file directly and calls <fn> on every recorded input, in order.
 *   SUPPORT  join with BIND-1's matrix.json: S-classes (rule 1), edges (licensed / refused as
 *            typed states), predictions H1-H6, controls C1-C5. Any control failure BURNS the
 *            run: bind2.json carries attempt.status = BURNED and no REPORT is written.
 *
 * Nothing here modifies the subject on disk or its witnesses. R000 is written under <out-dir>.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, copyFileSync, appendFileSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { locateFunction, fileUrl } from './coverage.mjs';
import { sample, verdict, CALIB_REFERENCE_MS, SOURCE as LOAD_SOURCE } from './loadSample.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PRELOAD = join(ROOT, 'legasus', 'preload.mjs');
const CHILD = join(ROOT, 'legasus', 'bind2-replay-child.mjs');
const [bind1Arg, witnessArg, outArg] = process.argv.slice(2);
if (!bind1Arg || !witnessArg || !outArg) { console.error('usage: node legasus/bind2.mjs <bind1-out-dir> <witness-file> <out-dir>'); process.exit(2); }
const bind1 = resolve(bind1Arg);
const outDir = resolve(outArg);
mkdirSync(outDir, { recursive: true });

const MATRIX = JSON.parse(readFileSync(join(bind1, 'matrix.json'), 'utf8'));
const MANIFEST = JSON.parse(readFileSync(join(bind1, 'mutants.json'), 'utf8'));
const mutants = MANIFEST.mutants || MANIFEST;
const subject = resolve(MATRIX.subject);
const fn = MATRIX.fnName;
const witnessFile = witnessArg.replace(/\\/g, '/');
const W = `${witnessFile} :: `;

// ---- load rule (A2), sampled around each phase; a breach burns the run -------------------------
const LIM = { ceiling: 40, calibReferenceMs: CALIB_REFERENCE_MS, calibRatio: 3.0 };
const loadSamples = [];
const burnReasons = [];
function takeSample(where) {
  const s = sample(where); loadSamples.push(s);
  const v = verdict([s], LIM);
  if (!v.ok) burn(`C5 load at "${where}": ${v.why}`);
  return s;
}
function burn(reason) {
  burnReasons.push(reason);
  console.log(`BURN: ${reason}`);
}
function finishBurned(phase) {
  const attempt = { status: 'BURNED', phase, reasons: burnReasons, sampler: LOAD_SOURCE, load: verdict(loadSamples, LIM) };
  writeFileSync(join(outDir, 'bind2.json'), JSON.stringify({ attempt, loadSamples }, null, 2));
  console.log(`attempt: BURNED in ${phase} - ${burnReasons.join('; ')} - repair under BIND-2.1, do not interpret`);
  process.exit(3);
}

// ---- RECORD ---------------------------------------------------------------------------------
// R000: the subject text with `export function <fn>(` renamed to an inner implementation and a
// wrapper of the SAME name exported in its place. Internal callers bind to the module-scope
// name, so they reach the wrapper too. Everything else in the file is byte-identical.
const src = readFileSync(subject, 'utf8');
const loc = locateFunction(src, fn);
if (!loc) { console.error(`no function named ${fn}`); process.exit(2); }
const head = `export function ${fn}(`;
// locateFunction's fnStart is the FunctionDeclaration (after `export `); the export keyword sits 7 bytes before it.
const at = src.lastIndexOf(head, loc.fnStart);
if (at < 0 || at !== loc.fnStart - 'export '.length) { console.error(`cannot find '${head}' immediately before the located function start (${loc.fnStart})`); process.exit(2); }
const inner = `__legasus_${fn}_impl`;
const wrapper = `export function ${fn}(...args) {
  const __t = process.env.LEGASUS_RECORD;
  let __rec;
  try { const __r = ${inner}(...args); __rec = { call: globalThis.__legasus_call = (globalThis.__legasus_call || 0) + 1, x: args[0], o: JSON.stringify(__r) === undefined ? 'undefined' : JSON.stringify(__r) }; if (__t) require_append(__t, __rec); return __r; }
  catch (e) { __rec = { call: globalThis.__legasus_call = (globalThis.__legasus_call || 0) + 1, x: args[0], throw: (e && e.name) + ': ' + (e && e.message) }; if (__t) require_append(__t, __rec); throw e; }
}
function require_append(p, rec) { try { __legasus_fs.appendFileSync(p, JSON.stringify(rec) + '\\n'); } catch { /* the call still happened; C4 will see the gap */ } }
import * as __legasus_fs from 'node:fs';
`;
const r000Src = src.slice(0, at) + `function ${inner}(` + src.slice(at + head.length) + '\n' + wrapper;
const r000 = join(outDir, 'R000-RECORDER.js');
const m000 = join(outDir, 'M000-IDENTITY.js');
writeFileSync(r000, r000Src);
copyFileSync(subject, m000);
if (spawnSync(process.execPath, ['--check', r000], { encoding: 'utf8' }).status !== 0) { console.error('R000 does not parse'); process.exit(2); }
const r000loc = locateFunction(r000Src, inner);

console.log(`BIND-2 RECORD: ${subject} :: ${fn}  witness ${witnessFile}`);
console.log(`load sampler: ${LOAD_SOURCE}; start=${JSON.stringify(takeSample('record start'))}`);
const trace = join(outDir, 'record.trace.jsonl');
rmSync(trace, { force: true });
const rec = await new Promise((done) => {
  let out = '';
  const child = spawn(process.execPath, ['--import', fileUrl(PRELOAD), witnessFile], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, LEGASUS_SUBJECT: subject, LEGASUS_MUTANT: r000, LEGASUS_TRACE: trace, LEGASUS_RECORD: trace,
      LEGASUS_REGION: JSON.stringify({ fnStart: r000loc.fnStart, fnEnd: r000loc.fnEnd, site: r000loc.bodyStart + 1 }) },
  });
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  child.on('close', (code) => done({ code, out }));
});
writeFileSync(join(outDir, 'record.witness.log'), rec.out);
takeSample('record end');
const passLines = (rec.out.match(/^\s*PASS\s+\S/gm) || []).length;
const failLines = (rec.out.match(/^\s*FAIL\s+\S/gm) || []).length;
console.log(`record run: exit=${rec.code} PASS=${passLines} FAIL=${failLines}`);

// Attribute calls to the case whose line follows them.
const lines = readFileSync(trace, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const inputs = [];      // { k, x, o0, case }
const caseOutcome = {}; // case -> PASS|FAIL from the recorder run's own synchronous markers
let pending = [];
for (const l of lines) {
  if (l.call) pending.push(l);
  else if (l.caseMark) { caseOutcome[W + l.caseMark] = l.outcome; for (const p of pending) inputs.push({ k: p.call, x: p.x, o0: p.o, throw0: p.throw, case: W + l.caseMark }); pending = []; }
}
const orphanCalls = pending.length;   // calls after the last case line: attributed to no case
writeFileSync(join(outDir, 'inputs.json'), JSON.stringify({ subject, fn, witnessFile, inputs, orphanCalls, recordExit: rec.code, passLines, failLines }, null, 2));
console.log(`recorded inputs: ${inputs.length} (orphan calls after the last case line: ${orphanCalls})`);

// ---- controls that only need RECORD -------------------------------------------------------------
const B1 = MATRIX.records.filter((r) => r.granularity === 'case');
const baselineCases = [...new Set(B1.map((r) => r.witness))];
const casesFromRecord = new Set(inputs.map((i) => i.case));
// C1 part 1: the recorder run reproduces BIND-1's baseline EXACTLY - per case outcome and exit
const b1baseline = {}; for (const r of B1) b1baseline[r.witness] = r.baseline;
const wantExit0 = (MATRIX.witnesses || []).some((w) => w.file === witnessFile && w.baselineValidFile);
const c1cases = baselineCases.filter((c) => caseOutcome[c] !== b1baseline[c]);
if (c1cases.length || (wantExit0 && rec.code !== 0) || Object.keys(caseOutcome).length !== baselineCases.length) burn(`C1 recorder baseline: exit=${rec.code} (BIND-1 valid file: ${wantExit0}); cases seen ${Object.keys(caseOutcome).length}/${baselineCases.length}; outcome mismatches ${c1cases.length}: ${c1cases.slice(0, 3).join(' | ')}`);
// C4 attribution vs BIND-1's executedFn on the M001 records (any mutant would do; M001 is valid everywhere)
const execByCase = {};
for (const r of B1.filter((r) => r.mutant.startsWith('M001'))) execByCase[r.witness] = r.executedFn;
const c4bad = [];
for (const c of baselineCases) {
  const has = casesFromRecord.has(c);
  if (execByCase[c] === true && !has) c4bad.push(`${c}: BIND-1 executed, no input recorded`);
  if (execByCase[c] === false && has) c4bad.push(`${c}: BIND-1 NOT_EXECUTED, but inputs recorded`);
}
if (c4bad.length) burn(`C4 attribution: ${c4bad.length} mismatches: ${c4bad.slice(0, 3).join(' | ')}`);
if (burnReasons.length) finishBurned('RECORD');

// ---- REPLAY -----------------------------------------------------------------------------------
const uniq = [];
const seen = new Map();
for (const i of inputs) { if (!seen.has(i.x)) { seen.set(i.x, uniq.length); uniq.push({ k: uniq.length, x: i.x }); } }
const inputsPath = join(outDir, 'replay.inputs.json');
writeFileSync(inputsPath, JSON.stringify(uniq));
const served = [
  { id: 'PRISTINE', file: subject, family: 'CONTROL' },
  { id: 'M000-IDENTITY', file: m000, family: 'CONTROL' },
  ...mutants.filter((m) => m.valid).map((m) => ({ id: m.id, file: resolve(bind1, m.file.startsWith('legasus') || m.file.includes(':') ? m.file : m.file), family: m.family, describe: m.describe })),
];
console.log(`BIND-2 REPLAY: ${uniq.length} distinct inputs x ${served.length} served files; start=${JSON.stringify(takeSample('replay start'))}`);
const outputs = {};   // id -> Map(k -> {o}|{throw}|{apparatus})
for (const s of served) {
  const file = existsSync(s.file) ? s.file : join(bind1, 'mutants', basename(s.file));
  const r = spawnSync(process.execPath, [CHILD, file, fn, inputsPath], { cwd: ROOT, encoding: 'utf8', timeout: 60_000 });
  const map = new Map();
  for (const line of (r.stdout || '').split('\n').filter(Boolean)) { try { const j = JSON.parse(line); map.set(j.k, j); } catch { /* not ours */ } }
  for (const u of uniq) if (!map.has(u.k)) map.set(u.k, { k: u.k, apparatus: `no output line (exit ${r.status}${r.error ? ', ' + r.error.message : ''})` });
  outputs[s.id] = map;
}
takeSample('replay end');
writeFileSync(join(outDir, 'replay.json'), JSON.stringify({ served: served.map((s) => s.id), inputs: uniq, outputs: Object.fromEntries(Object.entries(outputs).map(([id, m]) => [id, [...m.values()]])) }, null, 2));
if (burnReasons.length) finishBurned('REPLAY');

// ---- SUPPORT ------------------------------------------------------------------------------------
const key = (rec) => rec.apparatus ? `APPARATUS(${rec.apparatus})` : rec.throw ? `THROW(${rec.throw})` : `O(${rec.o})`;
const trimKey = (rec) => {
  if (!rec.o) return key(rec);
  try { const v = JSON.parse(rec.o); return Array.isArray(v) ? `O(${JSON.stringify(v.map((e) => typeof e === 'string' ? e.trim() : e))})` : key(rec); } catch { return key(rec); }
};
const P = outputs.PRISTINE;
// C1 part 2: R000's recorded outputs equal the pristine replay, byte for byte
const c1bad = [];
for (const i of inputs) {
  const p = P.get(seen.get(i.x));
  const recKey = i.throw0 ? `THROW(${i.throw0})` : `O(${i.o0})`;
  if (recKey !== key(p)) c1bad.push(`k=${seen.get(i.x)} recorded ${recKey.slice(0, 60)} vs pristine ${key(p).slice(0, 60)}`);
}
if (c1bad.length) burn(`C1 recorder outputs: ${c1bad.length} inputs differ from the pristine replay: ${c1bad.slice(0, 2).join(' | ')}`);
const apparatusOutputs = Object.entries(outputs).flatMap(([id, m]) => [...m.values()].filter((r) => r.apparatus).map((r) => `${id} k=${r.k}: ${r.apparatus}`));
if (apparatusOutputs.length) burn(`replay APPARATUS_FAILURE x${apparatusOutputs.length}: ${apparatusOutputs.slice(0, 3).join(' | ')}`);

// Delta per (id, k) raw and trimmed
const delta = {}; const deltaTrim = {};
for (const [id, m] of Object.entries(outputs)) {
  delta[id] = new Map(); deltaTrim[id] = new Map();
  for (const u of uniq) { delta[id].set(u.k, key(m.get(u.k)) !== key(P.get(u.k))); deltaTrim[id].set(u.k, trimKey(m.get(u.k)) !== trimKey(P.get(u.k))); }
}
// C2: identity is S_0
const c2 = [...delta['M000-IDENTITY'].values()].every((d) => d === false);
if (!c2) burn('C2 identity copy differs from pristine on some input');

// S-classes (rule 1): signature = outputs on every distinct input, raw
const sigOf = (id) => uniq.map((u) => key(outputs[id].get(u.k))).join(' ');
const classes = new Map();   // sig -> [ids]
for (const s of served) { const g = sigOf(s.id); if (!classes.has(g)) classes.set(g, []); classes.get(g).push(s.id); }
const S = [];
let n = 0;
const s0sig = sigOf('PRISTINE');
for (const [g, ids] of classes) { const name = g === s0sig ? 'S0' : `S${++n}`; S.push({ S: name, members: ids, distinguishingInputs: null }); }
const classOf = {}; for (const c of S) for (const id of c.members) classOf[id] = c.S;
for (const c of S) if (c.S !== 'S0') { const id = c.members[0]; c.distinguishingInputs = uniq.filter((u) => delta[id].get(u.k)).map((u) => u.k); }

// Per (mutant, case): Delta(m,c) over the case's inputs; join with BIND-1 klass
const caseInputs = {}; for (const i of inputs) (caseInputs[i.case] ??= []).push(seen.get(i.x));
const joined = [];
for (const r of B1) {
  const ks = caseInputs[r.witness] || [];
  const id = r.mutant;
  if (!outputs[id]) continue;
  const d = ks.length ? ks.some((k) => delta[id].get(k)) : null;
  const dt = ks.length ? ks.some((k) => deltaTrim[id].get(k)) : null;
  let state;
  if (!ks.length) state = 'NO_INPUT';
  else if (r.klass === 'UNOBSERVABLE' || r.klass === 'BASELINE_INVALID') state = r.klass;
  else if (r.klass === 'DISCRIMINATED_BY_ERROR') state = d ? 'LICENSABLE' : 'INCIDENTAL_ERROR';
  else if (r.klass === 'DISCRIMINATED_BY_FAIL') state = d ? 'LICENSABLE' : 'INCIDENTAL';
  else if (r.klass === 'EXECUTED_NOT_DISCRIMINATED') state = d ? 'UNASSERTED' : 'NO_DIFFERENCE';
  else if (r.klass === 'NOT_EXECUTED') state = d ? 'DELTA_WITHOUT_EXECUTION' : 'NO_DIFFERENCE';
  else state = `UNMAPPED(${r.klass})`;
  joined.push({ mutant: id, S: classOf[id], witness: r.witness, klass: r.klass, delta: d, deltaTrim: dt, inputs: ks, state, executable: { witnessRun: 'BIND-1 bind.mjs (mutant served by loader redirect)', replay: 'bind2-replay-child.mjs (direct import, fresh process)' } });
}
// C3 must-fire
const c3miss = joined.filter((j) => j.mutant.startsWith('M001') && j.klass.startsWith('DISCRIMINATED') && j.delta !== true);
if (c3miss.length) burn(`C3 must-fire: M001 discriminated without a recorded delta in ${c3miss.length} case(s): ${c3miss.slice(0, 2).map((j) => j.witness).join(' | ')}`);
if (burnReasons.length) finishBurned('SUPPORT');

// H4 class consistency, then edges
const inconsistent = [];
for (const c of S) if (c.members.length >= 2) {
  const ms = c.members.filter((m) => m !== 'PRISTINE' && m !== 'M000-IDENTITY');
  for (const w of baselineCases) {
    const ks = new Set(ms.map((m) => (joined.find((j) => j.mutant === m && j.witness === w) || {}).klass));
    if (ks.size > 1) inconsistent.push({ S: c.S, witness: w, klasses: Object.fromEntries(ms.map((m) => [m, (joined.find((j) => j.mutant === m && j.witness === w) || {}).klass])) });
  }
}
const blocked = new Set(inconsistent.map((i) => i.S));
const edges = []; const refused = [];
for (const c of S) {
  if (c.S === 'S0') continue;
  const ms = c.members;
  for (const w of baselineCases) {
    const js = ms.map((m) => joined.find((j) => j.mutant === m && j.witness === w)).filter(Boolean);
    if (!js.length) continue;
    if (blocked.has(c.S)) { refused.push({ S: c.S, witness: w, state: 'CLASS_INCONSISTENT' }); continue; }
    if (js.every((j) => j.state === 'LICENSABLE')) edges.push({ witness: w, S: c.S, mutants: ms, inputs: js[0].inputs, provenance: js.map((j) => ({ mutant: j.mutant, baseline: 'PASS', perturbed: j.klass, delta: j.delta, deltaTrim: j.deltaTrim, executable: j.executable })) });
    else refused.push({ S: c.S, witness: w, state: js.map((j) => j.state).filter((s) => s !== 'LICENSABLE')[0] || 'MIXED', states: Object.fromEntries(js.map((j) => [j.mutant, j.state])) });
  }
}

// Predictions
const B1clusters = [['M001-RETURN_EMPTY', 'M024-INVERT_COND', 'M029-INVERT_COND', 'M033-DROP_EFFECT'], ['M003-BOUNDARY', 'M004-BOUNDARY'], ['M006-INVERT_COND', 'M018-INVERT_COND'], ['M030-DROP_BRANCH', 'M032-DROP_EFFECT'], ['M007-DROP_BRANCH', 'M019-DROP_BRANCH', 'M020-DROP_EFFECT'], ['M016-DROP_BRANCH', 'M017-DROP_EFFECT'], ['M008-DROP_EFFECT', 'M021-DROP_EFFECT'], ['M010-DROP_BRANCH', 'M011-BOUNDARY', 'M012-BOUNDARY', 'M013-BOUNDARY', 'M014-DROP_EFFECT', 'M022-BOUNDARY', 'M023-BOUNDARY', 'M025-DROP_BRANCH', 'M028-DROP_EFFECT']];
// The H1/H2/H6 objects are the segments() run's, frozen in the prereg; on any other subject
// (the toy dry run) the mutants are simply absent and these sections report nothing.
const present = (m) => Boolean(outputs[m]);
const h1 = B1clusters.filter((cl) => cl.some(present)).map((cl) => ({ cluster: cl, sClasses: [...new Set(cl.filter(present).map((m) => classOf[m]))] }));
const dark = ['M022-BOUNDARY', 'M023-BOUNDARY', 'M025-DROP_BRANCH', 'M028-DROP_EFFECT'].filter(present);
const h2 = dark.map((m) => ({ mutant: m, S: classOf[m], anyDelta: uniq.some((u) => delta[m].get(u.k)), deltaInputs: uniq.filter((u) => delta[m].get(u.k)).map((u) => u.k), states: [...new Set(joined.filter((j) => j.mutant === m).map((j) => j.state))] }));
const h3 = joined.filter((j) => j.state === 'INCIDENTAL');
const h5 = []; for (const s of served) for (const u of uniq) if (delta[s.id].get(u.k) && !deltaTrim[s.id].get(u.k)) h5.push({ mutant: s.id, k: u.k });
const never = ['M010-DROP_BRANCH', 'M011-BOUNDARY', 'M012-BOUNDARY', 'M013-BOUNDARY', 'M014-DROP_EFFECT'].filter(present);
const h6 = never.map((m) => ({ mutant: m, anyDelta: uniq.some((u) => delta[m].get(u.k)) }));
const stateTally = {}; for (const j of joined) stateTally[j.state] = (stateTally[j.state] || 0) + 1;

const load = verdict(loadSamples, LIM);
const attempt = { status: load.ok ? 'OBSERVED' : 'BURNED', phase: 'SUPPORT', sampler: LOAD_SOURCE, load };
const result = { attempt, loadSamples, subject, fn, witnessFile, inputsRecorded: inputs.length, distinctInputs: uniq.length, orphanCalls,
  controls: { C1: c1bad.length === 0 && rec.code === 0, C2: c2, C3: c3miss.length === 0, C4: c4bad.length === 0, C5: load.ok },
  classes: S, joined, stateTally, edges, refused, inconsistent, predictions: { H1: h1, H2: h2, H3: h3, H5: h5, H6: h6 } };
writeFileSync(join(outDir, 'bind2.json'), JSON.stringify(result, null, 2));

const rep = [];
rep.push(`# BIND-2 result — ${subject} :: ${fn}`, '');
rep.push(`Attempt: ${attempt.status} (${load.why}; ${loadSamples.length} samples; sampler ${LOAD_SOURCE}). Controls: ${JSON.stringify(result.controls)}.`);
rep.push(`Inputs recorded: ${inputs.length} calls, ${uniq.length} distinct; orphan calls ${orphanCalls}. States: ${JSON.stringify(stateTally)}.`, '');
rep.push('No obligation is named. S-classes are anonymous and relative to the recorded inputs. No supersession authority is granted.', '');
rep.push('## S-classes (rule 1: identical raw output on every recorded input)', '');
for (const c of S) rep.push(`- **${c.S}** — ${c.members.join(', ')}${c.distinguishingInputs ? ` — differs from S0 on ${c.distinguishingInputs.length} input(s)` : ''}`);
rep.push('', '## H1 — do BIND-1\'s identical-signature clusters split?', '');
for (const h of h1) rep.push(`- {${h.cluster.map((m) => m.split('-')[0]).join(', ')}} -> ${h.sClasses.join(' + ')}${h.sClasses.length > 1 ? '  **SPLITS**' : ''}`);
rep.push('', '## H2 — the four dark mutants (held-out pressure)', '');
for (const h of h2) rep.push(`- ${h.mutant}: ${h.S}; delta on ${h.deltaInputs.length} recorded input(s); per-case states ${h.states.join(', ')}`);
rep.push('', `## H3 — INCIDENTAL discrimination: ${h3.length} record(s)`, '');
for (const j of h3.slice(0, 20)) rep.push(`- ${j.mutant} x ${j.witness}`);
rep.push('', `## H4 — CLASS_INCONSISTENT: ${inconsistent.length} (mutant-class, case) conflict(s) in ${blocked.size} class(es)`, '');
for (const i of inconsistent.slice(0, 10)) rep.push(`- ${i.S} on ${i.witness}: ${JSON.stringify(i.klasses)}`);
rep.push('', `## H5 — raw delta hidden by the witnesses' trim: ${h5.length} (mutant, input) pair(s)`, '');
rep.push('', `## H6 — never-executed mutants with a replay delta: ${h6.filter((h) => h.anyDelta).map((h) => h.mutant).join(', ') || 'none'}`, '');
rep.push('', `## Edges licensed: ${edges.length}   refused: ${refused.length}`, '');
const byS = {}; for (const e of edges) (byS[e.S] ??= []).push(e.witness);
for (const [s, ws] of Object.entries(byS)) rep.push(`- ${s} <- ${ws.length} witness case(s)`);
const refTally = {}; for (const r of refused) refTally[r.state] = (refTally[r.state] || 0) + 1;
rep.push('', `Refusals by state: ${JSON.stringify(refTally)}`, '', 'Full provenance: bind2.json (joined[], edges[], refused[]), replay.json, inputs.json, record.trace.jsonl.');
writeFileSync(join(outDir, 'REPORT.md'), rep.join('\n'));
console.log(`attempt: ${attempt.status}; classes ${S.length}; edges ${edges.length}; refused ${refused.length}; incidental ${h3.length}; inconsistent ${inconsistent.length}`);
console.log(`-> ${join(outDir, 'REPORT.md')}`);
if (attempt.status !== 'OBSERVED') process.exit(3);
