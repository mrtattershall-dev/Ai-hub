// Load-time self-identification. This is the ONLY source of "executed identity" - the
// mechanism's own log is a claim, not an observation of execution.
const fs = require('node:fs');
module.exports = function mark(identity) {
  const t = process.env.LEGASUS_PROBE_TRACE;
  if (!t) return;
  try { fs.appendFileSync(t, JSON.stringify({ loaded: identity, filename: __filename }) + '\n'); } catch { /* absence is the observation */ }
};
