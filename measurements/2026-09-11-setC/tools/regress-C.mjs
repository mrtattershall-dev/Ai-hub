// regress-C.mjs <label> : set C regression analysis. The logic lives in ../../replay/regress.mjs (end states from the
// run files' own checkpoint steps - see ../../replay/runstates.mjs). FINAL_CHECKS / REGRESS_OUT env override paths.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../../replay/regress.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const D = join(HERE, '..');
const label = process.argv[2];
if (!label) { console.error('usage: regress-C.mjs <label>'); process.exit(2); }
await main({ D, set: 'setC', goalsFile: join(D, 'goals-C.json'), checker: join(HERE, 'checks-C.mjs'), label, finalChecks: process.env.FINAL_CHECKS, out: process.env.REGRESS_OUT });
