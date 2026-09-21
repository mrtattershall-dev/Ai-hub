// A-1: started BEFORE the witness, by the driver. Waits for work, then loads the target.
// Its ppid is the driver's, never the witness's - yet it executes because the witness asked.
const fs = require('node:fs');
const path = require('node:path');
const trigger = process.env.LEGASUS_TRIGGER;
const deadline = Date.now() + 20_000;
(function poll() {
  if (fs.existsSync(trigger)) {
    require(path.join(__dirname, 'target.js'));          // loads under role=worker
    console.log(`PASS worker did the work it was asked for (pid ${process.pid}, ppid ${process.ppid})`);
    process.exit(0);
  }
  if (Date.now() > deadline) { console.log('FAIL worker timed out waiting for work'); process.exit(2); }
  setTimeout(poll, 20);
}());
