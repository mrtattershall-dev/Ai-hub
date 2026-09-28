// MY DEPTH METRIC OVERSTATES PROGRESS, AND I SHOULD SAY SO BEFORE QUOTING IT.
//
// The harness aborts a transaction only when an intermediate fails to LOAD. A preservation break is
// recorded and the chain CONTINUES, so later sites are built on a state that already violates the old
// behaviour. v3's multiInsert required earlier members to survive; for these B conditions I only
// required the file to load. That is a real gap in the apparatus.
//
// So "sites completed" counts steps that LOADED, not steps that were sound. This recomputes the honest
// figure: HEALTHY DEPTH = the number of leading steps that both load AND keep the old behaviour green,
// which is the longest prefix of the plan that was actually valid.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

for (const label of ['b1-run', 'b2-run']) {
  const dir = 'C:/Users/tatte/AppData/Local/Temp/' + label;
  let rows;
  try { rows = JSON.parse(readFileSync(join(dir, 'rows.json'), 'utf8')); } catch (e) { continue; }
  rows = rows.filter((r) => r.condition === 'B_oracle_localized_insertion');
  console.log('===== ' + label + ' =====');
  for (const goal of [64, 74]) {
    const g = rows.filter((r) => r.goal === goal);
    if (!g.length) continue;
    const loaded = [];
    const healthy = [];
    for (const r of g) {
      loaded.push(r.steps_completed);
      let h = 0;
      for (const s of r.steps) {
        if (s.loads_after === true && s.old_regression_after === true) h++;
        else break;
      }
      healthy.push(h);
    }
    const srt = (a) => a.slice().sort((x, y) => x - y).join(' ');
    console.log('  goal ' + goal + '  of ' + g[0].sites_total + ' sites');
    console.log('    depth as I reported it (loaded)   ' + srt(loaded) + '    max ' + Math.max(...loaded));
    console.log('    HEALTHY depth (load AND preserve) ' + srt(healthy) + '    max ' + Math.max(...healthy));
    console.log('    reached full healthy depth        ' + healthy.filter((x) => x === g[0].sites_total).length + '/' + g.length);
  }
  console.log('');
}
console.log('  The two rows differ because a preservation break does not abort the chain. Quoting the');
console.log('  first row alone would credit the apparatus with progress it did not make.');
