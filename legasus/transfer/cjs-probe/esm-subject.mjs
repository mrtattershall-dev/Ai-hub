// ESM twin of subject.js. Exists ONLY as the probe's own positive control: if the hook does
// not substitute HERE either, the probe never armed it and the CJS arms say nothing about CJS.
import { appendFileSync } from 'node:fs';
const t = process.env.LEGASUS_PROBE_TRACE;
if (t) { try { appendFileSync(t, JSON.stringify({ loaded: 'ESM_SUBJECT', filename: import.meta.url }) + '\n'); } catch { /* absence is the observation */ } }

export function seg(s) {
  return String(s).split(';').map((x) => x.trim()).filter(Boolean);
}
