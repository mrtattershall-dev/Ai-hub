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
const src = readFileSync(join(SRV, 'cid1.mjs'), 'utf8');
const test = readFileSync(join(SRV, 'cid1.test.mjs'), 'utf8');
const mutants = [
  ['no length prefix on path (delimiter framing)', "Buffer.from('F'), u64(p.length), p, u64(e.bytes.length)", "Buffer.from('F'), p, Buffer.from([0]), u64(e.bytes.length)"],
  ['delimiter text framing (tab/newline, no lengths)', "return { p, body: Buffer.concat([Buffer.from('F'), u64(p.length), p, u64(e.bytes.length), sha256(e.bytes)]) };", "return { p, body: Buffer.from(`F\\t${e.path}\\t${sha256(e.bytes).toString('hex')}\\n`) };"],
  ['prefix exclusion of .git (the batch.js bug)', "if (name === '.git') continue;", "if (name.startsWith('.git')) continue;"],
  ['domain dropped from digest', 'h.update(CID1_DOMAIN); h.update(u64(enc.length));', 'h.update(u64(enc.length));'],
  ['entries not sorted', 'enc.sort((a, b) => Buffer.compare(a.p, b.p));', ''],
];
let allCaught = true;
for (const [name, from, to] of mutants) {
  if (!src.includes(from)) { console.log(`APPARATUS: pattern not found for "${name}"`); allCaught = false; continue; }
  const d = mkdtempSync(join(tmpdir(), 'cid1mut-'));
  writeFileSync(join(d, 'cid1.mjs'), src.replace(from, to));
  writeFileSync(join(d, 'cid1.test.mjs'), test);
  let caught = false, out = '';
  try { out = execFileSync(process.execPath, [join(d, 'cid1.test.mjs')], { encoding: 'utf8' }); } catch (e) { caught = true; out = String(e.stdout); }
  const fails = out.split('\n').filter((l) => l.includes('FAIL  ')).map((l) => l.trim().slice(6));
  console.log(`${caught ? 'CAUGHT ' : 'ESCAPED'}  ${name}${fails.length ? '  <- ' + fails.join(' | ') : ''}`);
  if (!caught) allCaught = false;
  rmSync(d, { recursive: true, force: true });
}
console.log(allCaught ? 'ALL MUTANTS CAUGHT' : 'A MUTANT ESCAPED');
