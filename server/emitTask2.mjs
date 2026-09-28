#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// emitTask2.mjs — SEQ-1's SECOND addition, with the accumulated protected set.
//
//   node server/emitTask2.mjs --dir legasus/bench/seq1/add2 --prev legasus/bench/seq1/add1
//
// The rule, fixed in SEQ-1's definition before either addition was attempted:
//   pressing `z` decreases the FIRST NUMERIC FIELD of the state by one, and never below its load value.
//
// THE ACCUMULATION IS THE POINT. This task's protected set is addition 1's ENTIRE requested play - which
// already contains the original program's checks plus addition 1's own. A candidate that implements `z`
// but breaks `0`, or breaks `a`/`b`, fails. It is not "partially good".
//
// Refuses to emit unless BOTH hold on the base, measured rather than assumed:
//   every carried-forward check passes
//   `z` does nothing yet, and the new checks fail for that reason
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const DIR = opt('dir', null);
const PREV = opt('prev', null);
const NAME = opt('name', 'baseline-as-delivered.html');
const TRIGGER = opt('trigger', 'z');
if (!DIR || !PREV) { console.error('usage: node server/emitTask2.mjs --dir <add2 dir> --prev <add1 dir>'); process.exit(2); }

const sha = (t) => createHash('sha256').update(t).digest('hex');
const NL = String.fromCharCode(10);
const { observe, respondingKeys } = await import('./observeState.mjs');
const { playCheck } = await import('./playCheck.js');

const html = readFileSync(join(DIR, NAME), 'utf8');
const prevTask = JSON.parse(readFileSync(join(PREV, 'task.json'), 'utf8'));
const prevSpec = prevTask.requested.play.spec;
const prevKey = prevTask.requirement.invariants.join(' ').match(/the (\S+) key/)?.[1] || 'a';

// ── the base must respond to the existing key, and NOT to the new trigger ──
const wsp = mkdtempSync(join(tmpdir(), 'emit2-'));
let obs;
try {
  writeFileSync(join(wsp, 'index.html'), html, 'utf8');
  const r = await observe(wsp, { keys: [prevKey, prevKey, TRIGGER, TRIGGER, TRIGGER, prevKey] });
  if (!r.ok) { console.error(`could not observe the base: ${r.reason}`); process.exit(4); }
  obs = r;
} finally { if (existsSync(wsp)) { try { rmSync(wsp, { recursive: true, force: true }); } catch { /* best effort */ } } }

const loadState = obs.atLoad.value;
const after1 = obs.observations[1].value;
const after2 = obs.observations[2].value;
const responds = respondingKeys(obs.observations);
if (responds.includes(TRIGGER)) { console.error(`the base already responds to '${TRIGGER}', so the addition is not absent`); process.exit(5); }

// ── the first numeric field, and what one step down from `after2` must look like ──
const numericFields = Object.keys(loadState || {}).filter((k) => typeof loadState[k] === 'number');
if (!numericFields.length) { console.error('the state has no numeric field, so this addition rule does not apply to this page'); process.exit(6); }
const FIELD = numericFields[0];
const floorValue = loadState[FIELD];
const step = (from, by) => ({ ...from, [FIELD]: Math.max(floorValue, from[FIELD] + by) });
const down1 = step(after2, -1);
const down2 = step(down1, -1);
const down3 = step(down2, -1);           // at or below the floor: must not go under

const J = (v) => JSON.stringify(JSON.stringify(v));
const steps = [
  { n: 1, name: 'loads with no page or console error, in its starting state', do: [], expect: `errors.length === 0 && JSON.stringify(state) === ${J(loadState)}` },
  { n: 2, name: `pressing ${prevKey} changes the state as it already did`, do: [{ key: prevKey }], expect: `JSON.stringify(state) === ${J(after1)}` },
  { n: 3, name: `pressing ${prevKey} again changes it again`, do: [{ key: prevKey }], expect: `JSON.stringify(state) === ${J(after2)}` },
  { n: 4, name: `pressing ${TRIGGER} decreases ${FIELD} by one`, do: [{ key: TRIGGER }], expect: `JSON.stringify(state) === ${J(down1)}` },
  { n: 5, name: `pressing ${TRIGGER} again decreases it again`, do: [{ key: TRIGGER }], expect: `JSON.stringify(state) === ${J(down2)}` },
  { n: 6, name: `pressing ${TRIGGER} at the starting value does not go below it`, do: [{ key: TRIGGER }], expect: `JSON.stringify(state) === ${J(down3)}` },
  // After step 6 the field is at its floor and nothing else has moved, so one press of the existing key
  // must land exactly one step above the floor. Computed, not guessed.
  { n: 7, name: `${prevKey} still works after ${TRIGGER}`, do: [{ key: prevKey }], expect: `JSON.stringify(state) === ${J({ ...down3, [FIELD]: down3[FIELD] + 1 })}` },
  { n: 8, name: 'the reset from the first addition still works', do: [{ key: prevTask.requirement.trigger.key }], expect: `JSON.stringify(state) === ${J(loadState)}` },
  { n: 9, name: `${prevKey} still works after the reset`, do: [{ key: prevKey }], expect: `JSON.stringify(state) === ${J(after1)}` },
  { n: 10, name: 'no page or console error was raised at any point', do: [], expect: 'noErrors' },
];
const spec = { entry: 'index.html', stateExpr: 'window.app.state()', contract: prevSpec.contract, steps };

