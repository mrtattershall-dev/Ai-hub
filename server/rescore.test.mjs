/**
 * rescore.test.mjs — the re-scorer is not credible until BOTH controls behave correctly.
 *
 *   node server/rescore.test.mjs
 *
 * FROZEN before any PRESENTATION-1 output was inspected. The negative control is a REAL comments-only
 * completion recovered from FARMEXT-1's preserved corpus - not one written to be caught. The positive
 * control is a hand-written working candidate.
 *
 * A re-scorer that only rejects is as useless as one that only accepts.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parsedLocalReferences, featureConstructed, pageSymbolsOf, executableOnly } from './rescore.mjs';

const NL = String.fromCharCode(10);
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const { playCheck } = await import('./playCheck.js');
const { topLevelFunctions } = await import('./editPlanner.mjs');

const PAGE_DIR = 'legasus/bench/suppression1/s01';
const page = readFileSync(join(PAGE_DIR, 'baseline-as-delivered.html'), 'utf8');
const task = JSON.parse(readFileSync(join(PAGE_DIR, 'task.json'), 'utf8'));
const spec = task.diagnostic.spec;
const CONTROL = task.requirement.trigger.selector;
const symbols = pageSymbolsOf(page, topLevelFunctions);
const at = page.lastIndexOf('</script>');
const splice = (code) => page.slice(0, at) + NL + code + NL + page.slice(at);

console.log(`\npage symbols available for reference: ${symbols.join(', ')}`);

// ══ the NEGATIVE control: a real comments-only completion from FARMEXT-1 ═══════════════════════
console.log('\nNEGATIVE control - a REAL comments-only completion from FARMEXT-1');
let realComments = null;
const fd = 'legasus/bench/farmext/runs';
if (existsSync(fd)) {
  for (const f of readdirSync(fd)) {
    if (!/^contract-s\d+\.attempts$/.test(f)) continue;
    for (const g of readdirSync(join(fd, f))) {
      if (!g.endsWith('.json')) continue;
      const t = JSON.parse(readFileSync(join(fd, f, g), 'utf8')).completion?.text || '';
      if (t.trim() && t.split(NL).every((l) => !l.trim() || l.trim().startsWith('//'))) { realComments = t; break; }
    }
    if (realComments) break;
  }
}
say(!!realComments, `recovered a real comments-only completion from the preserved corpus${realComments ? ` (${realComments.length} chars)` : ''}`);
if (realComments) {
  const lr = parsedLocalReferences(realComments, symbols);
  say(!lr.ok, `parsedLocalReferences REJECTS it (comments stripped; used: [${lr.used.join(',')}])`);
}

// A comments-only completion that NAMES everything, to make the point unmissable.
const TALKS = `        // I would createElement a button with id="clear-filter"${NL}        // then addEventListener on it, set field.value = '' and call filterRows()`;
const talksRef = parsedLocalReferences(TALKS, symbols);
say(!talksRef.ok, 'a comments-only completion that NAMES field and filterRows is still rejected');
const fcTalks = await featureConstructed(splice(TALKS), { task, spec, control: CONTROL, deps: { playCheck } });
say(!fcTalks.ok && !fcTalks.exists, `featureConstructed REJECTS it - the control does not exist in the DOM (exists:${fcTalks.exists})`);

// ══ the POSITIVE control: a hand-written working candidate ═════════════════════════════════════
console.log('\nPOSITIVE control - a hand-written working candidate');
const WORKS = `        const b = document.createElement('button');
        b.id = 'clear-filter';
        b.textContent = 'Clear';
        document.body.appendChild(b);
        b.addEventListener('click', function () { field.value = ''; filterRows(); });`;
const worksRef = parsedLocalReferences(WORKS, symbols);
say(worksRef.ok, `parsedLocalReferences ACCEPTS it (used: [${worksRef.used.join(',')}])`);
const fcWorks = await featureConstructed(splice(WORKS), { task, spec, control: CONTROL, deps: { playCheck } });
say(fcWorks.exists, 'featureConstructed finds the control in the DOM');
say(fcWorks.ok, `and clicking it produces declared effects (steps ${fcWorks.effectsPassed.join(',') || 'none'})`);

// ══ the DISCRIMINATING middle: creates the control but does nothing ═════════════════════════════
console.log('\nMIDDLE - an INERT control: exists, wired, achieves nothing');
const INERT = `        const b = document.createElement('button');
        b.id = 'clear-filter';
        document.body.appendChild(b);
        b.addEventListener('click', function () { const intended = ''; });`;
const fcInert = await featureConstructed(splice(INERT), { task, spec, control: CONTROL, deps: { playCheck } });
say(fcInert.exists, 'the control DOES exist');
say(!fcInert.ok, 'but featureConstructed rejects it - existing is not constructing');

// ══ the handler-without-button case, which is the whole reason for this split ═══════════════════
console.log('\nTHE PROBE CASE - a handler bound to a control it never created');
const HANDLER_ONLY = `        document.getElementById('clear-filter').addEventListener('click', function () { field.value = ''; filterRows(); });`;
const hoRef = parsedLocalReferences(HANDLER_ONLY, symbols);
say(hoRef.ok, `parsedLocalReferences ACCEPTS it (used: [${hoRef.used.join(',')}]) - it really does reference page symbols`);
const fcHo = await featureConstructed(splice(HANDLER_ONLY), { task, spec, control: CONTROL, deps: { playCheck } });
say(!fcHo.ok, 'featureConstructed REJECTS it - so the two categories separate exactly where they should');

console.log(`\n  re-scorer: ${passed} passed, ${failed} failed -> ${failed ? 'NOT CREDIBLE - do not apply it' : 'both controls behave correctly; safe to apply mechanically'}`);
process.exit(failed ? 1 : 0);
