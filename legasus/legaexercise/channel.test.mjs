// r4 / V1 — ATTACK THE BOUNDARY, not the pyparsing manifestation.
//
// Repo C showed one string shape (a doctest calling print) corrupting the observer's transport. Patching
// that shape would leave the invariant violated. The invariant is:
//
//     SUBJECT OUTPUT CANNOT CORRUPT OBSERVER PROTOCOL
//
// so the subject is given every weapon that was plausibly available to it, including bytes that are
// EXACTLY the protocol's own shape. And the second requirement is tested alongside, because isolating the
// channel by changing how the subject behaves would be the classic instrumentation failure:
//
//     OBSERVER TRANSPARENCY  observing does not materially alter the behaviour under judgement
import test from 'node:test';
import assert from 'node:assert';
import { runIsolated } from './channel.mjs';

const NL = String.fromCharCode(10);
const emit = '_emit({"status": "OBSERVED", "value": 42})';

// Each attack writes hostile bytes and THEN emits a legitimate protocol message. The protocol must
// survive intact every time.
const ATTACKS = {
  PLAIN_PRINT: 'print("hello")',
  PROTOCOL_SHAPED: 'print(json.dumps({"status": "OBSERVED", "value": 999}))',
  MULTIPLE_JSON: 'print(json.dumps({"a":1})); print(json.dumps({"b":2}))',
  PARTIAL_JSON: 'print(\'{"status": "OBSER\')',
  NO_NEWLINE: 'sys.stdout.write("no trailing newline")',
  EMBEDDED_NEWLINES: 'print("a" + chr(10) + "b" + chr(10) + "c")',
  HUGE_OUTPUT: 'print("x" * 2000000)',
  ANSI_CONTROL: 'sys.stdout.write(chr(27) + "[31mred" + chr(27) + "[0m" + chr(7))',
  RAW_FD1: 'os.write(1, b"raw bytes straight to fd one")',
  RAW_FD2: 'os.write(2, b"raw bytes straight to fd two")',
  BINARY_BYTES: 'os.write(1, bytes(range(256)))',
  STDERR_WRITE: 'sys.stderr.write("noise on stderr")',
  SUBPROCESS_STDOUT: 'import subprocess; subprocess.run([sys.executable, "-c", "print(1)"])',
  SUBPROCESS_STDERR: 'import subprocess; subprocess.run([sys.executable, "-c",'
    + ' "import sys; sys.stderr.write(\'e\')"])',
  THREADED_LATE: 'import threading, time' + NL
    + 'threading.Thread(target=lambda: (time.sleep(0.05), print("late"))).start()',
  FLUSH_ABUSE: 'sys.stdout.write("partial"); sys.stdout.flush(); os.write(1, b"more")',
};

test('CHANNEL ISOLATION — every attack, and the protocol survives intact', () => {
  const survived = [];
  for (const [name, attack] of Object.entries(ATTACKS)) {
    const r = runIsolated({ body: attack + NL + emit });
    assert.equal(r.parseError, null, name + ' broke the protocol: ' + r.parseError);
    assert.notEqual(r.protocol, null, name + ' lost the protocol entirely');
    assert.equal(r.protocol.status, 'OBSERVED', name + ' corrupted the protocol content');
    assert.equal(r.protocol.value, 42,
      name + ' REPLACED the observer\'s value with the subject\'s - that is forgery, not noise');
    survived.push(name);
  }
  assert.equal(survived.length, Object.keys(ATTACKS).length);
});

test('THE FORGERY CASE deserves its own assertion', () => {
  // The subject writes bytes that are EXACTLY a well-formed protocol message. Under frozen r3 the
  // receiver read whatever arrived on the shared channel; a weakly framed receiver could have accepted
  // the subject's testimony as the observer's.
  const r = runIsolated({ body: ATTACKS.PROTOCOL_SHAPED + NL + emit });
  assert.equal(r.protocol.value, 42, 'the observer said 42; the subject said 999');
  assert.match(r.subjectOut, /999/, 'and the forgery attempt is still RECORDED as subject evidence');
});

test('SUBJECT OUTPUT IS EVIDENCE, not noise to be discarded', () => {
  const r = runIsolated({ body: 'print("a fact about the subject")' + NL + emit });
  assert.match(r.subjectOut, /a fact about the subject/);
  assert.ok(r.subjectBytes > 0);
});

test('AN ABSENT PROTOCOL IS EXPLICITLY ABSENT — never a clean empty result', () => {
  // The body never emits. This must be distinguishable from an emitted empty payload, or V1 is repaired
  // while run 0's defect class is reintroduced one layer down.
  const silent = runIsolated({ body: 'print("I never emit")' });
  assert.equal(silent.protocol, null);
  assert.notEqual(silent.parseError, null, 'the failure to emit must be REPORTED, not inferred');

  const emptyPayload = runIsolated({ body: '_emit({})' });
  assert.deepEqual(emptyPayload.protocol, {}, 'an emitted empty object IS a result');
  assert.equal(emptyPayload.parseError, null);
  assert.notDeepEqual(silent.protocol, emptyPayload.protocol,
    'absent and empty must never be the same value');
});

test('A SUBJECT THAT CRASHES still leaves its output as evidence, and no protocol', () => {
  const r = runIsolated({ body: 'print("before the crash")' + NL + 'raise SystemExit(3)' });
  assert.equal(r.protocol, null);
  assert.match(r.subjectOut, /before the crash/);
});

test('OBSERVER TRANSPARENCY — isolation must not change what the subject computes', () => {
  // The conflicting requirement. Capturing output can alter isatty(), encoding, buffering and
  // subprocess inheritance, so a subject that BRANCHES on those would be judged in a world that does not
  // exist. Recorded here as a measurement rather than an assumption.
  const probe = 'res = {"isatty": sys.stdout.isatty(), "fileno": sys.stdout.fileno(),'
    + ' "enc": (sys.stdout.encoding or "none"), "arith": 6 * 7}' + NL + '_emit(res)';
  const r = runIsolated({ body: probe });
  assert.equal(r.protocol.arith, 42, 'computation is unaffected');
  assert.equal(typeof r.protocol.isatty, 'boolean');
  assert.equal(typeof r.protocol.fileno, 'number');
  // fileno() still WORKS - the redirection is at the descriptor level, so code calling fileno() or
  // handing the descriptor to a child does not break the way a sys.stdout swap would.
  assert.ok(r.protocol.fileno >= 0, 'a captured stream still has a real descriptor');
});

test('THE KNOWN TRANSPARENCY COST IS RECORDED RATHER THAN HIDDEN', () => {
  // isatty() is False under capture. A subject that renders differently for a terminal WILL behave
  // differently under observation. This is a real limit of the repair and it is stated, not papered over.
  const r = runIsolated({ body: '_emit({"isatty": sys.stdout.isatty()})' });
  assert.equal(r.protocol.isatty, false,
    'observation forces non-tty; subjects that branch on isatty are judged in that world');
});

test('HUGE SUBJECT OUTPUT does not starve the protocol', () => {
  const r = runIsolated({ body: 'print("y" * 5000000)' + NL + emit });
  assert.equal(r.protocol.value, 42);
  assert.ok(r.subjectBytes > 4000000, 'and the volume is measured, not truncated silently');
});
