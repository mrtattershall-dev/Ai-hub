import { evaluate } from './adapter-eslint.mjs';
import { ESLint } from 'eslint';

const RULE = 'array-callback-return';
const raw = async (file, cfg) => {
  const eslint = new ESLint(cfg || { overrideConfigFile: true,
    overrideConfig: { rules: { [RULE]: 'error' } } });
  const [r] = await eslint.lintFiles([file]);
  return r;
};

const rows = [];
const add = (arm, file, r, verdict, note) => rows.push({ arm, file, ...r, verdict, note });

for (const [arm, file] of [
  ['G1 file suppression', 'attack/g1-file-suppression.js'],
  ['G2 line suppression', 'attack/g2-line-suppression.js'],
  ['G4 parse failure', 'attack/g4-parse-failure.js'],
  ['G5 unrecognised form', 'attack/g5-unrecognised-form.js'],
]) {
  const r = await evaluate(file);
  const rawr = await raw(file);
  add(arm, file.split('/').pop(),
    { legasus: r.legasus.decision, adapterSawFindings: r.linter.reasons.length,
      eslintMessages: rawr.messages.length,
      eslintRuleIds: [...new Set(rawr.messages.map((m) => m.ruleId))].join(',') || '(none)' },
    r.legasus.decision === 'ESTABLISHED' ? 'SILENTLY ACCEPTED' : 'refused');
}

// G3: a file the configuration ignores
{
  const cfg = { overrideConfigFile: true,
    overrideConfig: [{ ignores: ['attack/g3-ignored.js'] },
      { rules: { [RULE]: 'error' } }] };
  const rawr = await raw('attack/g3-ignored.js', cfg);
  const r = await evaluate('attack/g3-ignored.js');   // adapter uses its OWN config, not this one
  add('G3 ignored file', 'g3-ignored.js',
    { legasus: r.legasus.decision, adapterSawFindings: r.linter.reasons.length,
      eslintMessages: rawr.messages.length,
      eslintRuleIds: (rawr.messages[0] || {}).message || '(none)' },
    'see note', 'the adapter never consults an ignores list; it lints whatever path it is handed');
}

// G6: coverage asserted over a module that was never linted
{
  const r = await evaluate('attack/does-not-exist.js').catch((e) => ({ error: e.message }));
  add('G6 unlinted module', 'does-not-exist.js',
    { legasus: r.error ? 'threw' : r.legasus.decision, adapterSawFindings: '-',
      eslintMessages: '-', eslintRuleIds: '-' },
    r.error ? 'refused (threw)' : (r.legasus.decision === 'ESTABLISHED' ? 'SILENTLY ACCEPTED' : 'refused'));
}

// G7: the rule absent from the effective configuration
{
  const cfg = { overrideConfigFile: true, overrideConfig: { rules: {} } };
  const rawr = await raw('attack/g1-file-suppression.js', cfg);
  add('G7 rule not enabled', 'g1 (rule off)',
    { legasus: '(adapter always enables it)', adapterSawFindings: '-',
      eslintMessages: rawr.messages.length, eslintRuleIds: '(none)' },
    'n/a', 'the adapter hardcodes the rule on, so this cannot arise THROUGH the adapter');
}

console.log('arm'.padEnd(22) + 'eslint msgs'.padEnd(13) + 'ruleIds'.padEnd(26)
  + 'adapter saw'.padEnd(13) + 'legasus'.padEnd(16) + 'verdict');
console.log('-'.repeat(110));
for (const r of rows) {
  console.log(r.arm.padEnd(22) + String(r.eslintMessages).padEnd(13)
    + String(r.eslintRuleIds).slice(0, 25).padEnd(26)
    + String(r.adapterSawFindings).padEnd(13) + String(r.legasus).padEnd(16) + r.verdict);
  if (r.note) console.log('    note: ' + r.note);
}
