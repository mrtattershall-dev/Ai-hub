// stopwhy.cjs <trial35-dir>... : step-type tally per dir, and the last step of every stopped run
const fs = require('fs'), path = require('path');
for (const dir of process.argv.slice(2)) {
  const runs = path.join(dir, 'runs'), tally = {};
  const rows = fs.readdirSync(runs).map((f) => JSON.parse(fs.readFileSync(path.join(runs, f), 'utf8')))
    .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
  console.log('\n== ' + dir);
  for (const j of rows) {
    const steps = j.steps || [];
    for (const s of steps) tally[s.type + (s.tool ? ':' + s.tool : '')] = (tally[s.type + (s.tool ? ':' + s.tool : '')] || 0) + 1;
    if (j.status === 'done') continue;
    const last = steps.slice(-2).map((s) => s.type + (s.tool ? ':' + s.tool : '') + ' ' + String(s.text || s.result || '').replace(/\s+/g, ' ').slice(0, 150));
    console.log('[' + j.status + '] ' + String(j.goal).slice(0, 50) + ' | calls ' + j.modelCalls + ' steps ' + steps.length + '\n    ' + last.join('\n    '));
  }
  console.log('TALLY ' + Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + '=' + v).join(' '));
}
