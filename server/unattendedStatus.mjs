import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { memoryAvailable } from './resourceLease.mjs';
const mem = memoryAvailable();
console.log(`memory: ${Math.round(mem.ramMB)} MB available RAM, ${Math.round(mem.swapMB)} MB free swap`);
const dir = process.env.LEGASUS_STATUS_DIR || join(homedir(), '.local/state/legasus/status');
const states = [];
try {
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const row = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      process.kill(row.pid, 0);
      states.push(row);
    } catch { /* old process or incomplete record */ }
  }
} catch {}
for (const r of states.sort((a,b) => b.at.localeCompare(a.at)).slice(0, 12)) {
  const age = Math.round((Date.now() - Date.parse(r.at)) / 1000);
  console.log(`${r.kind}: ${r.state}${r.runId ? ` | run ${r.runId}` : ''}${r.goal ? ` | goal ${r.goal}/5` : ''}${r.modelCalls !== undefined ? ` | ${r.modelCalls} model calls` : ''} | updated ${age}s ago`);
}
