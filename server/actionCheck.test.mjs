/**
 * actionCheck.test.mjs — can the CHECK harness verify input-driven and click-driven behaviour?
 *
 *   node server/actionCheck.test.mjs
 *
 * Until now the harness executed key presses only, so the observation layer could confirm behaviour it
 * could never test. These check the three things that had to become true:
 *
 *   the same structured actions the prober uses can be CHECKED - type into a selected input, click a
 *     named element - with expectations stated over the DOM a user actually sees
 *   ACTUAL filtering is verified against an INDEPENDENTLY SPECIFIED expected result, so "the filter is
 *     defective" is established by expected-versus-observed and never by the presence of a listener
 *   an UNSUPPORTED action ERRORS. It must never run zero interactions and score a pass.
 *
 * And the distinction that makes DOM checking honest: typing changes an input's own value whether or not
 * the application reacts. The interaction's own effect is kept apart from the downstream result.
 */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { playCheck } = await import('./playCheck.js');
const { isSupported, describe: describeAction, NOT_SUPPORTED } = await import('./actions.mjs');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const run = async (html, steps, extra = {}) => {
  const ws = mkdtempSync(join(tmpdir(), 'actchk-'));
  try {
    writeFileSync(join(ws, 'index.html'), html, 'utf8');
    return await playCheck(ws, { entry: 'index.html', stateExpr: 'null', contract: 'c', steps, ...extra });
  } finally { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } }
};
const kinds = (r) => Object.fromEntries((r.cases || []).map((c) => [c.n, c.kind]));

const LIST = ['alpha', 'beta', 'gamma'];
const shell = (script) => `<!DOCTYPE html><html><body>
<input type="text" id="filter">
<ul id="list">${LIST.map((x) => `<li>${x}</li>`).join('')}</ul>
<script>${script}</script></body></html>`;

// A filter that WORKS: hides the non-matching.
const WORKING = shell(`
const i = document.getElementById('filter');
const items = Array.from(document.querySelectorAll('#list li'));
i.addEventListener('input', () => {
  const q = i.value.toLowerCase();
  items.forEach((li) => { li.style.display = li.textContent.toLowerCase().includes(q) ? '' : 'none'; });
});`);

// A filter that is DEFECTIVE in exactly the way BATCH-1's b3 was: it computes the matching items and
// then does nothing that hides the others.
const DEFECTIVE = shell(`
const i = document.getElementById('filter');
const items = Array.from(document.querySelectorAll('#list li'));
i.addEventListener('input', () => {
  const q = i.value.toLowerCase();
  const matching = items.filter((li) => li.textContent.toLowerCase().includes(q));
  matching.forEach((li) => { if (li.style.display === 'none') li.style.display = 'none'; });
});`);

// ══ 1. a working filter is verified THROUGH THE DOM ═════════════════════════════════════════════
{
  console.log('\n1. typing into a selected input is performed, and the visible list is checked');
  const steps = [
    { n: 1, name: 'all three are visible at load', do: [], expect: `JSON.stringify(dom.visible.filter((t) => ${JSON.stringify(LIST)}.includes(t))) === ${JSON.stringify(JSON.stringify(LIST))}` },
    { n: 2, name: 'typing "al" leaves only alpha', do: [{ kind: 'type', selector: '#filter', text: 'al' }], expect: `JSON.stringify(dom.visible.filter((t) => ${JSON.stringify(LIST)}.includes(t))) === '["alpha"]'` },
    { n: 3, name: 'the typed text is in the input itself', do: [], expect: `dom.inputValues['#filter'] === 'al'` },
  ];
  const r = await run(WORKING, steps);
  const k = kinds(r);
  say(k[1] === 'PASS', 'the load state is checked from the DOM');
  say(k[2] === 'PASS', 'typing into #filter actually filters, and the check sees it');
  say(k[3] === 'PASS', 'and the input value is readable, separately from the list');
}

// ══ 2. a DEFECTIVE filter is established by expected-versus-observed ════════════════════════════
{
  console.log('\n2. a defective filter is established by the expected result, not by a listener');
  const steps = [
    { n: 1, name: 'typing "al" should leave only alpha', do: [{ kind: 'type', selector: '#filter', text: 'al' }], expect: `JSON.stringify(dom.visible.filter((t) => ${JSON.stringify(LIST)}.includes(t))) === '["alpha"]'` },
  ];
  const r = await run(DEFECTIVE, steps);
  say(kinds(r)[1] === 'FAIL', 'the check FAILS on the defective filter');
  const c = (r.cases || [])[0];
  say(!!c.observed && Array.isArray(c.observed.visible), 'and the record carries what was ACTUALLY on screen');
  say(c.observed.visible.filter((t) => LIST.includes(t)).length === 3, `all three items were still visible (${JSON.stringify(c.observed.visible.filter((t) => LIST.includes(t)))})`);
  say(c.observed.inputValues['#filter'] === 'al', 'while the input DID receive the text - so the interaction happened and the application did not react');
  say(/expected/.test(c.text) && /visible/.test(c.text), 'the failure text states the expectation and the observation');
}

