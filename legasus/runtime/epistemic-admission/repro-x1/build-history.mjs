// Builds ONE journal record and prints it as JSON. Run it in a fresh process each time.
//
// TWO SEPARATE HISTORIES BY CONSTRUCTION, not by cloning. Each invocation is its own process with
// its own module state, so the two records below are produced by two independent runs of the same
// procedure. They come out byte-identical because the procedure is deterministic from a fresh
// process - which is exactly the situation under test, and is why "A !== B" is not the evidence
// this reproduction rests on.
import { readFileSync } from 'node:fs';
import { adapt } from '../adapter.mjs';
import { admit } from '../admission.mjs';
import { store } from '../authority-store.mjs';
import { journalEntry } from '../replay.mjs';
import { occurrenceOf } from '../merge.mjs';

const load = (n) => JSON.parse(readFileSync(new URL('../natural/' + n + '.json', import.meta.url), 'utf8'));
const REL2 = load('REL2'), ORD2 = load('ORD2');
const cov = (c) => c.derivation.alternatives[0].relation_witnesses.find((w) => w.relation === 'COVERAGE');

function build() {
  const st = store();
  const rel = structuredClone(REL2);
  admit(rel, { authorityStore: st });
  const seed = st.admitToken(adapt(rel, { authorityStore: st }).token, { fromCertificate: 'seed' });
  const o = structuredClone(ORD2);
  const w = cov(o);
  w.evidence_root = seed.ref;                       // the REAL address, so admission is genuine
  const filed = st.admitToken(adapt(o, { authorityStore: st }).token, { fromCertificate: 'ORD' });
  const e = journalEntry({ ref: filed.ref, store: st, certificate: o,
    consumed: [{ relation: 'COVERAGE', subject: w.subject, object: w.object,
      ref: 'auth:9:gone' }] }).entry;
  e.ref = 'auth:2:a';

  // ONE NORMALISATION, DISCLOSED. The store's nextRef() mixes Math.random() into every address, so
  // two processes running this identical procedure produce persisted records differing ONLY in that
  // internal address, which plays no part in this test. Without pinning it the first version of
  // this reproduction printed "byte-identical: false" and reproduced nothing. Admission above used
  // the REAL address; only the PERSISTED copy is pinned, and nothing else is touched.
  cov(e.evidence).evidence_root = 'auth:seed:pinned-for-reproduction';
  return e;
}

// The predecessor is built first in this same process, so the two runs agree on it.
const predecessor = occurrenceOf('P', build());
const entry = build();
entry.continuity = { predecessor, content: 'identification-only' };
process.stdout.write(JSON.stringify(entry));
