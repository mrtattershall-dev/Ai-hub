// A-3: spawns the grandchild DETACHED and unref'd, records both pids, then exits at once -
// breaking the chain between the grandchild and the witness while the grandchild is still alive.
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const g = spawn(process.execPath, [path.join(__dirname, 'grandchild.js')], {
  detached: true, stdio: 'ignore',
  env: { ...process.env, LEGASUS_ROLE: 'grandchild' },
});
g.unref();
try { fs.appendFileSync(process.env.LEGASUS_PIDS, JSON.stringify({ role: 'intermediate', pid: process.pid, ppid: process.ppid, spawned: g.pid }) + '\n'); } catch (e) { /* the sweep still runs */ }
process.exit(0);
