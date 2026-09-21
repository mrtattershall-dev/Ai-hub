// THE ADMITTED RULE REGISTRY — the runtime's own definition of what each inference rule requires.
//
// A CERTIFICATE CARRIES RULE IDENTITY, NEVER RULE AUTHORITY. It may name the rule it claims to have
// used and list the witnesses it established. It may not say what that rule requires, because a
// producer that chooses its own burden of proof has authored its own obligation.
//
// The digest pins the DEFINITION, not the name. justification.mjs already records that a name
// collision is not an admission: two things called `history` are not the same dimension because the
// strings match. The same applies to a rule, so a certificate produced against one definition cannot
// be silently evaluated against another.
import { createHash } from 'node:crypto';

// Canonical form both languages can compute independently: name, sorted requirements, version.
export const digestOf = (r) => createHash('sha256')
  .update(JSON.stringify({ name: r.name, requires: [...r.requires].sort(), version: r.version }))
  .digest('hex');

const define = (name, requires, version) => Object.freeze({ name, requires: Object.freeze(requires),
  version });

export const ADMITTED_RULES = Object.freeze({
  // An existential over a domain needs the witness that the member belongs to that domain. This is
  // H-EXTENT's obligation, stated where the calculus can enforce it.
  'existential-from-established-member':
    define('existential-from-established-member', ['MEMBERSHIP'], '1'),

  // A universal over a domain needs the witness that the domain was exhaustively covered.
  'universal-from-exhaustive-coverage':
    define('universal-from-exhaustive-coverage', ['COVERAGE'], '1'),

  // THE ANTI-REFUSAL CONTROL, and it is a real rule rather than a test fixture: restating an
  // observation as a claim about the same subject at the same scope relates nothing to anything, so
  // it genuinely requires no relation witness. Without such a rule the repair becomes "every
  // derivation must carry a witness", which is a refusal machine.
  'claim-from-direct-observation':
    define('claim-from-direct-observation', [], '1'),
});

export const DIGESTS = Object.freeze(Object.fromEntries(
  Object.entries(ADMITTED_RULES).map(([id, r]) => [id, digestOf(r)])));

export const RULE_MOVED = 'RULE_DEFINITION_MOVED';

// Resolve a certificate's rule IDENTITY to the runtime's definition. Returns the local rule or a
// refusal; never a rule assembled from certificate data.
export function resolveRule({ rule_id, rule_digest }) {
  const local = ADMITTED_RULES[rule_id];
  if (!local) {
    return { ok: false, why: 'rule_id "' + rule_id + '" is not an admitted rule of this runtime.'
      + ' A rule the consumer does not recognise is one whose obligations it cannot enforce.' };
  }
  const here = DIGESTS[rule_id];
  if (rule_digest !== here) {
    return { ok: false, moved: true, why: RULE_MOVED + ': the certificate was produced against "'
      + rule_id + '" @ ' + String(rule_digest).slice(0, 12) + ' and this runtime holds @ '
      + here.slice(0, 12) + '. The definition moved underneath the certificate, so its derivation no'
      + ' longer means what it meant; it can neither convict nor absolve. Re-run the producer.' };
  }
  return { ok: true, rule: { name: local.name, requires: [...local.requires] }, digest: here };
}
