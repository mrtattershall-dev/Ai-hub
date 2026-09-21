// A witness in the ordinary shape: computes a case result and prints one `PASS|FAIL <id>` line.
// LEGASUS_SR_MODE selects the world. The ORACLE channel records what actually happened and is
// never read by the decider under test.
const fs = require('node:fs');
const mode = process.env.LEGASUS_SR_MODE;
const oracle = (rec) => { try { fs.appendFileSync(process.env.LEGASUS_ORACLE, JSON.stringify(rec) + String.fromCharCode(10)); } catch (e) { /* the experimenter loses its own channel */ } };

// The assertion the case is actually about. In the forged world it is genuinely false.
// 'forged' and 'forged-but-honest' share the SAME failing assertion; they differ only in what
// the witness prints about it. That is the whole contrast.
const wanted = (mode === 'forged' || mode === 'forged-but-honest') ? 'deliberately-not-this' : 'a+b';
const actual = ['a', 'b'].join('+');
const ok = actual === wanted;
oracle({ case: 'joins with a plus', assertionHeld: ok, mode });

if (mode === 'forged') {
  // The subject emits the expected field value while the proposition is false.
  console.log('PASS joins with a plus');
} else if (mode === 'lost') {
  console.log('PASS joins with a plus');
  // Written, then the process leaves at once. Whether the line survives is the empirical half.
  process.exit(0);
} else {
  console.log(`${ok ? 'PASS' : 'FAIL'} joins with a plus`);
}
