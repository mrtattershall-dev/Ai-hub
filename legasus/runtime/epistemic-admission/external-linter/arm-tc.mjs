// ARM T-CONTROL — arm T with MY explicit world comparison removed. Legasus replay + admission only.
//
// The saved artefact is a JOURNAL of admission RECORDS plus the evidence (the certificates), exactly
// as replay.mjs defines it. Reuse is REPLAY: the evidence is re-executed through production
// admission in the new process; a saved verdict authorizes nothing.
//
// R-a and R-b are not implemented here as checks. The certificate's observation context carries the
// content and configuration it was produced under, and replay re-runs admission against the CURRENT
// world - so a changed file or configuration yields a world mismatch on the existing machinery.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { analyse, makeLinter, RULE, DOMAIN } from './adapter-eslint-repaired.mjs';
import { admit } from 'file:///C:/Users/tatte/Projects/ai-coding-hub-integration/legasus/runtime/epistemic-admission/admission.mjs';
import { adapt } from 'file:///C:/Users/tatte/Projects/ai-coding-hub-integration/legasus/runtime/epistemic-admission/adapter.mjs';
import { store } from 'file:///C:/Users/tatte/Projects/ai-coding-hub-integration/legasus/runtime/epistemic-admission/authority-store.mjs';
import { journalEntry, serialize, parse, replayJournal }
  from 'file:///C:/Users/tatte/Projects/ai-coding-hub-integration/legasus/runtime/epistemic-admission/replay.mjs';
import { certificatesFor } from './arm-t-certificates.mjs';

const STORE = 'arm-t-journal.json';   // shared with arm-t
const sha = (s) => createHash('sha256').update(s).digest('hex');

// The WORLD this evidence belongs to: the repository coordinate carries the file's content digest
// and the claim domain carries the configuration. Both are world identity, which resolveEvidenceRoot
// already compares - no new comparison is written.
export const worldOf = async (file, linter) => {
  const cfg = await linter.calculateConfigForFile(file);
  return {
    repository: 'file:' + file + '@' + sha(readFileSync(file)).slice(0, 16),
    claim_domain: DOMAIN + '@' + sha(JSON.stringify({ rule: RULE,
      options: (cfg.rules || {})[RULE] || null })).slice(0, 16),
  };
};

export async function record(file, linter = makeLinter()) {
  const rep = await analyse(file, linter);
  const world = await worldOf(file, linter);
  const { coverage, universal } = certificatesFor(rep, file, world);
  const st = store();
  const entries = [];
  const covAdmit = admit(coverage, { authorityStore: st });
  let covRef = null;
  if (covAdmit.established) {
    const out = adapt(coverage, { authorityStore: st });
    if (out.token) {
      covRef = st.admitToken(out.token, { fromCertificate: 'coverage' }).ref;
      entries.push(journalEntry({ ref: covRef, store: st, certificate: coverage, consumed: [] }).entry);
    }
  }
  const uni = JSON.parse(JSON.stringify(universal));
  for (const alt of uni.derivation.alternatives) {
    for (const w of alt.relation_witnesses || []) w.evidence_root = covRef;
  }
  const uniOut = adapt(uni, { authorityStore: st });
  if (uniOut.token) {
    const filed = st.admitToken(uniOut.token, { fromCertificate: 'universal' });
    entries.push(journalEntry({ ref: filed.ref, store: st, certificate: uni,
      consumed: covRef ? [{ relation: 'COVERAGE', subject: file + ':callbacks',
        object: uni.requested_claim.domain.name, ref: covRef }] : [] }).entry);
  }
  const ser = serialize(entries);
  if (!ser.ok) return { saved: false, why: ser.why };
  writeFileSync(STORE, ser.text);
  return { saved: true, entries: entries.length, state: admit(uni, { authorityStore: st }).state };
}

export async function reuse(file, linter = makeLinter()) {
  if (!existsSync(STORE)) return { reused: false, why: 'no journal' };
  const j = parse(readFileSync(STORE, 'utf8'));
  if (!j.ok) return { reused: false, why: j.why };
  if (!j.entries.length) return { reused: false, why: 'journal has no entries' };

  // THE CURRENT WORLD. Replay re-executes the evidence and the existing world-identity check decides
  // whether it still applies. No content or configuration comparison is written here.
  const world = await worldOf(file, linter);
  const st = store();
  const out = replayJournal({ entries: j.entries }, { authorityStore: st });
  const last = out.outcomes[out.outcomes.length - 1] || {};
  // CONTROL: the eight lines of explicit world comparison are REMOVED. What remains is Legasus
  // replay and production admission, and nothing else. If this arm still refuses stale evidence,
  // the safety came from Legasus; if it accepts, the safety was mine.
  void world;
  if (last.state !== 'ESTABLISHED') return { reused: false, why: last.why || 'replay did not establish' };
  return { reused: true, clean: true, state: last.state };
}
