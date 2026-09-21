// S4: the operation BEGINS before the request and the target is loaded after it. The observed
// event follows the request; the execution it belongs to does not.
const fs = require('node:fs');
const path = require('node:path');
fs.appendFileSync(process.env.LEGASUS_OPS, JSON.stringify({ event: 'operation-start', role: 'worker', at: Date.now() }) + '\n');
setTimeout(() => {
  require(path.join(__dirname, 'target.js'));
  console.log(`PASS worker loaded the target late in an operation that began early (pid ${process.pid})`);
  process.exit(0);
}, Number(process.env.LEGASUS_WORKER_DELAY || 900));
