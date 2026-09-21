try { require('node:fs').appendFileSync(process.env.LEGASUS_PROBE_TRACE, JSON.stringify({ loaded: 'MUTANT', pid: process.pid, ppid: process.ppid, role: process.env.LEGASUS_ROLE || 'unset', argv1: process.argv[1] }) + '\n'); } catch (e) { /* absence is the observation */ }
function seg(s) { return String(s).split(';').map((x) => x.trim()).filter(Boolean); }
module.exports = { seg };
