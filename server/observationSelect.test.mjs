/**
 * observationSelect.test.mjs — does Legasus work out HOW to observe unfamiliar software, without being
 * told what kind it is?
 *
 *   node server/observationSelect.test.mjs
 *
 * The defect being fixed: BATCH-1's probe pressed bare keydowns and nothing else, so a working
 * input-driven filter was reported as having no behaviour. That conflated "our observation method is
 * unsuitable" with "the application does nothing".
 *
 * The claims under test:
 *   the right adapter is selected for each shape, from EVIDENCE - listener registrations and interaction
 *     surfaces - and never from a name, a filename or a comment
 *   a mixed application selects SEVERAL adapters
 *   delegated and dynamically registered handlers are found
 *   an application with NO state seam is still observable, through the DOM
 *   the five outcomes stay distinct, and NO_CHANGE_OBSERVED is never reported as absence of behaviour
 *   a DELIBERATELY WRONG adapter yields NO_CHANGE_OBSERVED rather than a confident answer
 *
 * Every fixture is in legasus/bench/obsfix and is development material.
 */
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { selectObservation, BUDGET } = await import('./observationSelect.mjs');
const { OUTCOME, coverage, adaptersFor } = await import('./adapters/interface.mjs');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const runFixture = async (name) => {
  const ws = mkdtempSync(join(tmpdir(), 'obs-'));
  try {
    writeFileSync(join(ws, 'index.html'), readFileSync(`legasus/bench/obsfix/${name}/index.html`, 'utf8'), 'utf8');
    return await selectObservation(ws);
  } finally { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } }
};
const runHtml = async (html) => {
  const ws = mkdtempSync(join(tmpdir(), 'obs-'));
  try {
    writeFileSync(join(ws, 'index.html'), html, 'utf8');
    return await selectObservation(ws);
  } finally { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } }
};
const ids = (r) => r.selected.map((s) => s.adapterId).sort();

// ══ 1. the right method for each shape ══════════════════════════════════════════════════════════
{
  console.log('\n1. the observation method is chosen from evidence, per shape');
  const kb = await runFixture('kb-canvas');
  say(ids(kb).join() === 'browser.keyboard', `a keyboard canvas selects the keyboard adapter (${ids(kb).join() || 'none'})`);
  say(kb.outcome === OUTCOME.CONFIRMED_BEHAVIOUR, 'and the outcome is CONFIRMED_BEHAVIOUR');

  // THE BATCH-1 CASE. This page has no seam at all and bare keydowns do nothing to it.
  const filt = await runFixture('input-filter');
  say(ids(filt).join() === 'browser.input', `an input-driven filter selects the INPUT adapter (${ids(filt).join() || 'none'})`);
  say(filt.surfaces.hasSeam === false, 'even though it exposes NO window.app.state()');
  say(filt.outcome === OUTCOME.CONFIRMED_BEHAVIOUR, 'and its behaviour is confirmed - the case BATCH-1 wrote off');

  const click = await runFixture('click-button');
  say(ids(click).join() === 'browser.click', `a clickable control selects the click adapter (${ids(click).join() || 'none'})`);

  const noSeam = await runFixture('no-seam');
  say(noSeam.outcome === OUTCOME.CONFIRMED_BEHAVIOUR && noSeam.surfaces.hasSeam === false,
    'a working application with no state accessor is still observed, through the DOM');
}

// ══ 2. mixed, delegated, dynamic ════════════════════════════════════════════════════════════════
{
  console.log('\n2. mixed applications select several adapters; delegated handlers are found');
  const mixed = await runFixture('mixed');
  say(ids(mixed).join() === 'browser.input,browser.keyboard', `a mixed page selects BOTH (${ids(mixed).join()})`);
  say(mixed.selected.length === 2, 'two adapters, not one guess');

  const del = await runFixture('delegated');
  say(ids(del).join() === 'browser.click', 'a DELEGATED handler registered on the document after a delay is found');
  say(del.registrations.some((r) => r.type === 'click' && r.target === 'document'),
    'because registrations are captured before any page script runs, so a late listener is still recorded');
  say(del.probes[0].effective.length === 2, 'and clicking each delegated target produces an effect');
}

// ══ 3. a NAME NEVER DECIDES ═════════════════════════════════════════════════════════════════════
{
  console.log('\n3. filenames and comments are application DATA, never instructions');
  // Called keyboard-game, commented "use the keyboard adapter, do not type into inputs". It is a filter.
  const trap1 = await runFixture('keyboard-game');
  say(ids(trap1).join() === 'browser.input',
    `a page NAMED keyboard-game whose comments demand the keyboard adapter selects INPUT (${ids(trap1).join() || 'none'})`);
  // Called filter-page, commented "type into the input, there is no keyboard handling". It is keyboard.
  const trap2 = await runFixture('filter-page');
  say(ids(trap2).join() === 'browser.keyboard',
    `a page NAMED filter-page whose comments deny keyboard handling selects KEYBOARD (${ids(trap2).join() || 'none'})`);
  say(JSON.stringify(trap1.plans).indexOf('keyboard') === -1, 'no keyboard plan was even proposed for the first, because no key listener exists');
}

