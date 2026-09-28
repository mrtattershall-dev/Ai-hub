// What EXPLICIT BASIS does the pinned eslint expose for each coverage condition? Measured, not assumed.
import { ESLint } from 'eslint';
import { createRequire } from 'node:module';
const RULE = 'array-callback-return';
const ver = createRequire(import.meta.url)('eslint/package.json').version;
console.log('eslint version:', ver);

const mk = (extra = {}) => new ESLint({ overrideConfigFile: true,
  overrideConfig: [{ rules: { [RULE]: 'error' }, ...extra }] });

const show = (label, r) => console.log(label, JSON.stringify({
  msgs: r.messages.map((m) => ({ ruleId: m.ruleId, fatal: !!m.fatal, msg: m.message.slice(0, 60) })),
  suppressed: (r.suppressedMessages || []).map((m) => ({ ruleId: m.ruleId,
    kinds: (m.suppressions || []).map((s) => s.kind) })),
  fatalErrorCount: r.fatalErrorCount, errorCount: r.errorCount,
}));

// 2. suppressedMessages for file-level and line-level directives that suppress a real finding
const e = mk();
show('G1 file-level  :', (await e.lintFiles(['attack/g1-file-suppression.js']))[0]);
show('G2 line-level  :', (await e.lintFiles(['attack/g2-line-suppression.js']))[0]);

// 3. an UNUSED directive (nothing to suppress) with reportUnusedDisableDirectives on
const eu = mk({ linterOptions: { reportUnusedDisableDirectives: 'error' } });
await import('node:fs').then((fs) => fs.writeFileSync('attack/probe-unused-directive.js',
  '/* eslint-disable array-callback-return */\nexport const ok = (xs) => xs.map((x) => x * 2);\n'));
show('unused directive:', (await eu.lintFiles(['attack/probe-unused-directive.js']))[0]);

// 4. isPathIgnored
const ei = new ESLint({ overrideConfigFile: true,
  overrideConfig: [{ ignores: ['attack/g3-ignored.js'] }, { rules: { [RULE]: 'error' } }] });
console.log('isPathIgnored g3 :', await ei.isPathIgnored('attack/g3-ignored.js'),
  '| g1 :', await ei.isPathIgnored('attack/g1-file-suppression.js'));

// 5. calculateConfigForFile -> effective rules
const cfg = await e.calculateConfigForFile('attack/g1-file-suppression.js');
console.log('effective rule   :', JSON.stringify(cfg.rules && cfg.rules[RULE]));
const cfgOff = await new ESLint({ overrideConfigFile: true, overrideConfig: { rules: {} } })
  .calculateConfigForFile('attack/g1-file-suppression.js');
console.log('effective (off)  :', JSON.stringify(cfgOff.rules && cfgOff.rules[RULE]));

// 6. fatal parse error shape
show('G4 parse failure:', (await e.lintFiles(['attack/g4-parse-failure.js']))[0]);

// 7. nonexistent file
try { await e.lintFiles(['attack/does-not-exist.js']); console.log('nonexistent: no throw'); }
catch (err) { console.log('nonexistent throws:', err.message.slice(0, 80)); }
