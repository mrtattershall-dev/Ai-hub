/**
 * clearFilterIntegration.test.mjs — a genuine NON-KEYBOARD addition, verified through the REAL path.
 *
 *   node server/clearFilterIntegration.test.mjs
 *
 * The requirement: **clicking #clear-filter empties the filter and shows the whole list again, and the
 * filter keeps working afterwards, including repeated clears.**
 *
 * The five things this has to establish, none of which a unit test of a checker could:
 *   1 the PLANNER's proposal determines the edit site and the guidance
 *   2 the generated button clears the input and restores the full list
 *   3 filtering still works afterwards, including REPEATED clears
 *   4 a plausible button that DOES NOTHING is rejected
 *   5 the final acceptance decision controls which artefact survives
 *
 * LIST CHECKS ARE SCOPED TO THE LIST'S ITEMS. The addition legitimately adds a visible button, so a
 * preservation check over ALL visible text would break the moment the button appeared - condemning a
 * correct change for doing exactly what it was asked to do.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const git = (ws, args) => exec('git', ['-C', ws, ...args], { windowsHide: true });
const NL = String.fromCharCode(10);

const { plan, MOVE } = await import('./editPlanner.mjs');
const { selectObservation } = await import('./observationSelect.mjs');
const { judgeAndDecide, shouldRetain } = await import('./retainPath.mjs');
const { judgeCandidate } = await import('./judgeCandidate.mjs');
const { playCheck } = await import('./playCheck.js');
const { evaluate } = await import('./evaluator.js');
const { applyAcceptance } = await import('./acceptance.js');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const ITEMS = ['apple', 'apricot', 'banana', 'cherry', 'date'];
const BASE = `<!DOCTYPE html><html><body>
<h1>Fruit</h1>
<input type="text" id="filter" placeholder="filter">
<ul id="list">${ITEMS.map((x) => `<li class="item">${x}</li>`).join('')}</ul>
<script>
const input = document.getElementById('filter');
const items = Array.from(document.querySelectorAll('#list .item'));
function applyFilter() {
  const q = input.value.toLowerCase();
  items.forEach((li) => { li.style.display = li.textContent.toLowerCase().includes(q) ? '' : 'none'; });
}
input.addEventListener('input', applyFilter);
</script></body></html>`;

/** The addition, written as a correct implementation - the reference a model would have to match. */
const GOOD_ADDITION = `
const clearBtn = document.createElement('button');
clearBtn.id = 'clear-filter';
clearBtn.textContent = 'Clear';
document.body.appendChild(clearBtn);
clearBtn.addEventListener('click', () => { input.value = ''; applyFilter(); });`;

/** A PLAUSIBLE button that does nothing: it exists, it is labelled, it is wired, and it has no effect. */
const INERT_ADDITION = `
const clearBtn = document.createElement('button');
clearBtn.id = 'clear-filter';
clearBtn.textContent = 'Clear';
document.body.appendChild(clearBtn);
clearBtn.addEventListener('click', () => { const intended = ''; });`;

const withAddition = (add) => BASE.replace('</script>', add + NL + '</script>');