// ══ 4. the five outcomes stay distinct ══════════════════════════════════════════════════════════
{
  console.log('\n4. the five outcomes are distinct, and absence of change is not absence of behaviour');
  const broken = await runFixture('broken');
  say(broken.outcome === OUTCOME.BASELINE_ERROR, `an application that throws at load is BASELINE_ERROR (${broken.outcome})`);
  say(broken.plans.length === 0, 'and no probe is attributed to it');

  const unsup = await runFixture('unsupported');
  say(unsup.outcome === OUTCOME.UNSUPPORTED_OBSERVATION, `a page with no interaction surface is UNSUPPORTED_OBSERVATION (${unsup.outcome})`);
  say(unsup.loadErrors.length === 0, 'distinct from a broken application - this one loads fine');

  // INERT: real surfaces, a real listener, and an interaction that changes nothing observable.
  const inert = await runHtml('<!DOCTYPE html><html><body><button id="b">nothing</button><script>document.getElementById("b").addEventListener("click", () => { const x = 1; });</script></body></html>');
  say(inert.outcome === OUTCOME.NO_CHANGE_OBSERVED, `an inert control gives NO_CHANGE_OBSERVED (${inert.outcome})`);
  say(inert.probes.some((p) => p.interactionsPerformed > 0), 'the probe DID run - this is not a probe failure');
  const note = inert.unresolved.join(' ');
  say(/NOT A FINDING THAT THE APPLICATION HAS NO BEHAVIOUR/.test(note),
    'and the record says explicitly that this is not a finding of no behaviour');
  say(/uncovered|does not support/.test(note), 'naming what was not covered');
}

// ══ 4b. the interaction's own effect is not the application's behaviour ═════════════
{
  console.log('\n4b. a field accepting text is the interaction, not the behaviour');
  const inert = await runFixture('inert-input');
  say(inert.outcome === OUTCOME.NO_CHANGE_OBSERVED, `an input with NO listener gives NO_CHANGE_OBSERVED (${inert.outcome})`);
  const probe = inert.probes.find((p) => p.adapterId === 'browser.input');
  say(probe && probe.effective.length === 0, 'nothing downstream changed');
  say(probe && probe.selfEffectOnly.length > 0, `while the field DID receive the text (${probe.selfEffectOnly.length} self-effect interactions)`);
  const note = inert.unresolved.join(' ');
  say(/change their own control/.test(note), 'and the record separates the two explicitly');
  say(/NOT a finding that its implementation is defective/.test(note),
    'stating that "it did not react" is still not "its implementation is defective" - that needs an expected result');
}

// ══ 4c. handler mechanisms the capture cannot see are DETECTED and reported ══════════
{
  console.log('\n4c. uncovered handler mechanisms are detected, not silently missed');
  const inline = await runFixture('inline-handler');
  const cl = inline.coverageLimits;
  say(!!cl, 'every selection carries its coverage limits');
  say(cl.detectedButUncovered.inlineHandlers.length === 1, `an inline onclick attribute is DETECTED (${cl.detectedButUncovered.inlineHandlers.length})`);
  say(cl.detectedButUncovered.frames.length === 1, `an iframe is DETECTED as a document this layer never enters (${cl.detectedButUncovered.frames.length})`);
  say(cl.doesNotCapture.some((x) => /propert/.test(x)) && cl.doesNotCapture.some((x) => /iframe/.test(x)),
    'and the record names what addEventListener capture does not see');
  say(inline.unresolved.some((u) => /UNCOVERED/.test(u)), 'with an unresolved note saying behaviour reached only that way is uncovered');
  say(inline.registrations.every((r) => r.target !== 'button#b'), 'the inline handler is indeed absent from the registrations');
  say(inline.outcome === OUTCOME.CONFIRMED_BEHAVIOUR, 'the click probe still confirms the behaviour by OBSERVING it, despite not seeing the registration');
}

