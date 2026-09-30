/**
 * secgate1c.probe.mjs - SECGATE-1 finding C. READ-ONLY. Reproduces, does not repair.
 *
 *   node server/secgate1c.probe.mjs
 *
 * THE PROPOSITION, per SECGATE-1_PREREG and deliberately NOT A-5's:
 *
 *     Can evidence whose actual SUBJECT is object X satisfy the authorization requirement for an
 *     effect on an unrelated object Y?
 *
 * A-5 already occupies "a witness with the expected NAME authorizes something". Re-running that
 * proves nothing new. The dangerous shape here is REFERENTIAL SUBSTITUTION:
 *
 *     evidence establishes P(X) -> matching machinery loses X -> authority treats it as P(Y)
 *     -> effect on Y admitted
 *
 * THREE CLAIMS, KEPT APART, because they are different findings with different severity:
 *
 *   C1  under a contract that DECLARES evidence obligations, does X-evidence authorize an effect
 *       on Y?                                        <- tests whether the guard binds the referent
 *   C2  does the PRODUCTION contract require evidence at all?
 *                                                    <- tests whether the guard is ENGAGED
 *   C3  the strong negative control: identical request, but with the characteristic that causes
 *       X's evidence to be selected REMOVED. If authorization disappears, the mismatched evidence
 *       was load-bearing rather than ambient permission.
 *
 * Evidence here is MINTED THROUGH THE REAL CONSTRUCTOR, never faked. A hand-built object would
 * fail isAuthority() and every arm would "pass" for the wrong reason.
 */
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { governedEdit, editAction, EDIT_FIXTURE, EDIT_FIXTURE_EVIDENCED, revisionOf } from '../legasus/runtime/epistemic-admission/governed-edit.mjs';
import { observe, delegate } from '../legasus/legaknow/calculus.mjs';
import { observation, OBSERVABILITY } from '../legasus/legaknow/observation.mjs';

const out = [];
const say = (s) => { console.log(s); out.push(s); };

const root = mkdtempSync(join(tmpdir(), 'secgate-c-'));
writeFileSync(join(root, 'X.js'), 'module.exports = { x: 1 };\n', 'utf8');
writeFileSync(join(root, 'Y.js'), 'module.exports = { y: 1 };\n', 'utf8');

/** A real EPISTEMIC token whose context names `subjectPath`. */
function evidenceAbout(subjectPath) {
  const abs = join(root, subjectPath);
  // PROVENANCE_FIELDS = subject, producer, procedure, attribution, context - all five, or
  // evidenceFrom returns PROVENANCE_INCOMPLETE and nothing mints. My first attempt omitted them
  // and every arm "passed" for the wrong reason.
  const ctx = { repository: 'workspace', implementation: subjectPath, revision: revisionOf(abs) };
  const obs = observation({
    status: OBSERVABILITY.OBSERVED,
    value: revisionOf(abs),
    subject: 'observed:target',
    producer: 'secgate1c',
    procedure: 'read the file and hash it',
    attribution: subjectPath,
    context: ctx,
  });
  return observe({ observation: obs, procedure: 'read the file and hash it', context: ctx });
}

/** A real NORMATIVE grant pinning `targetPath`. */
const grantFor = (targetPath) => delegate({
  from: 'OWNER', grant: EDIT_FIXTURE.requires, to: 'controller',
  context: { repository: 'workspace', implementation: targetPath },
});

const evX = evidenceAbout('X.js');
const evY = evidenceAbout('Y.js');
say(`evidence minted through observe(): X.js ${evX && evX.minted !== false ? 'OK' : 'FAILED: ' + (evX && evX.why)}`);
say(`                                   Y.js ${evY && evY.minted !== false ? 'OK' : 'FAILED'}`);
const gY = grantFor('Y.js');
say(`grant minted through delegate(): Y.js ${gY && gY.minted !== false ? 'OK' : 'FAILED: ' + (gY && gY.why)}`);
say('');