// ── the checks, scoped to the list's items and specified from the REQUIREMENT ──
const listOnly = `dom.visible.filter((t) => ${JSON.stringify(ITEMS)}.includes(t))`;
const ALL = JSON.stringify(JSON.stringify(ITEMS));
const AP = JSON.stringify(JSON.stringify(ITEMS.filter((x) => x.includes('ap'))));
const steps = [
  { n: 1, name: 'all items visible at load', do: [], expect: `errors.length === 0 && JSON.stringify(${listOnly}) === ${ALL}` },
  { n: 2, name: 'typing "ap" narrows the list', do: [{ kind: 'type', selector: '#filter', text: 'ap' }], expect: `JSON.stringify(${listOnly}) === ${AP}` },
  { n: 3, name: 'clicking #clear-filter restores the whole list', do: [{ kind: 'click', selector: '#clear-filter' }], expect: `JSON.stringify(${listOnly}) === ${ALL}` },
  { n: 4, name: 'and empties the filter input', do: [], expect: `dom.inputValues['#filter'] === ''` },
  { n: 5, name: 'filtering still works after clearing', do: [{ kind: 'type', selector: '#filter', text: 'ap' }], expect: `JSON.stringify(${listOnly}) === ${AP}` },
  { n: 6, name: 'a SECOND clear also restores the whole list', do: [{ kind: 'click', selector: '#clear-filter' }], expect: `JSON.stringify(${listOnly}) === ${ALL}` },
  { n: 7, name: 'and filtering still works after the second clear', do: [{ kind: 'type', selector: '#filter', text: 'ap' }], expect: `JSON.stringify(${listOnly}) === ${AP}` },
  { n: 8, name: 'no page or console error at any point', do: [], expect: 'noErrors' },
];
const spec = { entry: 'index.html', stateExpr: 'null', contract: 'clear filter', steps };
// Carried forward: the page's own filtering, scoped to list items so a new button cannot break it.
const CARRIED = [1, 2, 8];
const sub = (ns) => ({ ...spec, name: `s${ns.join('')}`, steps: steps.filter((s) => ns.includes(s.n)) });
const task = {
  id: 'clear-filter', group: 'INTEG', source: 'internal', language: 'javascript', kind: 'build',
  goal: 'clicking #clear-filter empties the filter and shows the whole list again',
  requirement: {
    trigger: { kind: 'click', selector: '#clear-filter' },
    effects: ['the filter input is empty', 'every item in the list is visible again'],
    invariants: ['typing in the filter still narrows the list'],
  },
  seed: {}, requested: { play: { spec, steps: steps.map((s) => s.n) } },
  accumulates: [], supersedes: [],
  protected: { plays: [{ from: 'the page as delivered', spec: sub(CARRIED), steps: CARRIED }] },
  diagnostic: { kind: 'play', spec, timeoutSec: 90 },
  upstreamCases: steps.length, protectedCases: CARRIED.length,
};

async function throughRealPath(html) {
  const ws = mkdtempSync(join(tmpdir(), 'clearf-'));
  try {
    writeFileSync(join(ws, 'index.html'), BASE, 'utf8');
    await git(ws, ['init', '-q']); await git(ws, ['config', 'core.autocrlf', 'false']);
    await git(ws, ['add', '-A']);
    await git(ws, ['-c', 'user.email=i@i', '-c', 'user.name=i', 'commit', '-q', '-m', 'start']);
    const startRef = (await git(ws, ['rev-parse', 'HEAD'])).stdout.trim();
    writeFileSync(join(ws, 'index.html'), html, 'utf8');
    await git(ws, ['add', '-A']);
    await git(ws, ['-c', 'user.email=i@i', '-c', 'user.name=i', 'commit', '-q', '-m', 'cand']).catch((e) => {
      if (!/nothing to commit/i.test(String(e.stdout || '') + String(e.stderr || ''))) throw e;
    });
    const rec = { boundaries: {}, timing: {} };
    const decision = await judgeAndDecide({
      ws, task, spec, startRef, rec, T0: Date.now(),
      deps: { judgeCandidate, playCheck, evaluate, applyAcceptance }, runVisual: false, runRender: false,
    });
    return { decision, rec, retained: shouldRetain(decision) };
  } finally { if (existsSync(ws)) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } } }
}

// ══ 1. the planner's proposal decides the site and the guidance ═════════════════════════════════
{
  console.log('\n1. the PLANNER decides where the change goes, from the request and the structure');
  const ws = mkdtempSync(join(tmpdir(), 'plan-'));
  let obs;
  try { writeFileSync(join(ws, 'index.html'), BASE, 'utf8'); obs = await selectObservation(ws); }
  finally { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } }

  say(obs.selected.map((s) => s.adapterId).join() === 'browser.input', `the page is observed as input-driven (${obs.selected.map((s) => s.adapterId).join() || 'none'})`);
  const p = plan({ file: BASE, requirement: task.requirement, observation: obs });
  say(p.move === MOVE.CREATE_CONTROL, `the proposed move is CREATE_A_CONTROL_AND_WIRE_IT (${p.move})`);
  say(!p.declined, 'it is NOT declined merely because the observed modality is typing');
  say(p.evidence.some((e) => /NO control with that selector exists/.test(e)), 'with evidence that the requested control does not exist');
  say(p.evidence.some((e) => /informs this choice and does not determine the implementation/.test(e)),
    'and the adapter recorded as INFORMING the choice, not dictating it');
  say(p.site && p.site.insertAfterLine > 0, `a concrete site is proposed (after line ${p.site && p.site.insertAfterLine})`);
  say(p.uncertainty.some((u) => /counts visible elements/.test(u)),
    'and the proposal flags that adding a control changes what the page shows');
  say(p.preservationObligations.length > 0, 'preservation obligations are stated');
}

