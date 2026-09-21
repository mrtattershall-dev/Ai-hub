// LEGASUS_WORKER_MODE:
//   'on-request'  loads the target only when asked          (C-REQ - genuine case)
//   'on-timer'    loads the target on its own schedule and  (C-A, C-A0 - the request, if any,
//                 IGNORES any request entirely               is causally inert)
const fs = require('node:fs');
const path = require('node:path');
const mode = process.env.LEGASUS_WORKER_MODE;
const trigger = process.env.LEGASUS_TRIGGER;

function doWork(why) {
  require(path.join(__dirname, 'target.js'));
  console.log(`PASS worker executed (${why}, pid ${process.pid})`);
  process.exit(0);
}

if (mode === 'on-timer') {
  setTimeout(() => doWork('own timer, no request consulted'), 700);
} else {
  const deadline = Date.now() + 20_000;
  (function poll() {
    if (fs.existsSync(trigger)) return doWork('a request arrived');
    if (Date.now() > deadline) { console.log('FAIL worker timed out'); process.exit(2); }
    setTimeout(poll, 20);
  }());
}
