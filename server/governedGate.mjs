#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// governedGate.mjs — THE $0 GATE. Three hostile checks, through the REAL runner path.
//
//   node server/governedGate.mjs --authority-root ../ai-coding-hub-consolidation
//
// These are not unit tests of the authority stack; that suite exists and passes 243/243. This drives
// `promote()` - the same function the governed runner calls - so what is established is that the
// GOVERNED PATH functions, not that a governance layer sits beside one.
//
//   1. STALE BASE        the canonical file moves between prepare and commit
//                        -> refused as STALE, retryable, and NOTHING IS WRITTEN
//   2. EFFECT MISMATCH   the bytes land transformed
//                        -> effected but NOT verified, scope quarantined, never retained
//   3. SAME DECODING     the direct and governed arms record the identical locked profile
//                        -> read from two records actually written to disk, not asserted in code
//
// WHY THE HAPPY PATH CANNOT SUBSTITUTE: a run that succeeds exercises none of this. Every refusal
// branch in the governed path is unreached by a working candidate, which is precisely why the gate
// injects the conditions rather than waiting to observe them.
//
// A POSITIVE CONTROL RUNS FIRST. Without it, a `promote()` that refused everything would pass checks
// 1 and 2 and look like a triumph of governance.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promote } from './governedRun.mjs';
import { bindAuthority } from './authorityBinding.mjs';

const NL = String.fromCharCode(10);
const opt = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const ROOT = opt('authority-root', '../ai-coding-hub-consolidation');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const a = await bindAuthority({ root: ROOT });
const { PACKET } = a.modules['legasus/runtime/governedWorkspace/workspace.mjs'];
const { DISPOSITION, OUTCOME } = a.modules['legasus/runtime/epistemic-admission/governed-edit.mjs'];

const ENTRY = 'index.html';
const BASE = '<!DOCTYPE html><html><body><p id="a">one</p></body></html>' + NL;
const CANDIDATE = '<!DOCTYPE html><html><body><p id="a">two</p><button id="b">go</button></body></html>' + NL;
const VERDICT = { complete: true, covered: ['C', 'W', 'E1'], missing: [] };

/** A filesystem that turns every LF into CRLF on the way out - the autocrlf case, reproducible. */
const CRLF = { readBack: (p) => Buffer.from(readFileSync(p, 'utf8').replace(/\n/g, '\r\n'), 'utf8') };

function canonicalDir() {
  const d = mkdtempSync(join(tmpdir(), 'gate-'));
  writeFileSync(join(d, ENTRY), BASE, 'utf8');
  return d;
}

console.log(`GOVERNED GATE  authority ${a.identity.root}`);
console.log(`  commit ${String(a.identity.commit).slice(0, 12)} dirty=${a.identity.dirty} manifest ${a.identity.manifestDigest.slice(0, 16)}`);

// ══ POSITIVE CONTROL ══════════════════════════════════════════════════════════════════════════════
console.log(`${NL}0. positive control - the same path promotes a clean candidate`);
{
  const d = canonicalDir();
  try {
    const p = await promote({ canonical: d, entry: ENTRY, candidate: CANDIDATE, verdict: VERDICT });
    say(p.promoted === true, `a verified candidate is promoted${p.promoted ? '' : ` -> ${p.result && p.result.reason}`}`);
    say(readFileSync(join(d, ENTRY), 'utf8') === CANDIDATE, 'and the bytes on disk are the candidate');
    say(p.result.effect.effectVerified === true, 'with the effect read back and verified');
  } finally { rmSync(d, { recursive: true, force: true }); }
}

