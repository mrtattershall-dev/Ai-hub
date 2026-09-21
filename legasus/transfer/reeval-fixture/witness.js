// Re-evaluates the same target five times, clearing the module cache between iterations -
// the shape step 6 found in the foreign engine (one process, many evaluations of one identity).
// One `PASS|FAIL <id>` line per evaluation. Knows nothing about the experiment.
const path = require('node:path');
const TARGET = path.join(__dirname, 'target.js');

let PASS = 0;
let FAIL = 0;
for (let i = 1; i <= 5; i++) {
  delete require.cache[require.resolve(TARGET)];
  const T = require(TARGET);
  const ok = JSON.stringify(T.seg('a; b')) === JSON.stringify(['a', 'b']);
  ok ? PASS++ : FAIL++;
  console.log(`${ok ? 'PASS' : 'FAIL'} evaluation ${i}`);
}
console.log(`${FAIL === 0 ? 'ALL PASS' : FAIL + ' FAILED'}  (${PASS} passed, ${FAIL} failed)`);
process.exit(FAIL === 0 ? 0 : 1);
