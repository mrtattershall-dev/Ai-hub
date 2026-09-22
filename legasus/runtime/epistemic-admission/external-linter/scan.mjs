import { ESLint } from 'eslint';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const files = [];
const walk = (d, depth) => {
  if (depth > 4 || files.length > 2500) return;
  let e; try { e = readdirSync(d); } catch { return; }
  for (const n of e.sort()) {
    const p = join(d, n);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, depth + 1);
    else if (n.endsWith('.js') || n.endsWith('.cjs') || n.endsWith('.mjs')) files.push(p);
  }
};
walk(process.argv[2] || 'node_modules', 0);
const eslint = new ESLint({ overrideConfigFile: true,
  overrideConfig: { rules: { 'array-callback-return': 'error' } } });
const results = await eslint.lintFiles(files);
const hits = results.filter((r) => r.messages.some((m) => m.ruleId === 'array-callback-return'));
console.log('files scanned:', files.length, '| files with a finding:', hits.length);
for (const h of hits.slice(0, 6)) {
  const m = h.messages.find((x) => x.ruleId === 'array-callback-return');
  console.log('  ', h.filePath.replace(process.cwd(), '.'), '| line', m.line, '|', m.message.slice(0, 70));
}
