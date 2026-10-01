// cid1.mutants.mjs - mutation check for cid1.test.mjs: each mutant breaks ONE frozen guarantee and
// the test suite must FAIL against it.   node server/cid1.mutants.mjs
//
// EXPECTED: "no length prefix on path" ESCAPES. It is an EQUIVALENT mutant, recorded as such, not a
// caught one: NUL termination is unambiguous for filesystem paths (which cannot contain NUL), and a
// forgery would need a path whose UTF-8 reproduces a raw sha256 digest. The tab/newline TEXT framing
// mutant is the real ambiguity, and it must be CAUGHT.
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SRV = dirname(fileURLToPath(import.meta.url));
// Every module the tests load is copied, so a mutant runs the real dependency graph. (When cid1.mjs
// began importing snapshotPath.mjs, a copy of cid1.mjs alone would have CRASHED on the import - and a
// crash must never count as a kill.)
const FILES = ['cid1.mjs', 'snapshotPath.mjs', 'cid1.test.mjs'];
const orig = Object.fromEntries(FILES.map((f) => [f, readFileSync(join(SRV, f), 'utf8')]));
const mutants = [
  ['no length prefix on path (delimiter framing)', 'cid1.mjs', "Buffer.from('F'), u64(p.length), p, u64(e.bytes.length)", "Buffer.from('F'), p, Buffer.from([0]), u64(e.bytes.length)"],
  ['delimiter text framing (tab/newline, no lengths)', 'cid1.mjs', "return { p, body: Buffer.concat([Buffer.from('F'), u64(p.length), p, u64(e.bytes.length), sha256(e.bytes)]) };", "return { p, body: Buffer.from(`F\\t${e.path}\\t${sha256(e.bytes).toString('hex')}\\n`) };"],
  ['prefix exclusion of .git (the batch.js bug)', 'snapshotPath.mjs', "export const isGitComponent = (name) => name === '.git';", "export const isGitComponent = (name) => name.startsWith('.git');"],
  ['domain dropped from digest', 'cid1.mjs', 'h.update(CID1_DOMAIN); h.update(u64(enc.length));', 'h.update(u64(enc.length));'],
  ['entries not sorted', 'cid1.mjs', 'enc.sort((a, b) => Buffer.compare(a.p, b.p));', ''],
];
let allCaught = true;
for (const [name, file, from, to] of mutants) {
  if (!orig[file].includes(from)) { console.log(`APPARATUS: pattern not found in ${file} for "${name}"`); allCaught = false; continue; }
  const d = mkdtempSync(join(tmpdir(), 'cid1mut-'));
  for (const f of FILES) writeFileSync(join(d, f), f === file ? orig[f].replace(from, to) : orig[f]);
  let exited = false, out = '';
  try { out = execFileSync(process.execPath, [join(d, 'cid1.test.mjs')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { exited = true; out = String(e.stdout); }
  const fails = out.split('\n').filter((l) => l.includes('FAIL  ')).map((l) => l.trim().slice(6));
  // CAUGHT only when a NAMED test fails. A non-zero exit with no FAIL line is a crash - apparatus.
  const status = exited && fails.length ? 'CAUGHT ' : exited ? 'APPARATUS (crashed, no test failed)' : 'ESCAPED';
  console.log(`${status}  ${name}${fails.length ? '  <- ' + fails.join(' | ') : ''}`);
  if (status !== 'CAUGHT ') allCaught = false;
  rmSync(d, { recursive: true, force: true });
}
console.log(allCaught ? 'ALL MUTANTS CAUGHT' : 'A MUTANT ESCAPED');