// ══ 3. a LEGITIMATE no-change case is a PASS, not a defect ══════════════════════════════════════
{
  console.log('\n3. a legitimate no-change case passes');
  // Typing a string every item contains SHOULD leave the list unchanged. A checker that treated "the
  // DOM did not change" as failure would condemn correct behaviour.
  const steps = [
    { n: 1, name: 'typing "a" matches every item, so all stay visible', do: [{ kind: 'type', selector: '#filter', text: 'a' }], expect: `JSON.stringify(dom.visible.filter((t) => ${JSON.stringify(LIST)}.includes(t))) === ${JSON.stringify(JSON.stringify(LIST))}` },
  ];
  const r = await run(WORKING, steps);
  say(kinds(r)[1] === 'PASS', 'no change is the CORRECT result here, and it passes');
}

// ══ 4. clicking, and a control that fails to do its job ═════════════════════════════════════════
{
  console.log('\n4. clicks are performed, and a failing control is caught');
  const good = `<!DOCTYPE html><html><body><button id="go">go</button><p id="out">idle</p>
<script>document.getElementById('go').addEventListener('click', () => { document.getElementById('out').textContent = 'done'; });</script></body></html>`;
  const inert = `<!DOCTYPE html><html><body><button id="go">go</button><p id="out">idle</p>
<script>document.getElementById('go').addEventListener('click', () => { const x = 1; });</script></body></html>`;
  const steps = [{ n: 1, name: 'clicking #go shows done', do: [{ kind: 'click', selector: '#go' }], expect: `dom.visible.includes('done')` }];
  say(kinds(await run(good, steps))[1] === 'PASS', 'a working button passes');
  const bad = await run(inert, steps);
  say(kinds(bad)[1] === 'FAIL', 'a button whose handler does nothing FAILS');
  say((bad.cases[0].observed.visible || []).includes('idle'), 'and the record shows the page still reads "idle"');
}

// ══ 5. an UNSUPPORTED action ERRORS - it never becomes a pass ═══════════════════════════════════
{
  console.log('\n5. an unsupported action blocks rather than being skipped');
  const steps = [
    { n: 1, name: 'a drag, which this harness cannot do', do: [{ kind: 'drag', from: '#a', to: '#b' }], expect: 'true' },
    { n: 2, name: 'an ambiguous type with no selector', do: [{ type: 'hello' }], expect: 'true' },
  ];
  const r = await run(WORKING, steps);
  const k = kinds(r);
  say(k[1] === 'ERROR', `an unsupported action kind is an ERROR, not a PASS (${k[1]})`);
  say(k[2] === 'ERROR', `and so is a type with no selector, which is ambiguous (${k[2]})`);
  say(r.cases.every((c) => c.kind !== 'PASS'), 'crucially NEITHER passed, even though the expectation was literally `true`');
  say(r.cases.some((c) => c.unsupportedAction === true), 'the case is flagged as an unsupported action');
  say(/NOT a pass/.test(r.cases[0].text), 'and says so in words');
  say([...(r.passing || [])].length === 0, 'so nothing from this spec counts as passing');
}

// ══ 6. the vocabulary is shared and its limits are declared ═════════════════════════════════════
{
  console.log('\n6. the action vocabulary is shared with the prober and declares what it cannot do');
  say(isSupported({ kind: 'type', selector: '#a', text: 'x' }) && isSupported({ kind: 'click', selector: '#a' }) && isSupported({ key: 'a' }),
    'type, click and key are supported, including the older key shorthand');
  say(!isSupported({ kind: 'drag' }) && !isSupported({ type: 'x' }), 'drag and a selector-less type are not');
  say(NOT_SUPPORTED.includes('drag') && NOT_SUPPORTED.includes('scroll') && NOT_SUPPORTED.includes('file-upload'),
    `the unsupported kinds are named rather than left implicit (${NOT_SUPPORTED.slice(0, 4).join(', ')}...)`);
  say(describeAction({ kind: 'type', selector: '#filter', text: 'al' }) === 'type "al" into #filter', 'actions describe themselves for the record');
}

console.log(`\n  action checks: ${passed} passed, ${failed} failed -> ${failed ? 'THE CHECK HARNESS IS NOT ESTABLISHED' : 'input and click behaviour is verified through the DOM against independently specified results, legitimate no-change passes, and an unsupported action blocks'}`);
process.exit(failed ? 1 : 0);
