/**
 * diagnose.test.mjs - does the diagnosis engine choose the right observation and reach the right
 * cause, WITHOUT anyone reading the error?
 *
 *   node server/diagnose.test.mjs
 *
 * The claim worth testing is not "it gets arm B right" - a lookup table would do that. It is that
 * the SAME engine, over the SAME failure signature, reaches DIFFERENT causes when the observation
 * differs, and refuses when the observation is missing. So the same null-element error is presented
 * three ways:
 *
 *   the element is nowhere            -> INTERFACE_NEVER_BUILT
 *   the element appears after parsing -> LOOKUP_TOO_EARLY
 *   an id one letter away exists      -> WRONG_IDENTIFIER
 *
 * plus: a malformed script is diagnosed alone and blocks behavioural explanations; a state update
 * outside its guard is caught behaviourally; missing evidence is declined by name; an unreproduced
 * failure is declined before anything else.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const { diagnose, collectEvidence, EXPLANATIONS } = await import('./diagnose.mjs');
const { playCheck } = await import('./playCheck.js');
const { farmTasks } = await import('./benchTasks.js');
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const task = farmTasks().find((t) => t.id === 'farm-plant');
const deps = { playCheck, writeFileSync, readFileSync, mkdtempSync, rmSync, join, tmpdir, execFileSync };

const SEAM = "        window.game = { state: () => JSON.parse(JSON.stringify({ player, tiles, inventory, day })) };";
const STATE = [
  '        const player = { x: 0, y: 0 };',
  '        const tiles = {};',
  '        const inventory = { seeds: 5, crops: 0 };',
  '        let day = 0;',
  '        function movePlayer(e) {',
  "          const dx = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;",
  "          const dy = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;",
  '          player.x += dx; player.y += dy;',
  '        }',
  "        document.addEventListener('keydown', movePlayer);",
].join('\n');

/**
 * The fixtures. To reproduce a LOAD-TIME null lookup while still exposing state, the state and the
 * seam go in one script and the throwing lookup in a LATER script block: top-level `const` in a
 * classic script is shared across blocks, so the seam survives a throw that happens after it. This
 * matters - the first version of this fixture used setTimeout, by which time the element existed, so
 * it could not produce the failure it was meant to test.
 */
const fixture = ({ lookup = 'plant', buttonAfter = null, handlerBody = null, broken = false } = {}) => [
  '<!DOCTYPE html>', '<html><head><title>t</title></head><body>',
  '    <canvas id="gameCanvas" width="80" height="60"></canvas>',
  '    <script>',
  STATE,
  SEAM,
  handlerBody || '',
  '    </script>',
  broken ? '    <script>\n        function oops( {\n    </script>' : '',
  lookup && !handlerBody ? `    <script>\n        document.getElementById('${lookup}').addEventListener('click', () => {});\n    </script>` : '',
  buttonAfter ? `    <button id="${buttonAfter}">b</button>` : '',
  '</body></html>',
].filter((l) => l !== '').join('\n');

async function evidenceFor(html) {
  const ws = mkdtempSync(join(tmpdir(), 'diag-'));
  try {
    writeFileSync(join(ws, 'index.html'), html, 'utf8');
    return await collectEvidence({ workspace: ws, task, deps });
  } finally { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } }
}

console.log('=== every explanation must be contradictable ===');
say(EXPLANATIONS.every((x) => typeof x.predicts === 'function'), 'each explanation names the observation that could contradict it');
say(EXPLANATIONS.filter((x) => x.signature === 'NULL_PROPERTY_READ').length >= 3,
  `a null-element error has at least three competing explanations (${EXPLANATIONS.filter((x) => x.signature === 'NULL_PROPERTY_READ').map((x) => x.id).join(', ')})`);

console.log('\n=== the same error, three different worlds ===');
{
  const nowhere = await evidenceFor(fixture());
  const d1 = diagnose(nowhere);
  console.log(`        nowhere:        considered ${d1.considered.length}, surviving [${d1.surviving.join(',')}]`);
  say(d1.plan?.cause === 'INTERFACE_NEVER_BUILT', `an element that is nowhere -> ${d1.plan?.cause || 'DECLINED:' + d1.declined?.reason}`);
  say(d1.considered.length >= 3 && d1.eliminated.length >= 2, `three explanations considered, ${d1.eliminated?.length} eliminated by observation`);
  say((d1.plan?.limits || []).some((l) => /does not rule out a later dynamic insertion/.test(l)), 'and the conclusion carries the limit of what the observation supports');

  const late = await evidenceFor(fixture({ buttonAfter: 'plant' }));
  const d2 = diagnose(late);
  console.log(`        appears later:  surviving [${d2.surviving.join(',')}]  ids after ready ${JSON.stringify(d2.observations.IDS_PRESENT?.idsAfterReady)}`);
  say(d2.plan?.cause === 'LOOKUP_TOO_EARLY', `an element that appears after parsing -> ${d2.plan?.cause || 'DECLINED:' + d2.declined?.reason}`);

  const typo = await evidenceFor(fixture({ buttonAfter: 'plantt' }));
  const d3 = diagnose(typo);
  console.log(`        one letter off: surviving [${d3.surviving.join(',')}]  ids after ready ${JSON.stringify(d3.observations.IDS_PRESENT?.idsAfterReady)}`);
  say(d3.plan?.cause === 'WRONG_IDENTIFIER', `an id one letter away -> ${d3.plan?.cause || 'DECLINED:' + d3.declined?.reason}`);
  say(d3.plan?.obligations?.some((o) => /plantt/.test(o)), 'and the obligation names the id the document actually has');

  say(new Set([d1.plan?.cause, d2.plan?.cause, d3.plan?.cause]).size === 3,
    'THE DISCRIMINATION: one engine, one error signature, three different causes - driven by the observation, not by a lookup table');
}

