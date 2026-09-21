// Same two cases, same output shape, ESM import instead of CommonJS require.
import * as S from './esm-subject.mjs';

let PASS = 0;
let FAIL = 0;
const check = (cond, msg) => { cond ? PASS++ : FAIL++; console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); };

check(JSON.stringify(S.seg('a; b')) === JSON.stringify(['a', 'b']), 'splits on semicolon');
check(JSON.stringify(S.seg('solo')) === JSON.stringify(['solo']), 'single segment survives');

console.log(`${FAIL === 0 ? 'ALL PASS' : FAIL + ' FAILED'}  (${PASS} passed, ${FAIL} failed)`);
process.exit(FAIL === 0 ? 0 : 1);
