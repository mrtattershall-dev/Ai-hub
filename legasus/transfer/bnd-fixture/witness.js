const path = require('node:path');
const fs = require('node:fs');
// S2: resolve the target without ever loading it. The hook answers the resolution and logs
// `served`; nothing is supplied to an execution.
if (process.env.LEGASUS_RESOLVE_ONLY === '1') {
  require.resolve(path.join(__dirname, 'target.js'));
  console.log('PASS witness resolved the target without loading it');
  setTimeout(() => { console.log('ALL PASS'); process.exit(0); }, 900);
  return;
}
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

// S3': two execution events, two role labels, ONE process. Equalises the event count with a
// genuine world that has a separate worker, so the bundles can be compared without that scar.
if (process.env.LEGASUS_SELF_WORKER === '1') {
  setTimeout(() => {
    delete require.cache[require.resolve(path.join(__dirname, 'target.js'))];
    process.env.LEGASUS_ROLE = 'worker';
    require(path.join(__dirname, 'target.js'));
    console.log('PASS the witness executed again, wearing a different label');
  }, Number(process.env.LEGASUS_SELF_WORKER_DELAY || 300));
}

// S4': the genuine world emits an operation-start too, so the record type is not itself the
// difference. Here the operation begins AFTER the request; in the hostile world, before it.
if (process.env.LEGASUS_OPS_MARK === '1') {
  setTimeout(() => { fs.appendFileSync(process.env.LEGASUS_OPS, JSON.stringify({ event: 'operation-start', role: 'worker', at: Date.now() }) + String.fromCharCode(10)); }, Number(process.env.LEGASUS_OPS_DELAY || 400));
}

setTimeout(() => { console.log('ALL PASS'); process.exit(0); }, 1600);
