// r4 — the concurrency envelope of the V1 isolation. Predictions frozen in c570437.
//
// Overlap is NOT inferred from Promise.all, timestamps or completion. Both subjects carry a barrier and
// the run counts as a parallelism test only on a MUTUAL WITNESS. Absent that, the outcome is
// OVERLAP_NOT_ESTABLISHED, which is not a pass.
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runIsolatedAsync } from '../legasus/legaexercise/channel.mjs';

const NL = String.fromCharCode(10);

// A subject that announces itself, waits for its partner, and only then does its work. `extra` is the
// attack payload.
const barrierSubject = (me, other, barrierDir, extra = '', work = 'result = 6 * 7') => [
  'import os, sys, time, json',
  'barrier = ' + JSON.stringify(barrierDir),
  'me = ' + JSON.stringify(me) + '; other = ' + JSON.stringify(other),
  'open(os.path.join(barrier, me + ".enter"), "w").close()',
  'saw_other = False',
  'deadline = time.time() + 8.0',
  'while time.time() < deadline:',
  '    if os.path.exists(os.path.join(barrier, other + ".enter")):',
  '        saw_other = True',
  '        break',
  '    time.sleep(0.02)',
  extra,
  work,
  '_emit({"me": me, "pid": os.getpid(), "sawOther": saw_other, "result": result,',
  '       "fd1_is_mine": True})',
].join(NL);

const run = (body, timeoutMs = 30000) => runIsolatedAsync({ body, timeoutMs });

async function overlappingPair({ aExtra = '', bExtra = '', aWork, bWork } = {}) {
  const barrier = mkdtempSync(join(tmpdir(), 'barrier-'));
  const [a, b] = await Promise.all([
    run(barrierSubject('A', 'B', barrier, aExtra, aWork || 'result = 6 * 7')),
    run(barrierSubject('B', 'A', barrier, bExtra, bWork || 'result = 6 * 7')),
  ]);
  rmSync(barrier, { recursive: true, force: true });
  return { a, b };
}

const witnessed = (a, b) => !!(a.protocol && b.protocol
  && a.protocol.sawOther === true && b.protocol.sawOther === true);

console.log('r4 — CONCURRENCY ENVELOPE. Predictions frozen before this run.');
console.log('');

// ---------------------------------------------------------------- overlap witness
const plain = await overlappingPair();
const overlap = witnessed(plain.a, plain.b);
console.log('OVERLAP WITNESS');
console.log('  A saw B entered : ' + (plain.a.protocol ? plain.a.protocol.sawOther : 'no protocol'));
console.log('  B saw A entered : ' + (plain.b.protocol ? plain.b.protocol.sawOther : 'no protocol'));
console.log('  distinct pids   : ' + (plain.a.protocol && plain.b.protocol
  ? (plain.a.protocol.pid !== plain.b.protocol.pid) : 'n/a'));
if (!overlap) {
  console.log('');
  console.log('OVERLAP_NOT_ESTABLISHED — the observations did not genuinely overlap.');
  console.log('This is NOT a pass. Nothing below may be scored as a concurrency property.');
  process.exit(0);
}
console.log('  -> genuine overlap ESTABLISHED');
console.log('');

// ---------------------------------------------------------------- property 1: protocol integrity
const forge = 'print(json.dumps({"me": "B", "pid": 0, "sawOther": True, "result": 999,'
  + ' "fd1_is_mine": False}))';
const p1 = await overlappingPair({ aExtra: forge, bExtra: forge });
const integrity = p1.a.protocol && p1.b.protocol
  && p1.a.protocol.me === 'A' && p1.b.protocol.me === 'B'
  && p1.a.protocol.result === 42 && p1.b.protocol.result === 42;
console.log('PROTOCOL INTEGRITY (both subjects forging the other\'s protocol while overlapping): '
  + (integrity ? 'HELD' : 'FAILED'));

