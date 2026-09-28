// I-2's instrument: what the runtime CONCLUDES, independent of how identity is tracked.
//
// Run before and after installing closure fingerprints. Identity tracking may change; every verdict
// here must not. Deliberately records the refusal STAGE and the licensed relation too, so a verdict
// that stays "not established" for a DIFFERENT reason still shows up as a difference.
import { readFileSync, readdirSync } from 'node:fs';
import { adapt } from './adapter.mjs';
import { admit } from './admission.mjs';
import { deps } from './_test-support.mjs';
import { DIGESTS } from './rules.mjs';

const DIR = new URL('./fixtures/', import.meta.url);
const NAMES = readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));

// `repin: true` writes the runtime's CURRENT identity for the rule the certificate already names.
// It never changes which rule is claimed - that would be a different certificate, not a re-pin.
export function snapshot({ repin = true } = {}) {
  const rows = {};
  for (const n of NAMES) {
    const cert = JSON.parse(readFileSync(new URL(n + '.json', DIR), 'utf8'));
    if (repin && DIGESTS[cert.derivation.rule_id]) {
      cert.derivation.rule_digest = DIGESTS[cert.derivation.rule_id];
    }
    const d = deps(cert);
    const a = adapt(cert, d);
    const r = admit(cert, d);
    rows[n] = { state: r.state, established: r.established, stage: a.stage || null,
      licensed: cert.licensed_relation, bound: (a.bound || []).join(',') || null,
      rule: a.rule || null };
  }
  return rows;
}

export const render = (rows) => Object.entries(rows)
  .map(([n, r]) => n.padEnd(5) + ' ' + String(r.state).padEnd(15) + String(r.stage).padEnd(10)
    + String(r.licensed).padEnd(12) + String(r.bound).padEnd(10) + String(r.rule))
  .join('\n');
