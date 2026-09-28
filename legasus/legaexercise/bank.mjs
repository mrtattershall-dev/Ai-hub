// LEGAEXERCISE — THE WITNESS BANK. Replayable evidence with identity and a lifecycle.
//
// A witness is not an observation that happened once. It is EVIDENCE, and evidence has to carry enough
// identity to be re-checked later:
//
//     DISCOVERED  -- replay -->  VALID  -- repository changes -->  STALE  -- replay -->  REVALIDATED
//                                                                                   \->  INVALID
//
// THIS MATTERS FOR THE THING THE WHOLE PROJECT IS FOR. A witness established against repository state S0
// cannot silently remain authority at S5000 after the program around it has changed. An autonomous run
// that trusts stale evidence is an autonomous run that has stopped observing. Repository memory needs
// EVIDENCE INVALIDATION, and the first implementation of that does not need perfect dependency tracking:
// if the source file or the setup changed, the witness is STALE and must replay before it may be used.
//
// EXERCISE IS OPPORTUNISTIC, and the sources are NOT equally authoritative merely because they all
// eventually reach the line:
//
//     EXISTING_WITNESS      already established and still valid
//     REPOSITORY_TEST       the project's own test suite exercised it
//     DOCTEST               an author-written example inside the package
//     KNOWN_FIXTURE         a fixture the repository defines
//     ANNOTATION_DERIVED    constructed from type annotations
//     SYNTHESIZED           invented by me, and therefore least trustworthy
//     NONE                  unable to exercise - a real answer, not a gap to paper over
//
// SEMANTIC LEAST PRIVILEGE APPLIES HERE TOO. EXERCISE knows far more about execution than PROPOSE needs:
// call sites, fixtures, argument values, traced paths. None of that is rendered to the model by default -
// the four rendering families measured what happens when true, relevant context is handed over, and the
// answer was up to 95% of correctness.
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { witnessFor, WITNESS, isValidExperiment } from './witness.mjs';

const NL = String.fromCharCode(10);

export const SOURCE_RANK = ['EXISTING_WITNESS', 'REPOSITORY_TEST', 'DOCTEST', 'KNOWN_FIXTURE',
  'ANNOTATION_DERIVED', 'SYNTHESIZED'];

export const LIFECYCLE = {
  DISCOVERED: 'DISCOVERED',
  VALID: 'VALID',
  STALE: 'STALE',
  REVALIDATED: 'REVALIDATED',
  INVALID: 'INVALID',
};

const sha = (s) => createHash('sha256').update(String(s)).digest('hex').slice(0, 16);

// The identity a witness must carry to be re-checkable. Anything missing here is something that could
// change underneath the evidence without the evidence noticing.
export function identityOf({ rootDir, packageName, target, setup, invocation,
  namespaceModule = '' }) {
  const file = join(rootDir, packageName, target.module);
  const sourceDigest = existsSync(file) ? sha(readFileSync(file, 'utf8')) : null;
  return {
    corpus: packageName,
    sourceRoot: rootDir,
    targetSymbol: (target.cls ? target.cls + '.' : '') + target.callable,
    targetFile: packageName + '/' + target.module,
    targetLine: target.line ?? null,
    sourceDigest,
    setupDigest: sha(JSON.stringify([setup, namespaceModule])),
    invocationDigest: sha(invocation),
    environment: process.platform + '|' + process.version,
  };
}

// Establish a witness, with identity attached and a lifecycle state.
export function establish({ rootDir, packageName, target, setup, invocation, provenance,
  namespaceModule = '' }) {
  const identity = identityOf({ rootDir, packageName, target, setup, invocation, namespaceModule });
  const w = witnessFor({ rootDir, packageName, setup, invocation, target, provenance, namespaceModule });
  return {
    ...w, identity, provenance,
    lifecycle: isValidExperiment(w) ? LIFECYCLE.VALID : LIFECYCLE.DISCOVERED,
    establishedAt: new Date().toISOString(),
  };
}

// Has the world moved under this evidence? Deliberately crude and deliberately CONSERVATIVE: any change
// to the source file or the setup makes the witness stale. A cheap false "stale" costs one replay; a
// missed one costs a decision made on evidence about a program that no longer exists.
export function checkFreshness(w) {
  const now = identityOf({ rootDir: w.identity.sourceRoot, packageName: w.identity.corpus,
    target: w.target, setup: w.setup, invocation: w.invocation,
    namespaceModule: w.namespaceModule });
  const changed = [];
  for (const k of ['sourceDigest', 'setupDigest', 'invocationDigest', 'environment']) {
    if (now[k] !== w.identity[k]) changed.push(k);
  }
  if (!changed.length) return { ...w, fresh: true };
  return { ...w, fresh: false, lifecycle: LIFECYCLE.STALE, changed,
    why: 'the witness was established against different ' + changed.join(', ')
      + '; it must replay before it may be used as authority' };
}

// Re-run a stale witness. REVALIDATED only if it reaches the same state on the same evidence.
export function revalidate(w) {
  const again = establish({ rootDir: w.identity.sourceRoot, packageName: w.identity.corpus,
    target: w.target, setup: w.setup, invocation: w.invocation, provenance: w.provenance,
    namespaceModule: w.namespaceModule });
  const same = again.state === w.state;
  return { ...again,
    lifecycle: same ? LIFECYCLE.REVALIDATED : LIFECYCLE.INVALID,
    previousState: w.state,
    why: same ? 'replayed to the same state against the current source'
      : 'the same invocation now reaches ' + again.state + ' where it previously reached ' + w.state };
}

// THE LADDER. Try sources in order of authority and stop at the first that establishes a valid
// experiment - recording which rung answered, because that is part of the evidence.
export function exercise({ rootDir, packageName, target, candidates }) {
  const attempts = [];
  const ordered = [...candidates].sort(
    (a, b) => SOURCE_RANK.indexOf(a.provenance) - SOURCE_RANK.indexOf(b.provenance));
  for (const c of ordered) {
    const w = establish({ rootDir, packageName, target, setup: c.setup, invocation: c.invocation,
      provenance: c.provenance, namespaceModule: c.namespaceModule || '' });
    attempts.push({ provenance: c.provenance, state: w.state, invocation: c.invocation.slice(0, 60) });
    if (isValidExperiment(w)) {
      return { established: true, witness: w, rung: c.provenance, attempts };
    }
  }
  // NONE is a real answer. It says this behaviour cannot currently be made to happen, which is a
  // measurable property of the repository and the apparatus, not a gap to be papered over.
  return { established: false, rung: 'NONE', attempts,
    why: attempts.length
      ? 'no available source could make this site execute'
      : 'no candidate invocations were offered for this target' };
}

// What EXERCISE may hand onward to RENDER. Deliberately almost nothing: the fact that the behaviour is
// reachable, and nothing about how. The how is internal.
export function projectionForRender(result) {
  if (!result.established) return { exercisable: false };
  return { exercisable: true, outcome: result.witness.outcome || result.witness.status };
}

export { NL };
