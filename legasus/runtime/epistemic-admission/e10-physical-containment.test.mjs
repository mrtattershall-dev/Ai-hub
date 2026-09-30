/**
 * e10-physical-containment.test.mjs - E10. THE PROPERTY, not the mechanism.
 *
 *   node legasus/runtime/epistemic-admission/e10-physical-containment.test.mjs
 *
 * THE PROPERTY UNDER TEST:
 *
 *     A governed effect must occur inside the PHYSICAL object denoted by the granted root.
 *
 * NOT "the path must not traverse upward". NOT "resolve() must stay inside". NOT "use realpath".
 * `resolve()` was a correct implementation of a property nobody needed, which is how B-COMP-1
 * (153c4d7f) escaped: the check and the effect agreed with each other and both were wrong about
 * where the bytes went.
 *
 * SO EVERY ARM JUDGES THE FILESYSTEM, never the decision. The question asked after each call is
 * always the same: are the bytes inside the physical root? An arm passes if the write was refused,
 * OR permitted with the bytes provably inside. It fails if bytes landed outside - whatever the
 * outcome code said.
 *
 * MULTIPLE INDEPENDENT REPRESENTATIONS. A fix validated on the one representation that motivated
 * it proves only that one. R1-R8 spell the same escape different ways.
 *
 * AND ANTI-OVER-REFUSAL ARMS. P2 in particular - a junction pointing INSIDE the root is a
 * legitimate arrangement, and a "fix" that refuses it has swapped a containment bug for a
 * functionality bug. This repo has a recorded instance of that trade.
 */
import { mkdtempSync, writeFileSync, readFileSync, existsSync, symlinkSync, mkdirSync, rmSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { governedEdit, editAction, EDIT_FIXTURE } from './governed-edit.mjs';
import { delegate } from '../../legaknow/calculus.mjs';

let passed = 0, failed = 0, skipped = 0;
const ok = (c, m) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${m}`); c ? passed++ : failed++; };
const skip = (m) => { console.log(`  SKIP  ${m}`); skipped++; };

const MARK = 'E10-WROTE-HERE';
const grantFor = (rel) => delegate({
  from: 'OWNER', grant: EDIT_FIXTURE.requires, to: 'controller',
  context: { repository: 'workspace', implementation: rel },
});

/** Try each reparse flavour; returns the kind that worked, or null. */
function link(target, path) {
  for (const k of ['junction', 'dir']) {
    try { symlinkSync(target, path, k); return k; } catch { /* next */ }
  }
  return null;
}
function fileLink(target, path) {
  try { symlinkSync(target, path, 'file'); return 'file'; } catch { return null; }
}

/**
 * THE JUDGEMENT. Ask the filesystem, not the outcome code.
 * @returns {{contained:boolean, why:string}}
 */
function judge(root, rel, externalWatch) {
  // Did the mark appear anywhere outside the physical root?
  for (const w of externalWatch) {
    if (existsSync(w) && readFileSync(w, 'utf8').includes(MARK)) {
      return { contained: false, why: `bytes landed OUTSIDE at ${w}` };
    }
  }
  // If it landed at all, its real path must be inside the real root.
  const t = resolve(root, rel);
  if (existsSync(t)) {
    try {
      const rp = realpathSync(t).toLowerCase();
      const rr = realpathSync(root).toLowerCase();
      if (readFileSync(t, 'utf8').includes(MARK) && !rp.startsWith(rr)) {
        return { contained: false, why: `bytes at ${rp}, outside real root ${rr}` };
      }
    } catch { /* unreadable - nothing landed there */ }
  }
  return { contained: true, why: 'no bytes outside the physical root' };
}

function attempt(root, rel) {
  try {
    return governedEdit({
      authority: grantFor(rel),
      action: editAction({ target: rel, contents: `${MARK}\n` }),
      root, contract: EDIT_FIXTURE,
    });
  } catch (e) { return { threw: e.message, permitted: false }; }
}

const dirs = [];
function ws() { const d = mkdtempSync(join(tmpdir(), 'e10-ws-')); dirs.push(d); return d; }
function ext() { const d = mkdtempSync(join(tmpdir(), 'e10-out-')); dirs.push(d); return d; }

console.log('E10 - governed effects must stay inside the PHYSICAL root');
console.log('');
console.log('ESCAPE ARMS - refused, or permitted with bytes provably inside');

// ── R1 directory junction to an external dir  (the B-COMP-1 demonstration) ─────────────────────
{
  const root = ws(); const out = ext();
  writeFileSync(join(out, 'victim.txt'), 'ORIGINAL\n', 'utf8');
  const kind = link(out, join(root, 'escape'));
  if (!kind) skip('R1 no reparse point could be created - NOT_EVALUATED');
  else {
    attempt(root, 'escape/victim.txt');
    const j = judge(root, 'escape/victim.txt', [join(out, 'victim.txt')]);
    ok(j.contained, `R1 ${kind} to an external dir: ${j.why}`);
  }
}

// ── R3 FILE symlink to an external file ────────────────────────────────────────────────────────
{
  const root = ws(); const out = ext();
  const victim = join(out, 'v.txt');
  writeFileSync(victim, 'ORIGINAL\n', 'utf8');
  const kind = fileLink(victim, join(root, 'alias.txt'));
  if (!kind) skip('R3 file symlink needs privilege - NOT_EVALUATED');
  else {
    attempt(root, 'alias.txt');
    const j = judge(root, 'alias.txt', [victim]);
    ok(j.contained, `R3 file symlink to an external file: ${j.why}`);
  }
}

// ── R4 NESTED: a/b is a junction ───────────────────────────────────────────────────────────────
{
  const root = ws(); const out = ext();
  writeFileSync(join(out, 'victim.txt'), 'ORIGINAL\n', 'utf8');
  mkdirSync(join(root, 'a'), { recursive: true });
  const kind = link(out, join(root, 'a', 'b'));
  if (!kind) skip('R4 nested reparse point could not be created - NOT_EVALUATED');
  else {
    attempt(root, 'a/b/victim.txt');
    const j = judge(root, 'a/b/victim.txt', [join(out, 'victim.txt')]);
    ok(j.contained, `R4 nested ${kind} at depth 2: ${j.why}`);
  }
}

// ── R5 junction created AFTER the grant, BEFORE the write (the narrowed, unclosed race) ────────
{
  const root = ws(); const out = ext();
  writeFileSync(join(out, 'victim.txt'), 'ORIGINAL\n', 'utf8');
  const g = grantFor('escape/victim.txt');           // grant minted FIRST
  const kind = link(out, join(root, 'escape'));      // reparse point appears AFTER
  if (!kind) skip('R5 could not create the reparse point - NOT_EVALUATED');
  else {
    try {
      governedEdit({ authority: g, action: editAction({ target: 'escape/victim.txt', contents: `${MARK}\n` }), root, contract: EDIT_FIXTURE });
    } catch { /* judged below */ }
    const j = judge(root, 'escape/victim.txt', [join(out, 'victim.txt')]);
    ok(j.contained, `R5 ${kind} created after the grant: ${j.why}`);
  }
}

// ── R7 extended-length prefix: a different lexical spelling of the same place ───────────────────
{
  const root = ws(); const out = ext();
  writeFileSync(join(out, 'victim.txt'), 'ORIGINAL\n', 'utf8');
  // Target given in \\?\ form. Lexically it is not a traversal and not relative.
  const weird = `\\\\?\\${join(out, 'victim.txt')}`;
  attempt(root, weird);
  const j = judge(root, 'nonexistent-probe', [join(out, 'victim.txt')]);
  ok(j.contained, `R7 extended-length prefix spelling: ${j.why}`);
}

// ── R8 junction to the root's own PARENT ───────────────────────────────────────────────────────
{
  const root = ws();
  const parent = resolve(root, '..');
  const sentinel = join(parent, `e10-sentinel-${Date.now()}.txt`);
  writeFileSync(sentinel, 'ORIGINAL\n', 'utf8');
  const kind = link(parent, join(root, 'up'));
  if (!kind) skip('R8 could not link to the parent - NOT_EVALUATED');
  else {
    const rel = `up/${sentinel.split(sep).pop()}`;
    attempt(root, rel);
    const j = judge(root, rel, [sentinel]);
    ok(j.contained, `R8 ${kind} to the root's parent: ${j.why}`);
  }
  try { rmSync(sentinel, { force: true }); } catch {}
}

