// Runs the SELECTED external obligation only, and prints its machine-readable findings.
import { ESLint } from 'eslint';
const eslint = new ESLint({ overrideConfigFile: true,
  overrideConfig: { rules: { 'array-callback-return': 'error' } } });
const results = await eslint.lintFiles([process.argv[2]]);
for (const r of results) {
  for (const m of r.messages) {
    console.log(JSON.stringify({ file: r.filePath.split(/[\/]/).pop(), ruleId: m.ruleId,
      line: m.line, message: m.message }));
  }
  if (!r.messages.length) console.log(JSON.stringify({ file: r.filePath.split(/[\/]/).pop(), ruleId: null, clean: true }));
}
