// The witness: loads the target itself, then optionally spawns a child that does the same.
// LEGASUS_FIXTURE_CHILD = 'none' | 'plain' (child without the mechanism) | 'inherit' (child
// that receives the mechanism through NODE_OPTIONS). The witness knows nothing about which
// implementation it is being served, and nothing about the experiment's classifications.
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const T = require(path.join(__dirname, 'target.js'));

let PASS = 0;
let FAIL = 0;
const check = (cond, msg) => { cond ? PASS++ : FAIL++; console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); };
check(JSON.stringify(T.seg('a; b')) === JSON.stringify(['a', 'b']), 'witness segments');

const mode = process.env.LEGASUS_FIXTURE_CHILD || 'none';
if (mode !== 'none') {
  const env = { ...process.env, LEGASUS_ROLE: 'descendant' };
  if (mode === 'plain') delete env.NODE_OPTIONS;          // the child does NOT receive the mechanism
  const r = spawnSync(process.execPath, [path.join(__dirname, 'loader.js')], { env, encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
  check(r.status === 0, `child (${mode}) completed`);
}

// P-E: re-load the target AFTER the child returns, so the contradiction is no longer terminal.
if (process.env.LEGASUS_FIXTURE_RELOAD === '1') {
  delete require.cache[require.resolve(path.join(__dirname, 'target.js'))];
  const T2 = require(path.join(__dirname, 'target.js'));
  check(JSON.stringify(T2.seg('a; b')) === JSON.stringify(['a', 'b']), 'witness segments after child');
}

console.log(`${FAIL === 0 ? 'ALL PASS' : FAIL + ' FAILED'}  (${PASS} passed, ${FAIL} failed)`);
process.exit(FAIL === 0 ? 0 : 1);