console.log('\n=== the real arm B candidate, diagnosed from its own run ===');
{
  const armB = JSON.parse(readFileSync(join(HERE, '..', 'legasus', 'screen', 'MODEL-CMP-1_armB_seed3.json'), 'utf8')).candidate.text;
  const e = await evidenceFor(armB);
  const d = diagnose(e);
  console.log(`        surviving [${d.surviving.join(',')}]  scope ${JSON.stringify(d.plan?.scope)}`);
  say(d.plan?.cause === 'INTERFACE_NEVER_BUILT', `the cause REPAIR-2's model got wrong is reached mechanically (${d.plan?.cause})`);
  say(d.plan?.scope?.kind === 'line' && typeof d.plan.scope.line === 'number', `with a bounded scope: line ${d.plan?.scope?.line}`);
  say(/edit before rewrite/.test(d.plan?.scopePreference || ''), 'and the smallest-change preference recorded as a preference, not a rule');
  say(d.plan?.obligations?.some((o) => /must not depend on an element/.test(o)), 'the obligation forbids depending on the absent element');
  say(d.plan?.obligations?.some((o) => /must keep passing/.test(o)), 'and requires the already-passing checks to keep passing');
}

console.log('\n=== a malformed script is diagnosed alone ===');
{
  const e = await evidenceFor(fixture({ broken: true }));
  const d = diagnose(e);
  say(d.plan?.cause === 'MALFORMED_CODE', `a script that does not parse -> ${d.plan?.cause || 'DECLINED:' + d.declined?.reason}`);
  say(!d.considered.some((c) => c.id === 'INTERFACE_NEVER_BUILT'), 'and no behavioural explanation is even considered over code that does not parse');
  // The malformed block is the SECOND one here. Checking only the first block missed it entirely and
  // let a load-time exception be diagnosed as a behavioural cause instead.
  say(e.syntax?.block === 2, `the malformed block is found even though it is not the first (block ${e.syntax?.block})`);
  say(typeof d.plan?.scope?.line === 'number' && d.plan.scope.line > 10,
    `and the scope is a FILE line, not a line within the block (line ${d.plan?.scope?.line} of the file, ${e.syntax?.lineWithinBlock} within the block)`);
}

console.log('\n=== a state update outside its guard, caught behaviourally ===');
{
  const leaky = [
    "        document.addEventListener('keydown', (e) => {",
    "          if (e.key !== 'p') return;",
    '          const k = player.x + "," + player.y;',
    '          if (inventory.seeds > 0) {',
    "            if (!tiles[k]) tiles[k] = { crop: 'wheat', stage: 0 };",
    '            inventory.seeds--;',            // outside the !tiles[k] guard: the defect
    '          }',
    '        });',
  ].join('\n');
  const e = await evidenceFor(fixture({ lookup: null, handlerBody: leaky }));
  const d = diagnose(e);
  console.log(`        signatures [${d.signatures.join(',')}]  surviving [${d.surviving.join(',')}]`);
  say(d.signatures.includes('STATE_CHANGED_WHEN_IT_MUST_NOT'), 'the signature is read off the failing check, not the code');
  say(d.plan?.cause === 'EFFECT_OUTSIDE_ITS_GUARD', `the cause is reached (${d.plan?.cause || 'DECLINED:' + d.declined?.reason})`);
  say(d.plan?.obligations?.some((o) => /same path as the effect/.test(o)), 'and the obligation states what must hold, not how to write it');
}

console.log('\n=== it declines rather than guesses ===');
{
  const e = await evidenceFor(fixture());
  const blind = diagnose({ ...e, dom: null });
  say(blind.plan === null && blind.declined?.reason === 'OBSERVATION_UNAVAILABLE', `without the DOM observation it DECLINES (${blind.declined?.reason})`);
  say(/IDS_PRESENT/.test(blind.declined?.needed || ''), 'and names the observation it needs');
  say((blind.declined?.competing || []).length >= 3, `while listing the explanations it cannot separate (${(blind.declined?.competing || []).join(', ')})`);

  const unrep = diagnose({ reproduced: false });
  say(unrep.declined?.reason === 'UNREPRODUCED', 'an unreproduced failure is declined before anything else');
  say(/captures the error, the code version/.test(unrep.declined?.needed || ''), 'naming what a reproduction must capture');
}

console.log(`\n  diagnosis engine: ${passed} passed, ${failed} failed -> ${failed ? 'THE ENGINE IS NOT ESTABLISHED' : 'the observation decides the cause, the scope is bounded, and missing evidence is declined by name'}`);
process.exit(failed ? 1 : 0);