console.log('');
console.log('ANTI-OVER-REFUSAL ARMS - must still be PERMITTED and land inside');

// ── P1 an ordinary in-root file ────────────────────────────────────────────────────────────────
{
  const root = ws();
  writeFileSync(join(root, 'f.txt'), 'before\n', 'utf8');
  const r = attempt(root, 'f.txt');
  const landed = readFileSync(join(root, 'f.txt'), 'utf8').includes(MARK);
  ok(!!r.permitted && landed, `P1 ordinary in-root write still permitted and landed (permitted=${!!r.permitted})`);
}

// ── P2 a junction whose target is INSIDE the root. THE arm that separates repair from refusal. ─
{
  const root = ws();
  mkdirSync(join(root, 'real'), { recursive: true });
  writeFileSync(join(root, 'real', 'g.txt'), 'before\n', 'utf8');
  const kind = link(join(root, 'real'), join(root, 'alias'));
  if (!kind) skip('P2 could not create an in-root reparse point - NOT_EVALUATED');
  else {
    const r = attempt(root, 'alias/g.txt');
    const landed = readFileSync(join(root, 'real', 'g.txt'), 'utf8').includes(MARK);
    ok(!!r.permitted && landed,
      `P2 in-root ${kind} STILL PERMITTED (permitted=${!!r.permitted}, landed=${landed})`
      + ' - refusing this would trade containment for functionality');
  }
}

// ── P3 a deep in-root path ─────────────────────────────────────────────────────────────────────
{
  const root = ws();
  mkdirSync(join(root, 'a', 'b', 'c'), { recursive: true });
  writeFileSync(join(root, 'a', 'b', 'c', 'd.txt'), 'before\n', 'utf8');
  const r = attempt(root, 'a/b/c/d.txt');
  ok(!!r.permitted && readFileSync(join(root, 'a/b/c/d.txt'), 'utf8').includes(MARK),
    `P3 deep in-root path permitted (permitted=${!!r.permitted})`);
}

// ── P4 creating a file that does not exist yet ─────────────────────────────────────────────────
{
  const root = ws();
  const r = attempt(root, 'brand-new.txt');
  const made = existsSync(join(root, 'brand-new.txt'))
    && readFileSync(join(root, 'brand-new.txt'), 'utf8').includes(MARK);
  ok(!!r.permitted && made, `P4 creating a new in-root file still works (permitted=${!!r.permitted})`);
}

for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch {} }
console.log('');
console.log(`  ${passed} passed, ${failed} failed, ${skipped} skipped(NOT_EVALUATED)`);
process.exit(failed ? 1 : 0);
