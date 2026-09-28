// WITNESSES for sealing. A seal that cannot detect tampering is decoration, so every mutation class is
// tested, and an untouched family must verify - otherwise the check would "pass" by always failing.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, appendFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sealFamily, verifyFamily } from './seal.mjs';

const NL = String.fromCharCode(10);
function family() {
  const d = mkdtempSync(join(tmpdir(), 'seal-'));
  for (const id of ['t01', 't02']) {
    mkdirSync(join(d, id, 'source'), { recursive: true });
    mkdirSync(join(d, id, 'evidence', 'probes'), { recursive: true });
    writeFileSync(join(d, id, 'task.json'), JSON.stringify({ task_id: id, goal: 'do a thing' }), 'utf8');
    writeFileSync(join(d, id, 'source', 'm.py'), 'def f():' + NL + '    return 1' + NL, 'utf8');
    writeFileSync(join(d, id, 'evidence', 'oracle.json'), JSON.stringify({ task_id: id }), 'utf8');
    writeFileSync(join(d, id, 'evidence', 'probes', 'p.py'), 'assert True' + NL, 'utf8');
  }
  const m = join(d, 'MANIFEST.sealed.json');
  writeFileSync(m, JSON.stringify(sealFamily(d), null, 2), 'utf8');
  return { d, m };
}

const cases = [
  { name: 'UNTOUCHED          family verifies against its own seal',
    mutate: () => {}, expect: true },
  { name: 'CONTRACT CHANGED   task.json edited after sealing',
    mutate: (d) => writeFileSync(join(d, 't01', 'task.json'),
      JSON.stringify({ task_id: 't01', goal: 'do a DIFFERENT thing' }), 'utf8'), expect: false },
  { name: 'SOURCE CHANGED     starting program edited after sealing',
    mutate: (d) => appendFileSync(join(d, 't02', 'source', 'm.py'), '# tweak' + NL), expect: false },
  { name: 'EVIDENCE CHANGED   a probe edited after sealing',
    mutate: (d) => appendFileSync(join(d, 't01', 'evidence', 'probes', 'p.py'), 'assert 1 == 1' + NL),
    expect: false },
  { name: 'TASK ADDED         a task appears after sealing',
    mutate: (d) => { mkdirSync(join(d, 't03'), { recursive: true });
      writeFileSync(join(d, 't03', 'task.json'), JSON.stringify({ task_id: 't03' }), 'utf8'); },
    expect: false },
  { name: 'TASK REMOVED       a sealed task disappears',
    mutate: (d) => rmSync(join(d, 't02'), { recursive: true, force: true }), expect: false },
];

let fail = 0;
for (const c of cases) {
  const { d, m } = family();
  c.mutate(d);
  const r = verifyFamily(d, m);
  const pass = r.ok === c.expect;
  if (!pass) fail++;
  console.log('  ' + (pass ? 'ok  ' : 'FAIL') + '  ' + c.name);
  if (!r.ok && c.expect === false && r.problems[0]) {
    console.log('          detected: ' + r.problems[0].task_id + ' ' + r.problems[0].field);
  }
  rmSync(d, { recursive: true, force: true });
}
console.log('\n  ' + (fail ? fail + ' WITNESS FAILURE(S)' : 'all ' + cases.length + ' witnesses pass'));
console.log('  Non-vacuity: the UNTOUCHED case must VERIFY. A seal that always reports tampering would');
console.log('  pass every mutation witness and be worthless.');
