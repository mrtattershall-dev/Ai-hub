// runmarkers.cjs <trial35-dir>... : per goal, which hub fix messages the model actually saw
const fs = require('fs'), path = require('path');
const MARK = { cut: 'was CUT OFF before its code block', dup: 'times at the top level (lines', ev: 'Your assert at' };
for (const dir of process.argv.slice(2)) {
  const runs = path.join(dir, 'runs');
  const rows = fs.readdirSync(runs).map((f) => {
    const txt = fs.readFileSync(path.join(runs, f), 'utf8'); let j = {};
    try { j = JSON.parse(txt); } catch {}
    const goal = String(j.goal || j.task || j.prompt || '').replace(/\s+/g, ' ');
    const t = j.created_at || j.startedAt || j.started_at || fs.statSync(path.join(runs, f)).mtimeMs;
    const hits = Object.entries(MARK).filter(([, m]) => txt.includes(m)).map(([k]) => k + 'x' + (txt.split(MARK[k]).length - 1));
    return { t, goal, status: j.status, hits, keys: Object.keys(j).slice(0, 12).join(',') };
  }).sort((a, b) => (a.t > b.t ? 1 : -1));
  console.log('== ' + dir + '  keys: ' + rows[0].keys);
  for (const r of rows) console.log(String(r.status).padEnd(9) + (r.hits.join(' ') || '-').padEnd(14) + r.goal.slice(0, 70));
}
