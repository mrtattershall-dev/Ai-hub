/**
 * secgate1.probe.mjs - SECGATE-1 reproduction probes A and B. READ-ONLY.
 *
 *   node server/secgate1.probe.mjs
 *
 * REPRODUCES, DOES NOT REPAIR. Per SECGATE-1_PREREG: freeze the proposition, reproduce it against
 * the implicated implementation, preserve the counterexample, change nothing. This file imports
 * approvalPolicy and reimplements NOTHING; if it disagrees with the shipped code, the shipped code
 * is right and this probe is wrong.
 *
 * EVERY PROBE CARRIES A NEGATIVE CONTROL. A probe that reports "bypassed" because it never reached
 * the guard is the recorded cmd-/c failure mode that already produced one false safety claim here.
 * The controls below show the guard WORKING on a case it should catch, in the same call, so a
 * bypass claim cannot be an apparatus artifact.
 */
import { mkdtempSync, writeFileSync, symlinkSync, existsSync, readFileSync, mkdirSync, rmSync, realpathSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { classifyCommand } from './approvalPolicy.js';

const out = [];
const say = (s) => { console.log(s); out.push(s); };

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// A — does strict mode permit a mutating command?
// ═══════════════════════════════════════════════════════════════════════════════════════════════
say('=== A: strict mode, mutating command ===');
const A_CASES = [
  ['find . -delete',                      'THE CLAIM: mutating, head is on the inspection allowlist'],
  ['find . -name "*.js" -delete',         'same, with an intervening predicate'],
  ['find . -type f -exec rm {} ;',        'mutation via -exec rather than -delete'],
  ['find . -name "*.js"',                 'NEGATIVE CONTROL: genuinely read-only find'],
  ['rm -rf .',                            'NEGATIVE CONTROL: guard MUST catch this'],
  ['node evil.js',                        'NEGATIVE CONTROL: strict MUST ask for an executor'],
];
const aRows = [];
for (const [cmd, note] of A_CASES) {
  const r = classifyCommand(cmd, 'strict');
  aRows.push({ cmd, decision: r.decision, reason: r.reason, note });
  say(`  ${String(r.decision).toUpperCase().padEnd(5)}  ${cmd.padEnd(34)}  ${note}`);
  say(`         reason: ${r.reason}`);
}
const aClaim = aRows.filter((r) => /-delete|-exec/.test(r.cmd) && r.decision === 'allow');
const aCtrlWorks = aRows.find((r) => r.cmd === 'rm -rf .')?.decision !== 'allow'
  && aRows.find((r) => r.cmd === 'node evil.js')?.decision !== 'allow';
say('');
say(`  negative controls behaved (guard is reachable and does refuse): ${aCtrlWorks}`);
say(`  A VERDICT: ${aClaim.length && aCtrlWorks ? 'REPRODUCED' : aClaim.length ? 'REPRODUCED but controls suspect' : 'NOT_REPRODUCED'}`
  + ` - ${aClaim.length} of 3 mutating find-forms auto-allowed under strict`);

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// B — does a symlink let a write escape the workspace?
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// safePath is module-private and binds WORKSPACE at import, so it cannot be imported directly.
// Its logic is reproduced here VERBATIM from agent.js:641-648 and that is stated plainly: this
// arm establishes the LEXICAL claim (B1) about that algorithm, not about the live binding.
say('');
say('=== B: symlink escape ===');
const root = mkdtempSync(join(tmpdir(), 'secgate-ws-'));
const outside = mkdtempSync(join(tmpdir(), 'secgate-outside-'));
const WORKSPACE = root;

/** VERBATIM from server/agent.js:641 - resolve() only, no realpathSync. Not re-designed. */
function safePath_asShipped(p) {
  const full = resolve(WORKSPACE, p || '.');
  const base = resolve(WORKSPACE);
  const norm = (s) => (process.platform === 'win32' ? s.toLowerCase() : s);
  const okRoot = norm(full) === norm(base) || norm(full).startsWith(norm(base + sep));
  if (!okRoot) throw new Error(`Path escapes workspace: ${p}`);
  return full;
}

writeFileSync(join(outside, 'victim.txt'), 'ORIGINAL - must not change\n', 'utf8');
// Windows refuses a 'dir' symlink without privilege or Developer Mode (EPERM). A JUNCTION is the
// same class of reparse point, needs no privilege, and resolve() does not follow it either - so
// the code path under test is reachable without elevating anything. Tried in order, and WHICH
// kind succeeded is recorded, because the two are not identical and the claim must say which.
let linkMade = false; let linkErr = null; let linkKind = null;
for (const kind of ['dir', 'junction']) {
  try { symlinkSync(outside, join(root, 'escape'), kind); linkMade = true; linkKind = kind; break; }
  catch (e) { linkErr = `${kind}: ${e.message}`; }
}

say(`  reparse point created inside workspace -> outside: ${linkMade}`
  + (linkMade ? `  (kind: ${linkKind})` : `  (${linkErr})`));

if (!linkMade) {
  say('  B VERDICT: NOT_EVALUATED - could not create a symlink (Windows needs privilege or dev mode).');
  say('             An apparatus that cannot reach the code is NOT evidence the code is sound.');
} else {
  // B1 - does the guard accept it?
  let b1 = null; let b1err = null;
  try { b1 = safePath_asShipped('escape/victim.txt'); } catch (e) { b1err = e.message; }
  say(`  B1 safePath('escape/victim.txt') -> ${b1 ? 'ACCEPTED: ' + b1 : 'THREW: ' + b1err}`);

  // B2 - do bytes actually land outside?
  let b2 = false;
  if (b1) {
    writeFileSync(b1, 'OVERWRITTEN THROUGH THE SYMLINK\n', 'utf8');
    const after = readFileSync(join(outside, 'victim.txt'), 'utf8');
    b2 = /OVERWRITTEN/.test(after);
    say(`  B2 external file content now: ${JSON.stringify(after.trim())}`);
    say(`     real path written: ${realpathSync(b1)}`);
    say(`     is that inside the workspace? ${realpathSync(b1).toLowerCase().startsWith(realpathSync(root).toLowerCase())}`);
  }

  // NEGATIVE CONTROL - the guard must still catch ordinary traversal, or it proves nothing.
  let ctrl = 'did not throw';
  try { safePath_asShipped('../victim.txt'); } catch { ctrl = 'threw as it should'; }
  say(`  NEGATIVE CONTROL  safePath('../victim.txt') -> ${ctrl}`);

  say('');
  say(`  B VERDICT: ${b2 ? 'REPRODUCED (B1 and B2)' : b1 ? 'WEAKER_THAN_CLAIMED (B1 only - guard bypassed, effect contained)' : 'NOT_REPRODUCED'}`);
}

// ── preserve the counterexample ────────────────────────────────────────────────────────────────
const dir = process.env.SECGATE_OUT || join(tmpdir(), 'SECGATE-1-counterexamples');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'A-strict-mutation.json'), JSON.stringify({
  proposition: "classifyCommand('find . -delete', 'strict') is not ask and not deny",
  mode: 'strict', rows: aRows, negativeControlsBehaved: aCtrlWorks,
  mechanism: 'classifySegment checks INSPECT.has(head) and returns allow BEFORE the mode===strict gate; the allowlist matches the HEAD only and no rule inspects arguments',
  at: new Date().toISOString(),
}, null, 2));
writeFileSync(join(dir, 'B-symlink-escape.json'), JSON.stringify({
  proposition: 'a symlink inside the workspace pointing outside is accepted by safePath and a write lands externally',
  reparsePointCreated: linkMade, reparseKind: linkKind, lastError: linkErr,
  note: 'safePath reproduced verbatim from agent.js:641 - resolve() only, no realpathSync. Lexical claim.',
  at: new Date().toISOString(),
}, null, 2));
say('');
say(`counterexamples preserved under ${dir}`);
say('NOTHING WAS REPAIRED. No implicated module was edited.');
try { rmSync(root, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); } catch {}
