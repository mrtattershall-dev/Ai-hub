/**
 * protocol.test.mjs - the DETERMINISTIC PROTOCOL CONTROL for PROTOCOL-1.
 *
 *   node server/protocol.test.mjs
 *
 * Asserts the six properties mechanically, BEFORE any GPU is spent. The discipline that has
 * repeatedly paid today: qualify the apparatus deterministically, then measure the model.
 *
 *   1. once evidence at hash H is acquired, it cannot be re-requested until state changes
 *   2. mutation receives exact FRESH source, never recalled text
 *   3. a rejected/stale mutation transitions back to OBSERVE, never blind repetition
 *   4. verification happens automatically after a successful mutation
 *   5. the model cannot call tools outside the current responsibility phase
 *   6. progress state survives between model calls without the model remembering it
 *
 * The two monolithic pathologies (`outline_file` x6, a hallucinated FIND) are checked LAST,
 * and only as CONSEQUENCES of rules 1-6. If they had to be targeted directly the treatment
 * would be tuned to its own specimens and the experiment would prove nothing.
 */
import assert from 'node:assert/strict';
import { ProtocolController, PHASE, REFUSAL, hashOf } from './protocol.js';

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

/** An in-memory workspace: no disk, no git - this control is about the STATE MACHINE. */
function harness(files = { 'lib.js': 'function double(n) { return n * 2; }\n' }) {
  const fs = { ...files };
  const verifyCalls = [];
  const c = new ProtocolController({
    readFile: (p) => (p in fs ? fs[p] : null),
    applyEdit: ({ path, content }) => { fs[path] = content; return { ok: true }; },
    verify: ({ path }) => { verifyCalls.push(path); return { ok: !/throw new Error/.test(fs[path] || ''), detail: 'loads' }; },
    targets: Object.keys(files),
  });
  return { c, fs, verifyCalls };
}

// ── 1. evidence acquired at hash H cannot be re-requested while state is unchanged ──
{
  console.log('=== 1. no repeated evidence acquisition while state is unchanged ===');
  const { c } = harness();
  say(c.legalActions()[0].intent === 'observe', 'OBSERVE is offered when evidence is missing');
  c.observe(['lib.js']);
  c.decide('finish');                                     // park in a terminal phase
  const c2 = harness().c;
  c2.observe(['lib.js']);
  // Back at OBSERVE with unchanged state, `observe` must not even be OFFERED. The action does
  // not exist in this state - it is not refused after the fact.
  c2.phase = PHASE.OBSERVE;
  const acts = c2.legalActions();
  say(!acts.some((a) => a.intent === 'observe'), `observe is not offered for unchanged evidence (offered: ${JSON.stringify(acts.map((a) => a.intent))})`);
  say(acts.some((a) => a.intent === 'decide'), 'the controller advances to DECIDE instead');
}

// ── 2. mutation receives exact fresh source ──
{
  console.log('\n=== 2. mutation is handed exact fresh source, never recalled text ===');
  const { c, fs } = harness();
  c.observe(['lib.js']);
  const d = c.decide('modify', { path: 'lib.js' });
  say(d.ok && d.evidence.content === fs['lib.js'], 'DECIDE returns the exact current content');
  say(d.evidence.hash === hashOf(fs['lib.js']), 'and its hash');
  say(c.phase === PHASE.PRODUCE, 'then moves to PRODUCE');
  // There is no FIND parameter anywhere in the interface: produce() takes whole content.
  say(!('find' in (d.evidence || {})), 'the interface has no FIND snippet to hallucinate');
}

// ── 3. stale mutation goes back to OBSERVE, not blind repetition ──
{
  console.log('\n=== 3. stale mutation transitions to OBSERVE ===');
  const { c, fs } = harness();
  c.observe(['lib.js']);
  c.decide('modify', { path: 'lib.js' });
  fs['lib.js'] = 'function double(n) { return n * 2; }\n// changed underneath\n';   // moved under us
  const p = c.produce('whatever the model wrote\n');
  say(p.ok === false && p.refusal === REFUSAL.STALE_EVIDENCE, `stale artifact refused (${p.refusal})`);
  say(p.phase === PHASE.OBSERVE && p.transitioned === true, 'and the controller transitioned back to OBSERVE');
  say(!fs['lib.js'].includes('whatever the model wrote'), 'the stale artifact was NOT applied');
}

