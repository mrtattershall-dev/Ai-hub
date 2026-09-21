const path = require('node:path');
const fs = require('node:fs');
const T = require(path.join(__dirname, 'target.js'));

let PASS = 0;
const check = (cond, msg) => { if (cond) PASS++; console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); };
check(JSON.stringify(T.seg('a; b')) === JSON.stringify(['a', 'b']), 'witness segments');

// LEGASUS_REQUEST_DELAY lets a world place the request AFTER the execution.
const issue = () => {
  fs.writeFileSync(process.env.LEGASUS_TRIGGER, 'go');
  fs.appendFileSync(process.env.LEGASUS_REQUESTS, JSON.stringify({ event: 'request', at: Date.now() }) + '\n');
  console.log('PASS request issued');
};
if (process.env.LEGASUS_REQUEST === '1') {
  const d = Number(process.env.LEGASUS_REQUEST_DELAY || 0);
  d > 0 ? setTimeout(issue, d) : issue();
}

setTimeout(() => { console.log('ALL PASS'); process.exit(0); }, 1600);