// ── measure the base: carried-forward must pass, the addition must be absent ──
const check = async (sp) => {
  const ws = mkdtempSync(join(tmpdir(), 'emit2c-'));
  try { writeFileSync(join(ws, 'index.html'), html, 'utf8'); return await playCheck(ws, sp); }
  finally { if (existsSync(ws)) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } } }
};
const carried = await check(prevSpec);
const newRun = await check(spec);
const cPass = [...(carried.passing || [])].sort((a, b) => a - b);
const nFail = [...(newRun.failing || [])].sort((a, b) => a - b);
const carriedAllPass = cPass.length === prevSpec.steps.length;
const additionAbsent = [4, 5].every((n) => nFail.includes(n));

console.log(`base            ${join(DIR, NAME)}`);
console.log(`sha256          ${sha(html).slice(0, 16)}`);
console.log(`load state      ${JSON.stringify(loadState)}   field '${FIELD}', floor ${floorValue}`);
console.log(`existing key    '${prevKey}'   reset key '${prevTask.requirement.trigger.key}'   new trigger '${TRIGGER}'`);
console.log(`responds to     ${responds.join(', ')}   (must not include '${TRIGGER}')`);
console.log(`carried-forward on the base: passing [${cPass.join(',')}] of ${prevSpec.steps.length}  -> ${carriedAllPass}`);
console.log(`the new addition on the base: failing [${nFail.join(',')}]  -> absent: ${additionAbsent}`);
for (const c of (newRun.cases || [])) if (c.kind !== 'PASS') console.log(`    FAIL ${c.n}: ${String(c.text).slice(0, 130)}`);

if (!carriedAllPass || !additionAbsent) {
  console.error(`\nNOT EMITTED: a second addition needs every carried-forward check passing AND the new one absent`);
  process.exit(7);
}

const sub = (ns) => ({ ...spec, name: `steps-${ns.join('')}`, steps: spec.steps.filter((x) => ns.includes(x.n)) });
const all = steps.map((x) => x.n);
const task = {
  id: 'seq1-add2', group: 'SEQ1', source: 'internal', language: 'javascript', kind: 'build',
  dependsOn: prevTask.id,
  goal: `Continue the page already in index.html. Pressing ${TRIGGER} decreases ${FIELD} by one, and never below ${floorValue}. Everything that already works must keep working. The page is a single self-contained web page, index.html: plain HTML5 canvas and JavaScript, no frameworks, no external files or CDNs. ${spec.contract}`,
  requirement: {
    trigger: { kind: 'key', key: TRIGGER },
    effects: [`${FIELD} is one lower`],
    invariants: [`${FIELD} never goes below ${floorValue}`, `the ${prevKey} key keeps working`, 'everything that already works keeps working'],
  },
  seed: {},
  requested: { play: { spec: sub(all), steps: all } },
  // THE ACCUMULATED PROTECTED SET: addition 1's whole requested play, which is the original program's
  // behaviour plus addition 1's. Nothing earlier may be given up to buy this addition.
  accumulates: ['the page as delivered', prevTask.id],
  supersedes: [],
  protected: { plays: [{ from: `the page as delivered + ${prevTask.id}`, spec: prevSpec, steps: prevTask.requested.play.steps }] },
  diagnostic: { kind: 'play', spec: sub(all), timeoutSec: 90 },
  upstreamCases: all.length, protectedCases: prevTask.requested.play.steps.length,
  provenance: {
    baseSha: sha(html), field: FIELD, floorValue, trigger: TRIGGER, existingKey: prevKey,
    loadState, after1, after2, down1, down2, down3,
    carriedForwardFrom: prevTask.id, emittedAt: new Date().toISOString(),
    note: 'carried-forward expectations are addition 1 verbatim; the new steps come from the frozen rule',
  },
};
writeFileSync(join(DIR, 'play.json'), JSON.stringify(spec, null, 2) + NL, 'utf8');
writeFileSync(join(DIR, 'task.json'), JSON.stringify(task, null, 2) + NL, 'utf8');
console.log(`\nEMITTED ${join(DIR, 'task.json')}   protected = ${task.protected.plays[0].from} (${task.protectedCases} checks)`);
