#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// suffixBoundaryAudit.mjs — did the model fail to STOP, or did my harness fail to CUT?
//
//   node server/suffixBoundaryAudit.mjs
//
// PRESENTATION-1 is untouched. Its primary gate stands: 0 accepted in every condition. This is a
// SEPARATE post-hoc analysis of already-saved raw output, and it is reported separately.
//
// Six of twelve S completions ended with `</script></body></html>`. I called that a completion-horizon
// failure. That was an overstatement: TWO explanations fit, and they are distinguishable from the bytes
// already on disk.
//
//   1  the model did not know when its middle should end
//   2  the harness did not treat an EXACT repeat of the supplied suffix as a normal boundary
//
// Many FIM harnesses trim a re-emitted suffix as routine. Mine does not. If the completions contain the
// suffix byte for byte, then (2) is an APPARATUS defect on my side and the middles were valid.
//
// TWO CONTROLS, because a trimmer that is too eager is worse than none:
//   ERASURE   a completion with real code AFTER the repeated suffix must be REPORTED, never silently cut
//   MALFORMED a near-miss suffix must NOT be cut, and must stay refused
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const NL = String.fromCharCode(10);
const { containToSlot } = await import('./localEdit.mjs');
const { playCheck } = await import('./playCheck.js');
const { featureConstructed } = await import('./rescore.mjs');

/**
 * Cut a completion at the first EXACT byte-for-byte occurrence of the supplied suffix.
 * Returns what precedes it, and everything that followed, so erasure is visible rather than silent.
 */
export function cutAtExactSuffix(completion, suffix) {
  const s = String(suffix);
  // The suffix as sent begins with a newline; the model re-emits it without that lead often enough
  // that both forms are tried, longest first, and which one matched is reported.
  const forms = [s, s.replace(/^\r?\n/, '')].filter((f, i, a) => f && a.indexOf(f) === i);
  for (const f of forms) {
    const at = String(completion).indexOf(f);
    if (at === -1) continue;
    return {
      found: true, at, form: f === s ? 'exact-as-sent' : 'suffix-without-leading-newline',
      middle: String(completion).slice(0, at),
      after: String(completion).slice(at + f.length),
    };
  }
  return { found: false, middle: null, after: null };
}

/** Is what follows the cut just whitespace, or real content that cutting would erase? */
export const trailingIsInert = (after) => !String(after || '').trim();

const PRES = 'legasus/bench/suppression1/pres';
const PAGES = 'legasus/bench/suppression1';
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

// ══ CONTROLS FIRST. An audit that has not shown it can be wrong proves nothing. ═════════════════
console.log('\ncontrols');
const SUF = NL + '</script>' + NL + '</body>' + NL + '</html>' + NL;
const GOOD = "const b = document.createElement('button');";
const erasure = cutAtExactSuffix(GOOD + SUF + "alert('real code after the suffix');", SUF);
say(erasure.found, 'ERASURE control: the suffix is located');
say(!trailingIsInert(erasure.after), `and the real code after it is REPORTED, not silently dropped (${JSON.stringify(erasure.after.slice(0, 40))})`);
const malformed = cutAtExactSuffix(GOOD + NL + '</scrip>' + NL + '</body>', SUF);
say(!malformed.found, 'MALFORMED control: a near-miss suffix is NOT cut');
const clean = cutAtExactSuffix(GOOD + SUF, SUF);
say(clean.found && trailingIsInert(clean.after) && clean.middle === GOOD,
  'CLEAN control: an exact repeat cuts to exactly the middle, nothing after');

// ══ THE ANALYSIS ════════════════════════════════════════════════════════════════════════════════
console.log(`${NL}S completions, analysed from saved bytes`);
const rows = [];
for (let i = 1; i <= 12; i++) {
  const p = 's' + String(i).padStart(2, '0');
  const f = join(PRES, `${p}-S.json`);
  if (!existsSync(f)) continue;
  const run = JSON.parse(readFileSync(f, 'utf8'));
  const a = run.attempts[0] || {};
  const raw = (a.rawCompletion || {}).text || '';
  const pageFile = join(PAGES, p, 'baseline-as-delivered.html');
  const page = readFileSync(pageFile, 'utf8');
  const task = JSON.parse(readFileSync(join(PAGES, p, 'task.json'), 'utf8'));
  const at = page.lastIndexOf('</script>');
  const suffix = NL + page.slice(at);

  const cut = cutAtExactSuffix(raw, suffix);
  const row = { page: p, primaryOutcome: run.totals.outcome, suffixRepeated: cut.found, form: cut.form || null, trailingInert: cut.found ? trailingIsInert(cut.after) : null };
  if (cut.found && cut.middle.trim()) {
    const contained = containToSlot(cut.middle, { maxLines: 20, allowListener: true });
    row.middleParses = contained.ok;
    row.middleReason = contained.ok ? null : contained.reason;
    if (contained.ok) {
      const candidate = page.slice(0, at) + NL + contained.text + NL + page.slice(at);
      const fc = await featureConstructed(candidate, { task, spec: task.diagnostic.spec, control: task.requirement.trigger.selector, deps: { playCheck } });
      row.controlExists = fc.exists;
      row.featureConstructed = fc.ok;
      row.effectsPassed = fc.effectsPassed;
    }
  }
  rows.push(row);
}

console.log('  page  primary outcome                 suffix repeated  middle parses  control exists  feature built');
for (const r of rows) {
  console.log(`  ${r.page}  ${String(r.primaryOutcome).padEnd(30)} ${String(r.suffixRepeated).padEnd(16)} ${String(r.middleParses ?? '-').padEnd(14)} ${String(r.controlExists ?? '-').padEnd(15)} ${r.featureConstructed ?? '-'}`);
}

const repeated = rows.filter((r) => r.suffixRepeated);
const recovered = rows.filter((r) => r.middleParses);
const built = rows.filter((r) => r.featureConstructed);
const erased = rows.filter((r) => r.suffixRepeated && r.trailingInert === false);
console.log(`${NL}  suffix repeated byte-for-byte: ${repeated.length} of ${rows.length}`);
console.log(`  a JavaScript-only middle recovered by cutting there: ${recovered.length}`);
console.log(`  of those, the control then exists: ${rows.filter((r) => r.controlExists).length}; feature constructed: ${built.length}`);
console.log(`  completions where cutting would ERASE real trailing code: ${erased.length}${erased.length ? ' - ' + erased.map((r) => r.page).join(',') : ''}`);
console.log(`${NL}  reading:`);
console.log('    repeated + recoverable  -> the HARNESS did not treat a re-emitted suffix as a boundary');
console.log('    not repeated            -> the model did not know where to stop; horizon stands');
console.log(`${NL}  controls: ${passed} passed, ${failed} failed${failed ? ' - THE AUDIT IS NOT CREDIBLE' : ''}`);
console.log('  PRESENTATION-1 primary gate is UNCHANGED by this analysis: 0 accepted in every condition.');
process.exit(failed ? 1 : 0);
