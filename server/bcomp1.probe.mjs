/**
 * bcomp1.probe.mjs - B-COMP-1. Does the ACTUAL governed effect path escape the root?
 *
 *   node server/bcomp1.probe.mjs
 *
 * Drives the REAL governedEdit with a REAL minted authority. governedEdit takes `root` as a
 * parameter, which is what makes composition testable here where SECGATE-1's B could only
 * reproduce safePath's algorithm verbatim.
 *
 * THREE ARMS, one dependent variable: do bytes land outside the declared root?
 *   1 POSITIVE CONTROL  ordinary in-workspace target  -> MUST land
 *   2 LEXICAL NEGATIVE  '../outside.txt'              -> MUST refuse
 *   3 REPARSE ATTACK    through a junction            -> the question
 *
 * NO REPAIR.
 */
import { mkdtempSync, writeFileSync, readFileSync, existsSync, symlinkSync, mkdirSync, rmSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { governedEdit, editAction, EDIT_FIXTURE } from '../legasus/runtime/epistemic-admission/governed-edit.mjs';
import { delegate } from '../legasus/legaknow/calculus.mjs';

const out = [];
const say = (s) => { console.log(s); out.push(s); };

const root = mkdtempSync(join(tmpdir(), 'bcomp-ws-'));
const outside = mkdtempSync(join(tmpdir(), 'bcomp-outside-'));

writeFileSync(join(root, 'ordinary.js'), 'module.exports = { v: 1 };\n', 'utf8');
writeFileSync(join(outside, 'victim.txt'), 'ORIGINAL - must not change\n', 'utf8');
writeFileSync(join(outside, 'outside.txt'), 'ORIGINAL - must not change\n', 'utf8');

let kind = null; let linkErr = null;
for (const k of ['dir', 'junction']) {
  try { symlinkSync(outside, join(root, 'escape'), k); kind = k; break; }
  catch (e) { linkErr = `${k}: ${e.message}`; }
}
say(`root    : ${root}`);
say(`outside : ${outside}`);
say(`reparse : ${kind || 'FAILED - ' + linkErr}  (workspace/escape -> outside)`);
say('');

/** Real NORMATIVE grant pinning exactly the path the action will request. */
const grantFor = (rel) => delegate({
  from: 'OWNER', grant: EDIT_FIXTURE.requires, to: 'controller',
  context: { repository: 'workspace', implementation: rel },
});

const MARK = 'WRITTEN-BY-B-COMP-1';
const rows = [];

function arm(n, label, rel, watch) {
  const g = grantFor(rel);
  const minted = g && g.minted !== false;
  const before = existsSync(watch) ? readFileSync(watch, 'utf8') : '(absent)';
  let r = null; let threw = null;
  try {
    r = governedEdit({
      authority: g,
      action: editAction({ target: rel, contents: `${MARK} ${n}\n` }),
      root, contract: EDIT_FIXTURE,      // production shape; real filesystem read-back
    });
  } catch (e) { threw = e.message; }
  const after = existsSync(watch) ? readFileSync(watch, 'utf8') : '(absent)';
  const landedThere = after.includes(MARK);
  rows.push({ arm: n, label, target: rel, grantMinted: minted,
    permitted: !!(r && r.permitted), effected: !!(r && r.effected),
    outcome: r && r.outcome, why: r && r.why, threw, watch, landedThere });
  say(`ARM ${n}  ${label}`);
  say(`   target=${JSON.stringify(rel)}  grantMinted=${minted}`);
  if (threw) say(`   THREW: ${threw}`);
  else say(`   permitted=${!!r.permitted}  effected=${!!r.effected}  outcome=${r.outcome}`);
  if (r && r.why) say(`   why: ${String(r.why).slice(0, 140)}`);
  say(`   watched file (${watch}) now carries the mark: ${landedThere}`);
  return { permitted: !!(r && r.permitted), landedThere, outcome: r && r.outcome };
}

// ── ARM 1  POSITIVE CONTROL ────────────────────────────────────────────────────────────────────
const a1 = arm(1, 'POSITIVE CONTROL - ordinary in-workspace target (MUST land)',
  'ordinary.js', join(root, 'ordinary.js'));
say('');

// ── ARM 2  LEXICAL NEGATIVE ────────────────────────────────────────────────────────────────────
const a2 = arm(2, 'LEXICAL NEGATIVE - traversing path (MUST refuse)',
  '../outside.txt', join(outside, 'outside.txt'));
say('');

// ── ARM 3  REPARSE ATTACK ──────────────────────────────────────────────────────────────────────
let a3 = null;
if (!kind) {
  say('ARM 3  NOT_EVALUATED - no reparse point could be created.');
} else {
  a3 = arm(3, 'REPARSE ATTACK - lexically inside, resolves outside (THE QUESTION)',
    'escape/victim.txt', join(outside, 'victim.txt'));
  const target = resolve(root, 'escape/victim.txt');
  if (existsSync(target)) {
    say(`   realpath of the target: ${realpathSync(target)}`);
    say(`   inside the declared root? ${realpathSync(target).toLowerCase().startsWith(realpathSync(root).toLowerCase())}`);
  }
}

// ── verdict ────────────────────────────────────────────────────────────────────────────────────
say('');
say('=== B-COMP-1 VERDICT ===');
const apparatusOk = a1.permitted && a1.landedThere && !a2.permitted && !a2.landedThere;
say(`  arm 1 landed inside      : ${a1.permitted && a1.landedThere}`);
say(`  arm 2 refused            : ${!a2.permitted && !a2.landedThere}  (${a2.outcome})`);
say(`  apparatus discriminates  : ${apparatusOk}`);
let verdict;
if (!kind || !apparatusOk) verdict = 'NOT_EVALUATED';
else if (a3.landedThere) verdict = 'ESCAPED';
else verdict = 'CONTAINED';
say('');
if (verdict === 'ESCAPED') {
  say('  ESCAPED - the governed effect path placed bytes OUTSIDE the declared root through an');
  say('  authorized, lexically-inside target. B upgrades from "containment algorithm unsound" to');
  say('  GOVERNED EFFECT CONTAINMENT VIOLATED IN COMPOSITION.');
} else if (verdict === 'CONTAINED') {
  say(`  CONTAINED - arm 3 did not place bytes outside (outcome ${a3 && a3.outcome}).`);
  say('  This BOUNDS SECGATE-1 B rather than escalating it. B\'s algorithm-level finding STANDS');
  say('  exactly as written; what is now known is that it does not compose through this path.');
} else {
  say('  NOT_EVALUATED - the apparatus did not discriminate, so arm 3 says nothing either way.');
}

const dir = process.env.SECGATE_OUT || join(tmpdir(), 'SECGATE-1-counterexamples');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'B-COMP-1.json'), JSON.stringify({
  proposition: 'a governed write authorized for a lexically-inside path whose component is a junction produces bytes OUTSIDE the declared root',
  reparseKind: kind, reparseError: linkErr,
  arms: rows, apparatusDiscriminates: apparatusOk, verdict,
  drove: 'the real governedEdit with root as a parameter, real delegate() authority, EDIT_FIXTURE, real filesystem read-back',
  at: new Date().toISOString(),
}, null, 2));
say('');
say(`preserved under ${dir}`);
say('NOTHING WAS REPAIRED.');
try { rmSync(root, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); } catch {}