// ══ 2-3. the good addition clears, restores, and keeps filtering - including repeats ════════════
{
  console.log('\n2-3. the addition clears the input, restores the list, and survives repeated clears');
  const r = await throughRealPath(withAddition(GOOD_ADDITION));
  const k = Object.fromEntries((r.rec.play ? [] : []).concat([]));
  const passingSteps = r.rec.play ? r.rec.play.passing : [];
  say(passingSteps.includes(3), 'clicking #clear-filter restores the whole list');
  say(passingSteps.includes(4), 'and empties the filter input');
  say(passingSteps.includes(5), 'filtering still works afterwards');
  say(passingSteps.includes(6) && passingSteps.includes(7), 'a SECOND clear also works, and filtering still works after it');
  say(passingSteps.includes(1) && passingSteps.includes(2), 'the carried-forward checks still pass');
  say(r.retained === true, 'and the candidate is RETAINED');
  say(r.rec.outcome === 'ACCEPTED', `outcome ACCEPTED (${r.rec.outcome})`);
}

// ══ 4. a plausible button that does nothing is rejected ═════════════════════════════════════════
{
  console.log('\n4. a plausible button that does nothing is REJECTED');
  const r = await throughRealPath(withAddition(INERT_ADDITION));
  const passingSteps = r.rec.play ? r.rec.play.passing : [];
  say(passingSteps.includes(1) && passingSteps.includes(2), 'its carried-forward checks PASS - the page still filters');
  say(!passingSteps.includes(3), 'but clicking the button does NOT restore the list');
  say(r.retained === false, 'so it is NOT retained');
  say(r.rec.outcome === 'REJECTED', `outcome REJECTED (${r.rec.outcome})`);
  say(r.decision.functionallyAccepted === false, 'the functional gate is what rejected it');
}

// ══ 5. scoping: a legitimate new button must not break preservation ═════════════════════════════
{
  console.log('\n5. adding a legitimate button does not falsely break preservation');
  // The good candidate adds a visible "Clear" button. A preservation check over ALL visible text would
  // now differ from the baseline and fail. Scoped to the list's items, it passes - and the button is
  // genuinely there.
  const r = await throughRealPath(withAddition(GOOD_ADDITION));
  say(r.rec.acceptance && r.rec.acceptance.survivingWorkspaceVerdict.protected === 'PASS',
    'the protected set PASSES despite a new visible element');
  const ws = mkdtempSync(join(tmpdir(), 'vis-'));
  let dom;
  try {
    writeFileSync(join(ws, 'index.html'), withAddition(GOOD_ADDITION), 'utf8');
    const r2 = await playCheck(ws, { entry: 'index.html', stateExpr: 'null', contract: 'c', steps: [{ n: 1, name: 'load', do: [], expect: 'false' }] });
    dom = r2.cases[0].observed;
  } finally { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } }
  say(dom.visible.includes('Clear'), 'and the button really is visible on the page');
  say(ITEMS.every((i) => dom.visible.includes(i)), 'alongside every list item');
}

console.log(`\n  clear-filter integration: ${passed} passed, ${failed} failed -> ${failed ? 'THE NON-KEYBOARD PATH IS NOT ESTABLISHED' : 'the planner sites a button on an input-driven page, the addition clears and restores through repeated use, an inert button is rejected, and acceptance decides what survives'}`);
process.exit(failed ? 1 : 0);
