// OBSERVER world, reporter half: a SEPARATE process that reads the subject's state and reports
// it faithfully. It does not lie, does not guess, and adds nothing of its own.
const fs = require('node:fs');
const s = JSON.parse(fs.readFileSync(process.env.LEGASUS_STATE, 'utf8'));
console.log(`${s.passed ? 'PASS' : 'FAIL'} ${s.case}`);
