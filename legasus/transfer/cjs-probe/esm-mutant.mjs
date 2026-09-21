import { appendFileSync } from 'node:fs';
const t = process.env.LEGASUS_PROBE_TRACE;
if (t) { try { appendFileSync(t, JSON.stringify({ loaded: 'ESM_MUTANT', filename: import.meta.url }) + '\n'); } catch { /* absence is the observation */ } }

export function seg(s) {
  return [];
}
