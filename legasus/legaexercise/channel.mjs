// r4 — OBSERVER/SUBJECT CHANNEL ISOLATION.
//
// REPO C DEMONSTRATED THE VIOLATED INVARIANT (V1). Frozen r3 put the observer's protocol and the
// subject's program output on one untyped transport. 48 of 50 unobservable pyparsing runs were
// individually attributed to it. The development corpus never exercised the collision because
// `packaging`'s doctests happen to be quiet, so a MISSING ISOLATION BOUNDARY LOOKED LIKE AN OBSERVATION
// CAPABILITY.
//
//     THE SUBJECT OWNS ARBITRARY PROGRAM OUTPUT. THE OBSERVER OWNS EVIDENCE PROTOCOL.
//     THOSE ARE DIFFERENT AUTHORITIES EVEN WHEN THE OS EXPOSES BOTH AS "BYTES ON STDOUT".
//
// This is the same shape as `module:line`: a representation coarser than the authority distinction it
// carries cannot safely support that distinction. So the repair is not "capture stdout" - it is to give
// the protocol a channel the subject does not write to, and then attack the boundary.
//
// WHY NOT contextlib.redirect_stdout: it only intercepts Python-level writes through sys.stdout. It does
// not cover os.write(1, ...), C extensions writing fd 1 directly, child processes inheriting fd 1, or a
// background thread writing after the context exits. Repairing only the manifestation seen on pyparsing
// would leave the invariant violated.
//
// SO THE REDIRECTION IS AT THE FILE-DESCRIPTOR LEVEL (os.dup2), and the protocol goes to a separate file
// whose path is chosen by the observer.
//
// TWO REQUIREMENTS THAT CAN CONFLICT, AND BOTH ARE TESTED:
//     CHANNEL ISOLATION      the subject cannot corrupt evidence transport
//     OBSERVER TRANSPARENCY  observing does not materially alter the behaviour under judgement
// Fixing the first by making the subject behave differently when watched would be the classic
// instrumentation failure.
//
// THREAT MODEL, STATED: cooperative-but-noisy code. The subject may print anything, including bytes that
// look exactly like the protocol, but is not assumed to hunt for and write to the observer's private
// file. Defending against that is a different and larger problem, and pretending otherwise would be
// claiming more than this buys.
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const NL = String.fromCharCode(10);

// The isolation preamble. Runs BEFORE any subject code and returns the protocol file handle.
export const ISOLATE_SRC = [
  'import os, sys, json, io',
  '_proto_path = os.environ["LEGASUS_PROTOCOL"]',
  '_out_path = os.environ["LEGASUS_SUBJECT_OUT"]',
  '_err_path = os.environ["LEGASUS_SUBJECT_ERR"]',
  '# FD-LEVEL redirection. Covers os.write(1, ...), C extensions and inherited child descriptors, none',
  '# of which sys.stdout replacement would catch.',
  '_out_fd = os.open(_out_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC)',
  '_err_fd = os.open(_err_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC)',
  'os.dup2(_out_fd, 1)',
  'os.dup2(_err_fd, 2)',
  'sys.stdout = io.TextIOWrapper(os.fdopen(os.dup(1), "wb"), write_through=True)',
  'sys.stderr = io.TextIOWrapper(os.fdopen(os.dup(2), "wb"), write_through=True)',
  'def _emit(obj):',
  '    with open(_proto_path, "w", encoding="utf-8") as fh:',
  '        json.dump(obj, fh)',
].join(NL);

// Run a python program with the protocol on a private channel. `body` must call _emit(...) exactly once.
export function runIsolated({ body, args = [], cwd, timeoutMs = 60000, env = {} }) {
  const dir = mkdtempSync(join(tmpdir(), 'chan-'));
  const proto = join(dir, 'protocol.json');
  const out = join(dir, 'subject.out');
  const err = join(dir, 'subject.err');
  const prog = ISOLATE_SRC + NL + body;
  let threw = null;
  try {
    execFileSync('python', ['-c', prog, ...args], {
      cwd, timeout: timeoutMs, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env, PYTHONDONTWRITEBYTECODE: '1',
        LEGASUS_PROTOCOL: proto, LEGASUS_SUBJECT_OUT: out, LEGASUS_SUBJECT_ERR: err },
    });
  } catch (e) {
    threw = String((e && e.message) || e).slice(0, 200);
  }
  let protocol = null; let parseError = null;
  try {
    protocol = JSON.parse(readFileSync(proto, 'utf8'));
  } catch (e) {
    parseError = String(e.message).slice(0, 120);
  }
  const readOr = (p) => { try { return readFileSync(p, 'utf8'); } catch (e) { return ''; } };
  const subjectOut = readOr(out);
  const subjectErr = readOr(err);
  rmSync(dir, { recursive: true, force: true });
  return {
    // The protocol is EITHER present and parseable, or explicitly absent. There is no third state that
    // could be mistaken for a clean empty result.
    protocol, parseError, threw,
    // Subject output is EVIDENCE, kept rather than discarded - it is a fact about the subject.
    subjectOut, subjectErr,
    subjectBytes: subjectOut.length + subjectErr.length,
  };
}

// ASYNC variant, added for the concurrency experiment. Genuine overlap is impossible to test through a
// synchronous API, and "cannot be tested" must not be mistaken for "is safe".
export function runIsolatedAsync({ body, args = [], cwd, timeoutMs = 60000, env = {} }) {
  const dir = mkdtempSync(join(tmpdir(), 'chan-'));
  const proto = join(dir, 'protocol.json');
  const out = join(dir, 'subject.out');
  const err = join(dir, 'subject.err');
  const prog = ISOLATE_SRC + String.fromCharCode(10) + body;
  return new Promise((resolve) => {
    const child = spawn('python', ['-c', prog, ...args], {
      cwd, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env, PYTHONDONTWRITEBYTECODE: '1',
        LEGASUS_PROTOCOL: proto, LEGASUS_SUBJECT_OUT: out, LEGASUS_SUBJECT_ERR: err },
    });
    const timer = setTimeout(() => { try { child.kill(); } catch (e) { /* */ } }, timeoutMs);
    child.on('close', () => {
      clearTimeout(timer);
      let protocol = null; let parseError = null;
      try { protocol = JSON.parse(readFileSync(proto, 'utf8')); } catch (e) {
        parseError = String(e.message).slice(0, 120);
      }
      const readOr = (p) => { try { return readFileSync(p, 'utf8'); } catch (e) { return ''; } };
      const subjectOut = readOr(out); const subjectErr = readOr(err);
      rmSync(dir, { recursive: true, force: true });
      resolve({ protocol, parseError, subjectOut, subjectErr,
        subjectBytes: subjectOut.length + subjectErr.length, pid: child.pid });
    });
  });
}
