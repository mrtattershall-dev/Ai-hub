// A-2: a descendant of the witness that loads the target for work outside any of the witness's
// cases. Structurally identical to step 8's escaped descendant; different only in a purpose
// nothing here can observe.
const path = require('node:path');
require(path.join(__dirname, 'target.js'));
console.log(`PASS background housekeeping (pid ${process.pid}, ppid ${process.ppid})`);
process.exit(0);
