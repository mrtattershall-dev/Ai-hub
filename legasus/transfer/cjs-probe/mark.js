// Load-time self-identification (contract R11). Writes ONE line naming which file answered.
// If nothing arrives, substitution was not observed - which is never scorable as equivalence.
const fs = require('node:fs');
module.exports = function mark(identity, filename) {
  const t = process.env.LEGASUS_PROBE_TRACE;
  if (!t) return;
  try { fs.appendFileSync(t, JSON.stringify({ loaded: identity, filename }) + '\n'); } catch { /* absence is the observation */ }
};
