// A MINIMAL, SELF-CONTAINED AUDIT OF X1. Run it: `node audit-x1.mjs`
//
// It exists to be checked by someone who has not read the suite. It answers four questions and
// prints the evidence for each, rather than asserting a conclusion:
//
//   1. what does the FROZEN CONTRACT say the authorization means?
//   2. what are ALL the inputs the resolver receives?
//   3. is B independently identified as a different object from A?
//   4. what governance attaches, and to which record?
//
// It imports only the production modules and reads the frozen preregistration from disk.
import { readFileSync } from 'node:fs';
import { adapt } from './adapter.mjs';
import { admit } from './admission.mjs';
import { store } from './authority-store.mjs';
import { journalEntry } from './replay.mjs';
import { merge, replayMerged, occurrenceOf, contentOf, resolveContinuity, MODE } from './merge.mjs';

const line = (s) => process.stdout.write(s + '\n');
const rule = () => line('-'.repeat(78));

// ---------- 1. THE FROZEN CONTRACT, quoted from the file, not paraphrased ----------
rule();
line('1. WHAT THE FROZEN CONTRACT SAYS THE AUTHORIZATION MEANS');
rule();
// Whitespace-normalised, because the first version of this audit reported MISSING for a phrase
// that is present and merely WRAPPED across two lines. A check that answers "absent" because of a
// line break is a false negative, and this one was about the contract's own wording.
const prereg = readFileSync(new URL('./JOURNAL-LINEAGE_PREREG.md', import.meta.url), 'utf8')
  .replace(/\s+/g, ' ');
for (const quote of [
  'authorize a successor',
  'this new occurrence may continue that history',
  'content-based successor binding cannot by itself tell a copy from the original',
  'equality alone does not merge identities',
]) {
  const found = prereg.includes(quote);
  line((found ? '  FOUND   ' : '  MISSING ') + '"' + quote + '"');
}
line('');
line('  Reading: the frozen contract is HISTORY-SPECIFIC. It authorizes a successor to continue');
line('  THAT history, and it names content-vs-copy as a limit rather than as the definition.');
line('  A contract meaning "any record with these exact contents" would be a DIFFERENT contract,');
line('  and is not the one frozen.');

// ---------- the fixture: A, and a byte-identical replacement B ----------
const load = (n) => JSON.parse(readFileSync(new URL('./natural/' + n + '.json', import.meta.url), 'utf8'));
const REL2 = load('REL2'), ORD2 = load('ORD2');
const cov = (c) => c.derivation.alternatives[0].relation_witnesses.find((w) => w.relation === 'COVERAGE');

function record() {
  const st = store();
  const rel = structuredClone(REL2);
  admit(rel, { authorityStore: st });
  const seed = st.admitToken(adapt(rel, { authorityStore: st }).token, { fromCertificate: 'seed' });
  const o = structuredClone(ORD2);
  const w = cov(o);
  w.evidence_root = seed.ref;
  const filed = st.admitToken(adapt(o, { authorityStore: st }).token, { fromCertificate: 'ORD' });
  const e = journalEntry({ ref: filed.ref, store: st, certificate: o,
    consumed: [{ relation: 'COVERAGE', subject: w.subject, object: w.object,
      ref: 'auth:9:gone' }] }).entry;
  e.ref = 'auth:2:a';
  return e;
}
const PREDECESSOR = occurrenceOf('P', record());
const A = record();
A.continuity = { predecessor: PREDECESSOR, content: 'identification-only' };
const B = structuredClone(A);                      // the replacement

const AUTHORIZATION = { [PREDECESSOR]: {
  successorOrigin: 'S', successorContent: contentOf(A), transferGovernance: true } };
const GOVERNANCE = { [PREDECESSOR]: MODE.DESIGNATED };

// ---------- 3. INDEPENDENT IDENTIFICATION OF B ----------
rule();
line('3. IS B INDEPENDENTLY A DIFFERENT OBJECT FROM A?');
rule();
line('  A === B (reference identity)            : ' + (A === B));
line('  JSON.stringify(A) === JSON.stringify(B) : ' + (JSON.stringify(A) === JSON.stringify(B)));
line('  contentOf(A) === contentOf(B)           : ' + (contentOf(A) === contentOf(B)));
line('  occurrenceOf("S",A) === occurrenceOf("S",B): '
  + (occurrenceOf('S', A) === occurrenceOf('S', B)));
line('');
line('  So: two DISTINCT objects, identical in every representation the runtime receives.');
line('  The audit can tell them apart only by reference identity, which is not serialized and');
line('  never reaches the resolver.');

// ---------- 2. EVERY INPUT AVAILABLE TO THE RESOLVER ----------
const mergedA = merge([{ origin: 'S', journal: { entries: [A] } }]).merged;
const mergedB = merge([{ origin: 'S', journal: { entries: [B] } }]).merged;
rule();
line('2. EVERY INPUT THE RESOLVER RECEIVES, for the A-run and the B-run');
rule();
const dump = (m, label) => {
  line('  ' + label + ':');
  for (const r of m.records) {
    line('    origin      ' + r.origin);
    line('    ref         ' + r.ref);
    line('    occurrence  ' + r.occurrence);
    line('    contentOf   ' + contentOf(r.entry));
    line('    continuity  ' + JSON.stringify(r.entry.continuity));
    line('    entry bytes ' + JSON.stringify(r.entry).length);
  }
};
dump(mergedA, 'merged set with A');
dump(mergedB, 'merged set with B');
line('  authorization : ' + JSON.stringify(AUTHORIZATION));
line('');
const sameInputs = JSON.stringify(mergedA.records) === JSON.stringify(mergedB.records);
line('  the two merged sets are byte-identical: ' + sameInputs);
line('  resolveContinuity is a pure function of (merged, continuity): it receives NOTHING ELSE.');

// ---------- 4. THE RESULTING ATTACHMENT ----------
rule();
line('4. WHAT GOVERNANCE ATTACHES, AND TO WHICH RECORD');
rule();
const findingA = resolveContinuity(mergedA, AUTHORIZATION);
const findingB = resolveContinuity(mergedB, AUTHORIZATION);
line('  resolver finding, A present : ' + findingA[0].kind);
line('  resolver finding, B present : ' + findingB[0].kind);

const runB = replayMerged(mergedB, { authorityStore: store(),
  governingByOccurrence: GOVERNANCE, continuity: AUTHORIZATION });
const out = runB.outcomes[0] || {};
const ob = out.obligation || (out.supply && out.supply[0] && out.supply[0].obligation) || {};
line('  run ok                      : ' + runB.ok);
line('  unresolvedGovernance        : ' + JSON.stringify(runB.unresolvedGovernance));
line('  outcome origin/ref          : ' + out.origin + '/' + out.ref);
line('  obligation.mode             : ' + ob.mode);
line('  obligation.governedBy       : ' + ob.governedBy);
line('  the record admitted was B   : ' + (mergedB.records[0].entry === B));

rule();
line('CONCLUSION AS MEASURED');
rule();
line('  The frozen contract is history-specific (1). The inputs to the resolver are identical for');
line('  A and B (2). B is a distinct history, identifiable only outside those inputs (3). The');
line('  authorization for A attached to B, reported as authorized continuity, with nothing flagged');
line('  (4).');
line('');
line('  What this does NOT show: that every history-specific transfer is unsafe. It shows that');
line('  THIS contract cannot be enforced on THESE inputs, because they represent A and B');
line('  identically. A different contract - "any record with these exact contents" - would be');
line('  satisfied by B, but that contract was not the one frozen and must be chosen explicitly.');
