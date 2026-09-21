try { require('node:fs').appendFileSync(process.env.LEGASUS_PROBE_TRACE, JSON.stringify({ loaded: 'MUTANT', pid: process.pid, role: process.env.LEGASUS_ROLE || 'unset', at: Date.now() }) + '\n'); } catch (e) { /* no channel */ }
function seg(s) { return String(s).split(';').map((x) => x.trim()).filter(Boolean); }
module.exports = { seg };