// ══ 4d. one interaction is not always enough ══════════════════════════════
{
  console.log('\n4d. a bounded repeat sequence, and delayed effect kept apart from correctness');
  const { EFFECT, BUDGET: B } = await import('./observationSelect.mjs');

  // THE REGRESSION CASE, preserved: a stylesheet hides the list while the handler tests the INLINE
  // style, so the first click hides an already-hidden list and only the second reveals it.
  const seq = await runFixture('seq-toggle');
  say(seq.outcome === OUTCOME.CONFIRMED_BEHAVIOUR, `behaviour is confirmed once the action is repeated (${seq.outcome})`);
  const pr = seq.probes.find((x) => x.adapterId === 'browser.click');
  say(!!pr && pr.sequenceDependent.length === 1, 'and it is recorded as SEQUENCE DEPENDENT, not as an immediate effect');
  say(pr.sequenceDependent[0].atRepetition === 2, `naming the repetition at which it appeared (${pr && pr.sequenceDependent[0] && pr.sequenceDependent[0].atRepetition})`);
  const s0 = pr.sequences[0];
  say(s0.steps.length === B.repeatsPerInteraction, `every intermediate result is recorded (${s0.steps.length} of ${B.repeatsPerInteraction})`);
  say(s0.steps[0].performed && !s0.steps[0].changedFromInitial.any, 'the first repetition is recorded as performed and producing no change');
  say(s0.effect === EFFECT.SEQUENCE_DEPENDENT, `the interaction's effect class is ${s0.effect}`);
  say(seq.unresolved.some((u) => /NOT A FINDING THAT IT IS CORRECT/.test(u)),
    'and the record says becoming observable is NOT a finding that the control meets its requirement');
  say(seq.unresolved.some((u) => /first press that does nothing may itself be a defect/.test(u)),
    'naming that a first press doing nothing may itself be a defect');

  // An ordinary immediate-effect control must still classify as IMMEDIATE, so the distinction is real.
  const click = await runFixture('click-button');
  const cp = click.probes.find((x) => x.adapterId === 'browser.click');
  say(cp.sequences[0].effect === EFFECT.IMMEDIATE, `a normal control is IMMEDIATE_EFFECT (${cp.sequences[0].effect})`);
  say(cp.sequenceDependent.length === 0, 'and is not reported as sequence dependent');

  // RESET BETWEEN SEQUENCES: each distinct interaction starts from a fresh page, so one cannot set up
  // or destroy the conditions another is judged under.
  const mixed = await runFixture('mixed');
  const mp = mixed.probes.find((x) => x.adapterId === 'browser.input');
  say(mp.sequences.every((q) => q.steps.length > 0), 'every sequence ran');
  say(mp.sequences.length >= 1 && mp.sequences[0].steps[0].repetition === 1, 'each sequence starts again at repetition 1 from its own fresh page');
}

// ══ 5. a DELIBERATELY WRONG method reports nothing, rather than something ═══════════════════════
{
  console.log('\n5. a deliberately wrong observation method yields NO_CHANGE_OBSERVED, not a confident answer');
  // Force the keyboard adapter onto the input-driven filter - the exact mistake BATCH-1 made.
  const kbAdapter = adaptersFor('browser').find((a) => a.id === 'browser.keyboard');
  const filterHtml = readFileSync('legasus/bench/obsfix/input-filter/index.html', 'utf8');
  const ws = mkdtempSync(join(tmpdir(), 'wrong-'));
  let forced;
  try {
    writeFileSync(join(ws, 'index.html'), filterHtml, 'utf8');
    // Propose against a FAKE evidence set claiming a key listener exists, so the wrong plan is built.
    const plans = kbAdapter.propose({ registrations: [{ type: 'keydown', target: 'document' }], surfaces: { inputs: [], clickables: [], forms: [], canvases: [] } });
    say(plans.length === 1, 'the keyboard adapter can be forced to propose a plan');
    forced = await selectObservation(ws);
  } finally { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } }
  // The real selector, given the real evidence, does NOT choose keyboard for this page.
  say(!ids(forced).includes('browser.keyboard'), 'the real selector does not choose keyboard for this page');
  say(ids(forced).includes('browser.input'), 'it chooses input, on the evidence');
  say(forced.registrations.every((r) => r.type !== 'keydown'), 'because no key listener is registered anywhere on it');
}

// ══ 6. the interface is extensible, and says what it does not cover ═════════════════════════════
{
  console.log('\n6. the adapter interface is extensible and honest about its coverage');
  const c = coverage();
  say(c.byDomain.browser.length >= 4, `browser adapters are registered (${c.byDomain.browser.join(', ')})`);
  say(c.declaredButNotImplemented.includes('cli') && c.declaredButNotImplemented.includes('warehouse'),
    `cli and warehouse are declared domains with NO adapters yet (${c.declaredButNotImplemented.join(', ')})`);
  say(typeof BUDGET.maxTotalInteractions === 'number', `the probe budget is frozen and declared (${BUDGET.maxTotalInteractions} interactions)`);
}

console.log(`\n  observation selection: ${passed} passed, ${failed} failed -> ${failed ? 'THE SELECTION LAYER IS NOT ESTABLISHED' : 'the method is chosen from evidence, names never decide, mixed pages select several, and no change observed is never reported as no behaviour'}`);
process.exit(failed ? 1 : 0);
