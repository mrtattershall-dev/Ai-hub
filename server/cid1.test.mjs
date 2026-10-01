/**
 * cid1.test.mjs - properties of cid1 that the metamorphic suite (did1.regression.mjs) does not reach:
 * framing, ordering, domain separation, purity, and fail-closed refusal.
 *
 *   node server/cid1.test.mjs
 */
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, statSync, utimesSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { cid1, identityOf, CID1_DOMAIN } from './cid1.mjs';

let passed = 0, failed = 0;
const ok = (c, m) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${m}`); c ? passed++ : failed++; };
const F = (path, s) => ({ type: 'F', path, bytes: Buffer.from(s) });
const temps = [];
const mk = () => { const d = mkdtempSync(join(tmpdir(), 'cid1t-')); temps.push(d); return d; };

console.log('cid1 - framing');
// Delimiter forgery: if entries were joined with a separator, a path containing that separator could
// make two different entry sets serialize identically. Length prefixes make that impossible.
{
  // A REAL forgery, equal entry counts: under a delimiter framing "F\t<path>\t<sha-hex>\n" these
  // two DIFFERENT entry sets serialize to byte-identical text, because a path may contain \t and \n.
  // (An earlier version of this test compared sets of different SIZE, which differ under any framing
  // because the count is hashed - a NUL-terminated mutant escaped it.)
  const hx = (s) => createHash('sha256').update(Buffer.from(s)).digest('hex');
  const S = [F('a', 'X'), F(`b\t${hx('Y')}\nF\tc`, 'Z')];
  const T = [F(`a\t${hx('X')}\nF\tb`, 'Y'), F('c', 'Z')];
  const text = (es) => es.map((e) => `F\t${e.path}\t${hx(e.bytes)}\n`).join('');
  ok(text(S) === text(T), 'apparatus: the two sets really collide under delimiter framing');
  ok(identityOf(S) !== identityOf(T), 'length-prefixed framing separates a delimiter forgery with equal counts');
}
ok(identityOf([F('a b', 'c')]) !== identityOf([F('a', 'b c')]), 'path/content boundary cannot be shifted by a space');
ok(identityOf([F('ab', '')]) !== identityOf([F('a', 'b')]), 'moving bytes from path into content changes the identity');
ok(identityOf([F('a', 'x')]) !== identityOf([{ type: 'L', path: 'a', target: 'x' }]), 'a file and a symlink with the same text differ');
ok(identityOf([]) !== identityOf([F('', '')]), 'empty snapshot differs from one empty-named empty file');

console.log('cid1 - ordering and domain');
ok(identityOf([F('b', '2'), F('a', '1')]) === identityOf([F('a', '1'), F('b', '2')]), 'identity is independent of entry order');
ok(identityOf([F('B', '1')]) !== identityOf([F('b', '1')]), 'paths are case-sensitive bytes (no case folding)');
ok(identityOf([F('é', '1')]) !== identityOf([F('é', '1')]), 'no Unicode normalization (NFC vs NFD differ)');
{
  // the domain is IN the digest: recompute the empty identity by hand from the documented encoding
  const h = createHash('sha256'); h.update(CID1_DOMAIN); h.update(Buffer.alloc(8));
  ok(identityOf([]) === 'cid1:' + h.digest('hex'), 'empty identity = sha256(DOMAIN || u64(0)) - the version domain is hashed');
  const bare = createHash('sha256').update(Buffer.alloc(8)).digest('hex');
  ok(identityOf([]) !== 'cid1:' + bare, 'dropping the domain gives a different digest');
}

console.log('cid1 - refusals (fail closed, never a skip)');
let threw = null; try { identityOf([F('bad\uD800', 'x')]); } catch (e) { threw = e.message; }
ok(/well-formed/.test(String(threw)), 'a lone surrogate in a path is refused, not encoded as U+FFFD');
threw = null; try { identityOf([F('a', 'x'), F('a', 'y')]); } catch (e) { threw = e.message; }
ok(/share one path/.test(String(threw)), 'two entries with one path encoding are refused');
{
  const r = cid1(join(tmpdir(), 'cid1-does-not-exist-' + Date.now()));
  ok(r.ok === false && /readdir/.test(r.reason), 'an unreadable root is a refusal object, not a throw');
}

console.log('cid1 - filesystem semantics');
{
  const d = mk();
  writeFileSync(join(d, 'a.txt'), 'A\n');
  mkdirSync(join(d, '.git')); writeFileSync(join(d, '.git', 'HEAD'), 'x');
  const base = cid1(d);
  ok(base.ok && base.entries === 1, '.git is excluded (one entry counted)');
  writeFileSync(join(d, '.git', 'HEAD'), 'changed');
  ok(cid1(d).id === base.id, 'changing .git contents leaves the identity unchanged');
  writeFileSync(join(d, '.gitignore'), '*.log\n');
  const g = cid1(d);
  ok(g.ok && g.id !== base.id && g.entries === 2, '.gitignore is INCLUDED (exact-component exclusion, not prefix)');
  mkdirSync(join(d, 'sub', '.git'), { recursive: true }); writeFileSync(join(d, 'sub', '.git', 'x'), 'nested');
  ok(cid1(d).id === g.id, 'a nested .git directory is excluded too');
  mkdirSync(join(d, 'empty'));
  ok(cid1(d).id === g.id, 'an empty directory does not change the identity (declared blind spot)');
  writeFileSync(join(d, 'a.txt'), 'A\r\n');
  ok(cid1(d).id !== g.id, 'CRLF vs LF changes the identity (exact bytes)');
}
{
  // PURITY: the observer writes nothing - entry set, bytes and mtimes are unchanged, no .git appears
  const d = mk();
  writeFileSync(join(d, 'f.txt'), 'pure\n');
  const t = new Date(2001, 0, 1); utimesSync(join(d, 'f.txt'), t, t);
  const before = readdirSync(d).join(',');
  const r1 = cid1(d), r2 = cid1(d);
  ok(r1.ok && r1.id === r2.id, 'deterministic across two calls');
  ok(readdirSync(d).join(',') === before && !existsSync(join(d, '.git')), 'creates nothing (no .git, no temp files)');
  ok(statSync(join(d, 'f.txt')).mtimeMs === t.getTime(), 'modifies nothing (mtime untouched)');
}
{
  // identical snapshots in unrelated locations
  const a = mk(), b = join(mk(), 'deep', 'er'); mkdirSync(b, { recursive: true });
  for (const d of [a, b]) { writeFileSync(join(d, 'x.js'), 'module.exports=1;\n'); mkdirSync(join(d, 'lib')); writeFileSync(join(d, 'lib', 'y.js'), 'y'); }
  ok(cid1(a).id === cid1(b).id, 'identical snapshots at different absolute paths share an identity');
}

for (const d of temps) { try { rmSync(d, { recursive: true, force: true }); } catch {} }
console.log('');
console.log(`  ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
