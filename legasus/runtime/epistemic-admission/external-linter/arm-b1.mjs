// ARM B1 — the baseline HARDENED BY ITS OWN AUTHOR to meet R-a..R-d. Plain code, no Legasus.
//
// R-a  not reused when the file's content changed      -> content digest
// R-b  not reused when the configuration changed       -> configuration digest
// R-c  still usable when nothing changed
// R-d  works across a process restart, from storage alone
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { builtinRules } from 'eslint/use-at-your-own-risk';
import { analyse, makeLinter, RULE } from './adapter-eslint-repaired.mjs';

const STORE = 'arm-b1-store.json';
const load = () => (existsSync(STORE) ? JSON.parse(readFileSync(STORE, 'utf8')) : {});
const save = (d) => writeFileSync(STORE, JSON.stringify(d, null, 2));
const sha = (s) => createHash('sha256').update(s).digest('hex');

const contentDigest = (file) => sha(readFileSync(file));
// The configuration this result was produced under. HUMAN DECISION: what counts as "the
// configuration" - I chose the rule id plus its effective options, because that is what the adapter
// varies.
const configDigest = async (file, linter) => {
  const cfg = await linter.calculateConfigForFile(file);
  return sha(JSON.stringify({ rule: RULE, options: (cfg.rules || {})[RULE] || null }));
};

// R-e: the tool itself. HUMAN DECISION: eslint's version plus the selected rule's own source.
const toolDigest = () => sha(JSON.stringify({
  eslint: createRequire(import.meta.url)('eslint/package.json').version,
  rule: String(builtinRules.get(RULE).create),
  bump: process.env.LEGASUS_FAKE_TOOL_BUMP || '',
}));

export async function record(file, linter = makeLinter()) {
  const rep = await analyse(file, linter);
  const db = load();
  db[file] = { clean: rep.findings.length === 0, findings: rep.findings,
    conditions: rep.conditions,
    content: contentDigest(file), config: await configDigest(file, linter),
    tool: toolDigest() };
  save(db);
  return db[file];
}

export async function reuse(file, linter = makeLinter()) {
  const hit = load()[file];
  if (!hit) return { reused: false, why: 'no saved result for this path' };
  if (hit.content !== contentDigest(file)) {
    return { reused: false, why: 'file content changed since the result was saved' };
  }
  if (hit.config !== await configDigest(file, linter)) {
    return { reused: false, why: 'configuration changed since the result was saved' };
  }
  if (hit.tool !== toolDigest()) {
    return { reused: false, why: 'the tool changed since the result was saved' };
  }
  return { reused: true, clean: hit.clean, findings: hit.findings };
}
