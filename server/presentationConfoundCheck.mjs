#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// presentationConfoundCheck.mjs — DID THE RUN ACTUALLY USE THE WIRES THE AUDIT DESCRIBES?
//
//   node server/presentationConfoundCheck.mjs
//
// WHY THIS FILE EXISTS. `presentationAudit.mjs` asserts six invariants - the suffix is byte-identical
// across conditions, N and H carry an identical prefix, H and S differ only in their system section,
// and so on. Those are the confound control that `PRESENTATION-1_DEFINITION.md` cites.
//
// BUT IT BUILDS THE THREE WIRES ITSELF, from its own constants, and then asserts over those locals. It
// never reads `presentationRun.mjs` and never reads the run records. So it establishes that THE AUDIT
// FILE IS INTERNALLY CONSISTENT. If the runner's wire construction ever drifted from the audit's copy,
// every invariant would still print `ok` - a tautology over its own locals, in the exact place a frozen
// experiment's confound is supposed to be controlled.
//
// IT IS RECOVERABLE, and that is the point: the run recorded `wireSha`, `wireBytes`, `codePrefixSha`
// and `suffixSha` for every page and condition. So the comparison the audit never made can still be
// made from preserved data. This file makes it - by SPAWNING the audit and reading its printed shas,
// never by re-implementing its construction, because re-implementing it here would reproduce exactly
// the self-certification this file exists to break.
//
// NOTHING IN PRESENTATION-1 IS RERUN OR REVISED. This reads what was preserved and compares it.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const NL = String.fromCharCode(10);
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const PAGES = Array.from({ length: 12 }, (_, i) => `s${String(i + 1).padStart(2, '0')}`);
const CONDS = ['N', 'H', 'S'];

/** Run the audit on one page and read the shas IT computed, from its own table. */
function auditShas(dir) {
  const out = execFileSync(process.execPath, ['server/presentationAudit.mjs', '--page', dir], { encoding: 'utf8' });
  const shas = {};
  for (const line of out.split(NL)) {
    const m = /^\s{2}([NHS])\s+\S.*?\s(\d+)\s\s([0-9a-f]{16})\s*$/.exec(line);
    if (m) shas[m[1]] = { sha: m[3], bytes: Number(m[2]) };
  }
  const problems = /(\d+) problem/.exec(out);
  return { shas, invariantsOk: !/^\s+BAD /m.test(out), problems: problems ? Number(problems[1]) : null };
}

console.log('comparing the wires the AUDIT describes against the wires the RUN recorded' + NL);

let compared = 0;
const mismatches = [];
for (const p of PAGES) {
  const dir = join('legasus/bench/suppression1', p);
  if (!existsSync(join(dir, 'task.json'))) { console.log(`  ${p}: no task, skipped`); continue; }
  let a;
  try { a = auditShas(dir); } catch (e) { say(false, `${p}: the audit could not run: ${String(e.message).slice(0, 80)}`); continue; }
  const row = [];
  for (const c of CONDS) {
    const rec = join('legasus/bench/suppression1/pres', `${p}-${c}.json`);
    if (!existsSync(rec)) { row.push(`${c}:no-record`); continue; }
    const r = JSON.parse(readFileSync(rec, 'utf8'));
    const mine = a.shas[c];
    if (!mine) { row.push(`${c}:unparsed`); continue; }
    compared++;
    const same = mine.sha === r.wireSha && mine.bytes === r.wireBytes;
    if (!same) mismatches.push({ page: p, cond: c, audit: mine, recorded: { sha: r.wireSha, bytes: r.wireBytes } });
    row.push(`${c}:${same ? 'match' : 'MISMATCH'}`);
  }
  console.log(`  ${p}  ${row.join('  ')}   ${a.invariantsOk ? 'audit invariants ok' : 'AUDIT REPORTED A PROBLEM'}`);
}

say(compared === 36, `all ${compared} page/condition pairs were compared (expected 36)`);
say(mismatches.length === 0, mismatches.length
  ? `${mismatches.length} wire(s) DIFFER from what the run recorded: ${mismatches.map((m) => `${m.page}-${m.cond} audit ${m.audit.sha}/${m.audit.bytes}B vs recorded ${m.recorded.sha}/${m.recorded.bytes}B`).join('; ')}`
  : 'every wire the audit describes is byte-identical to the wire the run actually sent');

// ══ THE CONTROL. A comparison that always agrees proves nothing, so cross-compare MISMATCHED pairs and
//    require them to differ. If N's wire equalled H's recorded wire, the conditions were never distinct.
const ctl = auditShas(join('legasus/bench/suppression1', 's01'));
const recOf = (c) => JSON.parse(readFileSync(join('legasus/bench/suppression1/pres', `s01-${c}.json`), 'utf8')).wireSha;
say(ctl.shas.N.sha !== recOf('H') && ctl.shas.H.sha !== recOf('S') && ctl.shas.N.sha !== recOf('S'),
  'CONTROL: audited N/H/S do NOT match each other\'s recorded wires - the comparison can distinguish, and the three conditions really are three');

// The suffix and prefix the run recorded, against the audit's own claim about them.
const s01 = CONDS.map((c) => JSON.parse(readFileSync(join('legasus/bench/suppression1/pres', `s01-${c}.json`), 'utf8')));
say(new Set(s01.map((r) => r.suffixSha)).size === 1,
  `the RECORDED suffix is byte-identical across the three conditions (${s01[0].suffixSha}) - the audit's first invariant, checked against the run rather than against itself`);
say(s01[0].codePrefixSha === s01[1].codePrefixSha,
  `the RECORDED code prefix is identical for N and H (${s01[0].codePrefixSha}) - so N vs H isolates the wrapper, in the data and not only in the audit`);

console.log(`${NL}  confound check: ${passed} passed, ${failed} failed -> ${failed
  ? 'THE AUDIT DESCRIBES WIRES THE RUN DID NOT SEND; PRESENTATION-1\'S CONFOUND CONTROL DOES NOT HOLD'
  : 'the audit\'s invariants are true of the wires the run actually sent, not only of the audit\'s own locals'}`);
process.exit(failed ? 1 : 0);
