try { require('node:fs').appendFileSync(process.env.LEGASUS_PROBE_TRACE, JSON.stringify({ loaded: 'MUTANT', pid: process.pid, filename: __filename }) + '\n'); } catch (e) { /* absence is the observation */ }
function seg(s) { return String(s).split(';').map((x) => x.trim()).filter(Boolean); }
module.exports = { seg };
