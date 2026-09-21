// The witness, under the mechanism. LEGASUS_REQUEST=1 means it asks for the work; the request
// is recorded with its timestamp. The witness cannot tell whether anyone acts on it.
const path = require('node:path');
const fs = require('node:fs');
const T = require(path.join(__dirname, 'target.js'));

let PASS = 0;
let FAIL = 0;
const check = (cond, msg) => { cond ? PASS++ : FAIL++; console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); };
check(JSON.stringify(T.seg('a; b')) === JSON.stringify(['a', 'b']), 'witness segments');

if (process.env.LEGASUS_REQUEST === '1') {
  fs.writeFileSync(process.env.LEGASUS_TRIGGER, 'go');
  fs.appendFileSync(process.env.LEGASUS_REQUESTS, JSON.stringify({ event: 'request', by: process.pid, at: Date.now() }) + '\n');
  check(true, 'request issued');
}

// Stay alive long enough for the window to contain whatever the worker does.
setTimeout(() => {
  console.log(`${FAIL === 0 ? 'ALL PASS' : FAIL + ' FAILED'}  (${PASS} passed, ${FAIL} failed)`);
  process.exit(FAIL === 0 ? 0 : 1);
}, 1400);
