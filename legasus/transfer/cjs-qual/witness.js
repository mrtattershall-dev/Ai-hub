// A witness in the foreign codebase's shape: CommonJS, relative requires, one
// `PASS|FAIL <id>` line per case. It knows nothing about the experiment, and it passes
// whenever the ORIGINAL modules are loaded - so a bypass shows up here as success.
const T = require('./target.js');
const D = require('./decoy.js');

let PASS = 0;
let FAIL = 0;
const check = (cond, msg) => { cond ? PASS++ : FAIL++; console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); };

check(JSON.stringify(T.seg('a; b')) === JSON.stringify(['a', 'b']), 'target splits on semicolon');
check(JSON.stringify(T.seg('solo')) === JSON.stringify(['solo']), 'target single segment survives');
check(D.joinAll(['x', 'y']) === 'x+y', 'decoy joins');

console.log(`${FAIL === 0 ? 'ALL PASS' : FAIL + ' FAILED'}  (${PASS} passed, ${FAIL} failed)`);
process.exit(FAIL === 0 ? 0 : 1);
