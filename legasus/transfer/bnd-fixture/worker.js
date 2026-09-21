// A worker whose behaviour is fully controlled by env, so worlds differ in ONE thing.
//   LEGASUS_WORKER_MODE  on-request | on-timer | none
//   LEGASUS_WORKER_DELAY ms before acting (used to order execution against the request)
// The observation channel is LEGASUS_PROBE_TRACE; when the driver unsets it for this process,
// the worker still executes and simply leaves no marker. It cannot tell the difference.
const fs = require('node:fs');
const path = require('node:path');
const mode = process.env.LEGASUS_WORKER_MODE || 'none';
const delay = Number(process.env.LEGASUS_WORKER_DELAY || 300);

function doWork(why) {
  require(path.join(__dirname, 'target.js'));
  console.log(`PASS worker executed (${why}, pid ${process.pid})`);
  process.exit(0);
}
if (mode === 'none') { console.log('PASS worker idled by design'); process.exit(0); }
if (mode === 'on-timer') { setTimeout(() => doWork('own timer'), delay); }
else {
  const deadline = Date.now() + 15_000;
  (function poll() {
    if (fs.existsSync(process.env.LEGASUS_TRIGGER)) return setTimeout(() => doWork('a request arrived'), delay);
    if (Date.now() > deadline) { console.log('FAIL worker timed out'); process.exit(2); }
    setTimeout(poll, 20);
  }());
}
