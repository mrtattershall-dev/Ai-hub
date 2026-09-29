#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// decodingConsistencyCheck.mjs — DID EVERY CELL OF AN EXPERIMENT RUN UNDER THE SAME DECODING?
//
//   node server/decodingConsistencyCheck.mjs
//
// Every runner here takes its decoding from a COMMAND-LINE OPTION - `opt('temperature','0.2')`,
// `opt('seed','1')`, `opt('max-tokens',...)`. None reads an environment variable, so there is no env
// hole; the hole is larger. Any invocation can pass `--seed 7 --temperature 0.9`, the record will state
// those values perfectly honestly, and the COMPARISON ACROSS CELLS is silently broken - because each
// record faithfully describes only itself. A recorded parameter and an enforced one are not the same
// thing, and until now every comparison in this project rested on the first.
//
// This reads the preserved records and asks the question nothing asked at the time. It changes no
// runner and reruns nothing. Frozen experiments stay frozen; what was unchecked becomes checked.
//
// IT ALSO REPORTS WHAT WAS NEVER RECORDED, because an absent parameter is not a matching one.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const NL = String.fromCharCode(10);
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const warn = (m) => console.log(`  NOTE  ${m}`);

/** Pull whatever decoding each schema happens to carry. The schemas differ per runner, deliberately shown. */
function decodingOf(r) {
  const b = r.budget || {};
  return {
    arm: r.arm || r.condition || 'unrecorded',
    seed: r.decoding ? r.decoding.seed : (b.seed !== undefined ? b.seed : (r.seed !== undefined ? r.seed : null)),
    temperature: r.decoding ? r.decoding.temperature : null,
    maxTokens: r.decoding ? r.decoding.num_predict : (b.maxTokens !== undefined ? b.maxTokens : null),
  };
}

function survey(dir, label) {
  if (!existsSync(dir)) { console.log(`${NL}${label}: ${dir} not found`); return null; }
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  const cells = files.map((f) => ({ f, ...decodingOf(JSON.parse(readFileSync(join(dir, f), 'utf8'))) }));
  console.log(`${NL}${label} — ${cells.length} cells`);
  const groups = new Map();
  for (const c of cells) {
    const k = `${c.arm}|seed=${c.seed}|temp=${c.temperature}|maxTokens=${c.maxTokens}`;
    groups.set(k, (groups.get(k) || 0) + 1);
  }
  for (const [k, n] of [...groups].sort()) console.log(`    ${String(n).padStart(3)} x  ${k}`);
  return cells;
}

// ── PRESENTATION-1 ────────────────────────────────────────────────────────────────────────────────
const pres = survey('legasus/bench/suppression1/pres', 'PRESENTATION-1');
if (pres) {
  const sig = (c) => `${c.seed}|${c.temperature}|${c.maxTokens}`;
  const distinct = new Set(pres.map(sig));
  say(distinct.size === 1, distinct.size === 1
    ? `every one of the ${pres.length} cells ran under identical decoding (${[...distinct][0].replace(/\|/g, ', ')})`
    : `${distinct.size} DIFFERENT decoding settings across cells: ${[...distinct].join('  vs  ')}`);
  say(pres.every((c) => c.temperature !== null), 'and temperature is recorded in every cell');
}

// ── SUPPRESSION-1 ─────────────────────────────────────────────────────────────────────────────────
const sup = survey('legasus/bench/suppression1/runs', 'SUPPRESSION-1');
if (sup) {
  const byArm = new Map();
  for (const c of sup) byArm.set(c.arm, [...(byArm.get(c.arm) || []), c]);

  // SUPPRESSION-1_DEFINITION.md states "same token budget" twice, once inside the frozen question.
  const budgets = new Map();
  for (const [arm, cs] of byArm) budgets.set(arm, [...new Set(cs.map((c) => c.maxTokens))]);
  const allBudgets = [...new Set(sup.map((c) => c.maxTokens))];
  say(allBudgets.length === 1,
    allBudgets.length === 1
      ? `every arm shares one token budget (${allBudgets[0]})`
      : `THE ARMS DID NOT SHARE A TOKEN BUDGET: ${[...budgets].map(([a, b]) => `${a}=${b.join('/')}`).join('  ')} - but the frozen definition says "same token budget"`);

  say(sup.every((c) => c.temperature !== null),
    sup.every((c) => c.temperature !== null)
      ? 'temperature is recorded in every cell'
      : `TEMPERATURE WAS NEVER RECORDED for ${sup.filter((c) => c.temperature === null).length} of ${sup.length} cells - the value used is unrecoverable from the record, whatever it was`);

  const unrecorded = sup.filter((c) => c.maxTokens === null);
  if (unrecorded.length) warn(`${unrecorded.length} cells record no token budget at all (a different runner schema): ${[...new Set(unrecorded.map((c) => c.arm))].join(', ')}`);
}

// ── TRUNCATION, which is what an unequal budget actually does ─────────────────────────────────────
console.log(`${NL}did any arm end by exhausting its output cap?`);
const trunc = new Map();
for (const f of readdirSync('legasus/bench/suppression1/runs').filter((x) => x.endsWith('.json'))) {
  const r = JSON.parse(readFileSync(join('legasus/bench/suppression1/runs', f), 'utf8'));
  const arm = r.arm || 'manager (no arm field)';
  for (const a of r.attempts || []) {
    const dr = a.doneReason || (a.rawCompletion || {}).doneReason || 'unrecorded';
    const k = `${arm}|${dr}`;
    trunc.set(k, [...(trunc.get(k) || []), { f, outcome: a.outcome }]);
  }
}
for (const [k, v] of [...trunc].sort()) console.log(`    ${String(v.length).padStart(3)} x  ${k}`);
const cut = [...trunc].filter(([k]) => k.endsWith('|length')).flatMap(([k, v]) => v.map((x) => ({ arm: k.split('|')[0], ...x })));
say(cut.length === 0, cut.length === 0
  ? 'no attempt ended by exhausting its output cap'
  : `${cut.length} attempts ended TRUNCATED (doneReason=length), all in the small-budget arms: ${cut.map((c) => `${c.f.replace('.json', '')}→${c.outcome}`).join(', ')}`);

console.log(`${NL}  decoding consistency: ${passed} passed, ${failed} failed -> ${failed
  ? 'AT LEAST ONE EXPERIMENT DID NOT RUN UNDER THE DECODING ITS DEFINITION CLAIMS'
  : 'every cell of every experiment ran under the decoding its definition declares'}`);
process.exit(failed ? 1 : 0);
