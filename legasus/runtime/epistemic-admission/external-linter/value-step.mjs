// One step of the comparison workflow, run in ITS OWN PROCESS so restarts are real.
//   node value-step.mjs <arm> <record|reuse> <file>
//
// The linter is built HERE, identically for every arm, from value-config.json. It is not built by
// the committed adapter's makeLinter(), because that exposes only {ignores, ruleOn} and the
// adapter must not be modified during this run — so a rule-OPTIONS change would be unavailable.
// Every arm receives the same ESLint instance shape through the same door.
import { ESLint } from 'eslint';
import { readFileSync, existsSync } from 'node:fs';
import { RULE } from './adapter-eslint-repaired.mjs';

const opts = existsSync('value-config.json')
  ? JSON.parse(readFileSync('value-config.json', 'utf8')) : {};
const linter = new ESLint({ overrideConfigFile: true,
  overrideConfig: [{ rules: { [RULE]: ['error', opts] },
    linterOptions: { reportUnusedDisableDirectives: 'error' } }] });

const [arm, op, file] = process.argv.slice(2);
const mod = await import('./arm-' + arm + '.mjs');
const t0 = Date.now();
const r = op === 'record' ? await mod.record(file, linter) : await mod.reuse(file, linter);
process.stdout.write(JSON.stringify({ arm, op, ms: Date.now() - t0, ...r }));
