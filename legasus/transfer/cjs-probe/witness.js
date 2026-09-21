// A witness in the foreign codebase's own shape: CommonJS, relative require, one
// `PASS|FAIL <id>` line per case, process.exit at the end. It knows nothing about the
// experiment. Both cases PASS against the unmutated subject, and FAIL against the mutant -
// so an arm where interception silently fails PASSES, which is exactly the false success
// the contract's R11 marker exists to catch.
const S = require('./subject.js');

let PASS = 0;
let FAIL = 0;
const check = (cond, msg) => { cond ? PASS++ : FAIL++; console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); };

check(JSON.stringify(S.seg('a; b')) === JSON.stringify(['a', 'b']), 'splits on semicolon');
check(JSON.stringify(S.seg('solo')) === JSON.stringify(['solo']), 'single segment survives');

console.log(`${FAIL === 0 ? 'ALL PASS' : FAIL + ' FAILED'}  (${PASS} passed, ${FAIL} failed)`);
process.exit(FAIL === 0 ? 0 : 1);
