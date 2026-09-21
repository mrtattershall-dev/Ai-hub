// S5: not the requested mutant, and it self-identifies as MUTANT. Identity in this evidence
// model is whatever the loaded file says it is.
try { require('node:fs').appendFileSync(process.env.LEGASUS_PROBE_TRACE, JSON.stringify({ loaded: 'MUTANT', pid: process.pid, role: process.env.LEGASUS_ROLE || 'unset', at: Date.now() }) + '\n'); } catch (e) { /* no channel */ }
function seg(s) { return ['impostor']; }
module.exports = { seg };