const bodyOf = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : '(absent)');
const rows = [];
function arm(label, { contract, evidence, authority = gY }) {
  writeFileSync(join(root, 'Y.js'), 'module.exports = { y: 1 };\n', 'utf8');   // reset between arms
  const r = governedEdit({
    authority,
    action: editAction({ target: 'Y.js', contents: 'module.exports = { y: 2 };\n', evidence }),
    root, contract,
  });
  const landed = /y: 2/.test(bodyOf('Y.js'));
  rows.push({ label, outcome: r.outcome, permitted: !!r.permitted, landed, why: r.why });
  say(`  ${label}`);
  say(`     permitted=${!!r.permitted}  bytesLanded=${landed}  outcome=${r.outcome || '(none)'}`);
  if (r.why) say(`     why: ${String(r.why).slice(0, 150)}`);
  return { permitted: !!r.permitted, landed, outcome: r.outcome };
}

// ── C1  EVIDENCED contract, evidence about X, effect on Y ──────────────────────────────────────
say('=== C1: contract DECLARES obligations; evidence is about X; effect targets Y ===');
const c1 = arm('C1  evidence=[about X.js], contract=EDIT_FIXTURE_EVIDENCED', {
  contract: EDIT_FIXTURE_EVIDENCED, evidence: [evX],
});
// positive control: correct-referent evidence MUST be admitted, or C1 proves nothing
const c1pos = arm('C1p POSITIVE CONTROL evidence=[about Y.js] (must be ADMITTED)', {
  contract: EDIT_FIXTURE_EVIDENCED, evidence: [evY],
});

// ── C2  the PRODUCTION contract: is evidence required at all? ──────────────────────────────────
say('');
say('=== C2: the contract the PRODUCTION write path actually passes (EDIT_FIXTURE) ===');
const c2none = arm('C2a evidence=[] , contract=EDIT_FIXTURE  (production shape)', {
  contract: EDIT_FIXTURE, evidence: [],
});
const c2x = arm('C2b evidence=[about X.js], contract=EDIT_FIXTURE', {
  contract: EDIT_FIXTURE, evidence: [evX],
});

// ── C3  strong negative control: remove the selecting characteristic ───────────────────────────
say('');
say('=== C3: STRONG NEGATIVE CONTROL - grant pinned to X, effect on Y ===');
const gX = grantFor('X.js');
const c3 = arm('C3  grant pins X.js, action targets Y.js (authorization MUST disappear)', {
  contract: EDIT_FIXTURE, evidence: [evX], authority: gX,
});

// ── verdicts ───────────────────────────────────────────────────────────────────────────────────
say('');
say('=== C VERDICTS ===');
const v1 = (!c1.permitted && c1pos.permitted) ? 'NOT_REPRODUCED'
  : (c1.permitted ? 'REPRODUCED' : 'NOT_EVALUATED (positive control did not admit - guard unreachable)');
say(`  C1 referential substitution under an EVIDENCED contract : ${v1}`);
say(`     X-evidence permitted=${c1.permitted}; Y-evidence (control) permitted=${c1pos.permitted}`);
say(`  C2 evidence REQUIRED on the production contract          : ${(c2none.permitted && c2none.landed) ? 'NO - none required, writes land with zero evidence' : 'yes'}`);
say(`     EDIT_FIXTURE declares evidenceObligations: [] so the referent-binding check never runs.`);
say(`     This is NOT "wrong evidence accepted". It is "no evidence demanded" on the path that ships.`);
say(`  C3 mismatched-grant control                              : ${c3.permitted ? 'FAILED - ambient permission!' : 'held - the grant is load-bearing'}`);

const dir = process.env.SECGATE_OUT || join(tmpdir(), 'SECGATE-1-counterexamples');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'C-evidence-referent.json'), JSON.stringify({
  proposition: 'evidence whose subject is X satisfies the authorization requirement for an effect on unrelated Y',
  distinguishedFrom: 'A-5, which is about a witness matched by NAME regardless of content',
  arms: rows,
  verdicts: { C1: v1, C2_evidenceRequiredOnProductionContract: !(c2none.permitted && c2none.landed), C3_grantLoadBearing: !c3.permitted },
  productionContract: { name: 'EDIT_FIXTURE', evidenceObligations: EDIT_FIXTURE.evidenceObligations },
  at: new Date().toISOString(),
}, null, 2));
say('');
say(`counterexample preserved under ${dir}`);
say('NOTHING WAS REPAIRED.');
try { rmSync(root, { recursive: true, force: true }); } catch {}
