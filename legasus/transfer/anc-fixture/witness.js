// The witness, under the mechanism. World is selected by LEGASUS_WORLD; it knows nothing else.
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const T = require(path.join(__dirname, 'target.js'));

let PASS = 0;
let FAIL = 0;
const check = (cond, msg) => { cond ? PASS++ : FAIL++; console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); };
check(JSON.stringify(T.seg('a; b')) === JSON.stringify(['a', 'b']), 'witness segments');

const world = process.env.LEGASUS_WORLD;
const env = { ...process.env };
delete env.NODE_OPTIONS;   // descendants do not receive the mechanism

if (world === 'A-1') {
  // Ask the pre-existing worker to do the work. It is not a descendant of this process.
  fs.writeFileSync(process.env.LEGASUS_TRIGGER, 'go');
  check(true, 'work requested from the pre-existing worker');
} else if (world === 'A-2') {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'background.js')], { env: { ...env, LEGASUS_ROLE: 'background' }, encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
  check(r.status === 0, 'background task completed');
} else if (world === 'A-3') {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'intermediate.js')], { env: { ...env, LEGASUS_ROLE: 'intermediate' }, encoding: 'utf8' });
  check(r.status === 0, 'intermediate exited');
}

console.log(`${FAIL === 0 ? 'ALL PASS' : FAIL + ' FAILED'}  (${PASS} passed, ${FAIL} failed)`);
process.exit(FAIL === 0 ? 0 : 1);