// ── 4. verification is automatic after a successful mutation ──
{
  console.log('\n=== 4. mutation creates a verification obligation automatically ===');
  const { c, verifyCalls } = harness();
  c.observe(['lib.js']);
  c.decide('modify', { path: 'lib.js' });
  const p = c.produce('function double(n) { return n * 2; }\nfunction halve(n) { return n / 2; }\n');
  say(p.ok && p.phase === PHASE.VERIFY, 'a successful mutation moves to VERIFY, unasked');
  say(c.obligations.length === 1, 'an obligation was created by the mutation, not by the model');
  const v = c.runVerification();
  say(v.ok && verifyCalls.includes('lib.js'), 'verification ran on the mutated file');
  say(c.obligations.length === 0, 'the obligation was discharged');
  say(c.phase === PHASE.OBSERVE, 'and the loop returned to OBSERVE');
}

// ── 5. phase-restricted tools ──
{
  console.log('\n=== 5. the model cannot act outside its current phase ===');
  const { c } = harness();
  say(c.decide('modify', { path: 'lib.js' }).refusal === REFUSAL.WRONG_PHASE, 'cannot DECIDE while in OBSERVE');
  say(c.produce('x').refusal === REFUSAL.WRONG_PHASE, 'cannot PRODUCE while in OBSERVE');
  c.observe(['lib.js']);
  say(c.observe(['lib.js']).refusal === REFUSAL.WRONG_PHASE, 'cannot OBSERVE again while in DECIDE');
  say(c.produce('x').refusal === REFUSAL.WRONG_PHASE, 'cannot PRODUCE while in DECIDE');
  c.decide('modify', { path: 'lib.js' });
  say(c.runVerification().refusal === REFUSAL.WRONG_PHASE, 'cannot force VERIFY while in PRODUCE');
  say(c.legalActions().length <= 2, `the action set stays small (${JSON.stringify(c.legalActions().map((a) => a.intent))})`);
}

// ── 6. progress state survives without the model carrying it ──
{
  console.log('\n=== 6. the controller holds progress state ===');
  const { c } = harness();
  c.observe(['lib.js']);
  const s1 = c.state();
  say(s1.observed.includes('lib.js') && !!s1.hashes['lib.js'], 'the controller records what was observed, and its hash');
  c.decide('modify', { path: 'lib.js' });
  c.produce('function double(n) { return n * 2; }\nfunction halve(n) { return n / 2; }\n');
  const s2 = c.state();
  say(!s2.observed.includes('lib.js'), 'evidence for a changed file is void BY DEFINITION, without being told');
  say(s2.pendingObligations === 1, 'the obligation is controller state, not model memory');
  say(c.log.some((e) => e.event === 'applied'), 'every transition is logged for audit');
}

// ── the two monolithic pathologies, as CONSEQUENCES of rules 1-6 ──
{
  console.log('\n=== the observed pathologies, now structurally unreachable ===');

  // `outline_file` x6: re-acquiring unchanged evidence.
  const { c } = harness();
  c.observe(['lib.js']);
  c.phase = PHASE.OBSERVE;
  let offered = 0;
  for (let i = 0; i < 6; i++) if (c.legalActions().some((a) => a.intent === 'observe')) offered++;
  say(offered === 0, `six attempts to re-observe unchanged state: offered ${offered} times (monolith allowed 6)`);

  // The hallucinated FIND: an edit keyed on recalled text that never existed.
  const h = harness({ 'consumer.js': "const { double } = require('./lib');\n" });
  h.c.observe(['consumer.js']);
  const d = h.c.decide('modify', { path: 'consumer.js' });
  say(typeof d.evidence.content === 'string' && d.evidence.content.length > 0,
    'PRODUCE is reached only with the exact file text in hand');
  // A model that "remembers" console.log('Hello World!') can still write nonsense - but it
  // cannot key an edit on text that is not there, because there is no FIND to key on.
  const p = h.c.produce("const { double } = require('./lib');\nconsole.log('Hello World!');\n");
  say(p.ok === true, 'its output is applied against fresh source, so there is no FIND to miss');
  say(h.fs['consumer.js'].includes("console.log('Hello World!')"), 'the change landed rather than being refused twice');

  // And a genuinely useless repetition still terminates mechanically rather than warning.
  const r = harness();
  r.c.observe(['lib.js']);
  r.c.decide('modify', { path: 'lib.js' });
  r.c.produce(r.fs['lib.js']);                                   // identical content = no progress
  say(r.c.phase === PHASE.OBSERVE, 'a no-progress mutation transitions rather than warning');
  r.c.observe(['lib.js']);
  const again = r.c.decide('modify', { path: 'lib.js' });
  say(again.ok === false && again.refusal === REFUSAL.EVIDENCE_UNCHANGED,
    'and the same intent against the same state is mechanically refused, not warned about');
}

console.log(`\n  protocol control: ${passed} passed, ${failed} failed -> ${failed ? 'DO NOT SPEND GPU' : 'protocol qualified deterministically'}`);
process.exit(failed ? 1 : 0);