// ══ 1. STALE BASE ═════════════════════════════════════════════════════════════════════════════════
console.log(`${NL}1. stale base - the canonical file moves between prepare and commit`);
{
  const d = canonicalDir();
  const MOVED = '<!DOCTYPE html><html><body><p id="a">someone else was here</p></body></html>' + NL;
  try {
    const p = await promote({
      canonical: d, entry: ENTRY, candidate: CANDIDATE, verdict: VERDICT,
      hooks: { afterPrepare: () => { writeFileSync(join(d, ENTRY), MOVED, 'utf8'); } },
    });
    say(p.promoted === false, 'the promotion is refused');
    say(p.result.reason === OUTCOME.ACTION_DENIED_REVISION_MISMATCH || p.result.reason === PACKET.STALE_DEPENDENCY,
      `for staleness specifically: ${p.result.reason}`);
    say(p.result.disposition === DISPOSITION.STALE || p.result.retryable === true,
      'classified STALE / retryable - the world moved, the work was not wrong');
    say(p.result.effected === false, 'and NOTHING WAS WRITTEN');
    say(readFileSync(join(d, ENTRY), 'utf8') === MOVED,
      "the other writer's bytes are left exactly as found - refusing is not repairing");
  } finally { rmSync(d, { recursive: true, force: true }); }
}

// ══ 2. EFFECT MISMATCH ════════════════════════════════════════════════════════════════════════════
console.log(`${NL}2. effect mismatch - the bytes land transformed`);
{
  const d = canonicalDir();
  try {
    const p = await promote({ canonical: d, entry: ENTRY, candidate: CANDIDATE, verdict: VERDICT, deps: CRLF });
    say(p.promoted === false, 'it does NOT count as progress');
    say(p.result.effected === true, 'but the write DID happen - refusing it cannot undo it');
    say(p.result.reason === PACKET.EFFECT_UNVERIFIED, `recorded as ${p.result.reason}`);
    say(p.result.effect.permitted === true, 'and the AUTHORITY was valid: this is not a denial');
    say(p.result.effect.effectVerified === false
      && p.result.effect.intendedRevision !== p.result.effect.revisionAfter,
      'the effect is unverified, with both digests named');

    // NEVER RETAINED, AND NOTHING MAY BUILD ON IT.
    const events = p.ws.events();
    say(events.filter((e) => e.type === 'ACTION_COMMITTED').length === 0,
      'no ACTION_COMMITTED exists - nothing in the record claims the scope advanced');
    const second = await promote({ canonical: d, entry: ENTRY, candidate: CANDIDATE, verdict: VERDICT });
    say(second.promoted === false, 'a later promotion on the damaged scope is refused');
    say(second.result.reason === PACKET.SCOPE_UNVERIFIED || second.result.reason === OUTCOME.ACTION_DENIED_REVISION_MISMATCH,
      `and specifically because the scope is unusable: ${second.result.reason}`);
  } finally { rmSync(d, { recursive: true, force: true }); }
}

// ══ 3. SAME LOCKED DECODING IN BOTH ARMS ══════════════════════════════════════════════════════════
// Read from records actually written to disk by the two runners. Asserting it in code would only test
// that I wrote the same literal twice.
console.log(`${NL}3. both arms recorded the identical locked decoding profile`);
{
  const dir = 'legasus/records/timing';
  const recs = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8'))) : [];
  const direct = recs.filter((r) => r.arm === 'direct');
  const governed = recs.filter((r) => r.arm === 'governed');
  if (!direct.length || !governed.length) {
    say(false, `NOT CHECKED - need at least one record from each arm on disk (direct ${direct.length}, governed ${governed.length}). This is not a pass.`);
  } else {
    const sig = (r) => `${r.decodingProfile}|${r.decoding.temperature}|${r.decoding.num_predict}|${r.decoding.seed}`;
    const ds = [...new Set(direct.map(sig))];
    const gs = [...new Set(governed.map(sig))];
    say(ds.length === 1 && gs.length === 1 && ds[0] === gs[0],
      `identical across arms: direct ${ds.join(' / ')} vs governed ${gs.join(' / ')}`);
    say(recs.every((r) => Array.isArray(r.decodingOverridesRefused)),
      'and every record carries what the weld refused, in both arms');
    say(governed.every((r) => r.authority && r.authority.manifestDigest) && direct.every((r) => r.authority === null || r.authority === undefined),
      'the governed arm names its authority manifest; the direct arm records null - a stated fact, not a missing column');
  }
}

console.log(`${NL}  governed gate: ${passed} passed, ${failed} failed -> ${failed
  ? 'THE GOVERNED PATH DOES NOT ENFORCE WHAT IT CLAIMS'
  : 'stale refuses without writing, a mismatch is quarantined and never retained, and both arms ran under one locked profile'}`);
process.exit(failed ? 1 : 0);