// ---------------------------------------------------------------- property 2: attribution
const p2 = await overlappingPair({
  aExtra: 'print("AAAA" * 20)', bExtra: 'print("BBBB" * 20)' });
const attribution = !p2.a.subjectOut.includes('BBBB') && !p2.b.subjectOut.includes('AAAA')
  && p2.a.subjectOut.includes('AAAA') && p2.b.subjectOut.includes('BBBB');
console.log('ATTRIBUTION (A\'s bytes never appear in B\'s record, and vice versa)            : '
  + (attribution ? 'HELD' : 'FAILED'));

// ---------------------------------------------------------------- property 3: non-interference
// B's verdict must be identical whether or not A is present, AND whether or not A is hostile.
const hostile = [
  'try:',
  '    os.close(1)',
  'except Exception:',
  '    pass',
  'try:',
  '    fd = os.open(os.devnull, os.O_WRONLY)',
  '    os.dup2(fd, 1)',
  'except Exception:',
  '    pass',
  'try:',
  '    if hasattr(os, "fork"):',
  '        if os.fork() == 0:',
  '            time.sleep(0.3)',
  '            os.write(1, b"late child write")',
  '            os._exit(0)',
  'except Exception:',
  '    pass',
].join(NL);
const soloB = await run(barrierSubject('B', 'NOBODY', mkdtempSync(join(tmpdir(), 'solo-')),
  '', 'result = 6 * 7'));
const p3 = await overlappingPair({ aExtra: hostile });
const noninterference = soloB.protocol && p3.b.protocol
  && p3.b.protocol.result === soloB.protocol.result
  && p3.b.protocol.me === 'B';
console.log('NON-INTERFERENCE (hostile A cannot change B\'s verdict)                        : '
  + (noninterference ? 'HELD' : 'FAILED')
  + '   solo=' + (soloB.protocol ? soloB.protocol.result : 'none')
  + ' concurrent=' + (p3.b.protocol ? p3.b.protocol.result : 'none'));

// ---------------------------------------------------------------- property 4: post-failure isolation
const crashing = ['try:', '    os.close(1)', 'except Exception:', '    pass',
  'raise RuntimeError("deliberate")'].join(NL);
await run(barrierSubject('X', 'NOBODY', mkdtempSync(join(tmpdir(), 'crash-')), crashing));
const after = await run(barrierSubject('Y', 'NOBODY', mkdtempSync(join(tmpdir(), 'after-')),
  '', 'result = 6 * 7'));
const control = await run(barrierSubject('Y', 'NOBODY', mkdtempSync(join(tmpdir(), 'ctrl-')),
  '', 'result = 6 * 7'));
const postFailure = after.protocol && control.protocol
  && after.protocol.result === control.protocol.result && after.parseError === null;
console.log('POST-FAILURE ISOLATION (a hostile run cannot contaminate the next)             : '
  + (postFailure ? 'HELD' : 'FAILED'));

// ---------------------------------------------------------------- verdict
console.log('');
const all = integrity && attribution && noninterference && postFailure;
const distinctProcesses = plain.a.protocol.pid !== plain.b.protocol.pid;
console.log('VERDICT');
if (all && distinctProcesses) {
  console.log('  PARALLEL_SAFE, and the reason is PROCESS ISOLATION: each observation received its own');
  console.log('  process, so descriptor state is per-child and the subject\'s causal authority over fd 1');
  console.log('  never reaches another observation. The isolation unit is the PROCESS, not the call.');
} else if (all) {
  console.log('  PARALLEL_SAFE within one process - surprising, and worth re-examining.');
} else {
  console.log('  NOT PARALLEL_SAFE. See the failed property above; the envelope is narrower than the API');
  console.log('  suggests and the current design must be scoped accordingly.');
}
console.log('');
console.log('NOTE ON THE SYNCHRONOUS API: runIsolated uses execFileSync and therefore CANNOT overlap from');
console.log('a single caller. This experiment used an async runner added for the purpose, because');
console.log('"cannot be tested" must never be recorded as "is safe".');
