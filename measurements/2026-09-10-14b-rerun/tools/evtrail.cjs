// evtrail.cjs <runs-dir> : for every run that got assert evidence, each evidence block and the model's next move
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
for (const f of fs.readdirSync(dir)) {
  const txt = fs.readFileSync(path.join(dir, f), 'utf8');
  if (!txt.includes('Your assert at')) continue;
  const j = JSON.parse(txt), steps = j.steps || [];
  console.log('\n### ' + String(j.goal).slice(0, 90) + '  [' + j.status + ']');
  steps.forEach((s, i) => {
    const r = String(s.result || s.text || '');
    const k = r.indexOf('Your assert at');
    if (k < 0) return;
    const block = r.slice(k).split(/\r?\n/).filter((l) => /Your assert|LEFT|RIGHT/.test(l)).join(' | ');
    const next = steps.slice(i + 1).find((x) => x.type === 'tool' && x.tool !== 'run_python' && x.tool !== 'run_node');
    console.log('  step ' + s.n + ': ' + block.slice(0, 260));
    if (next) console.log('     -> ' + next.tool + ' ' + JSON.stringify(next.args || {}).slice(0, 160) + '\n        thought: ' + String(next.thought || '').slice(0, 200));
  });
}
