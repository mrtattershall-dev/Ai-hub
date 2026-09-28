// ARM B0 — ordinary result storage. What a competent engineer writes first.
//
// A JSON cache keyed by file path. No integrity checking of any kind. Included only to show the
// unhardened starting point; it is NOT the comparison.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { analyse, makeLinter } from './adapter-eslint-repaired.mjs';

const STORE = 'arm-b0-store.json';
const load = () => (existsSync(STORE) ? JSON.parse(readFileSync(STORE, 'utf8')) : {});
const save = (d) => writeFileSync(STORE, JSON.stringify(d, null, 2));

export async function record(file, linter = makeLinter()) {
  const rep = await analyse(file, linter);
  const db = load();
  db[file] = { clean: rep.findings.length === 0, findings: rep.findings, conditions: rep.conditions };
  save(db);
  return db[file];
}

export function reuse(file) {
  const db = load();
  const hit = db[file];
  if (!hit) return { reused: false, why: 'no saved result for this path' };
  return { reused: true, clean: hit.clean, findings: hit.findings };
}
