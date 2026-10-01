/**
 * snapshotPath.test.mjs - the shared "Git internals" predicate (D-COPY-1).   node server/snapshotPath.test.mjs
 */
import { isGitComponent, isExcludedRelPath } from './snapshotPath.mjs';

let passed = 0, failed = 0;
const ok = (c, m) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${m}`); c ? passed++ : failed++; };

console.log('snapshotPath - exact component, relative path');
const EXCLUDED = ['.git', '.git/objects/ab/cdef', 'nested/.git/HEAD', 'a\\.git\\b', 'deep/er/.git'];
const INCLUDED = ['.gitignore', '.gitattributes', '.github/workflows/ci.yml', 'foo.git', '.gitconfig',
  'nested/.github/x.yml', 'src/a.js', '', 'git', '.GIT', 'a\\.github\\b', '.git-blame-ignore-revs'];
for (const p of EXCLUDED) ok(isExcludedRelPath(p) === true, `excluded: ${JSON.stringify(p)}`);
for (const p of INCLUDED) ok(isExcludedRelPath(p) === false, `included: ${JSON.stringify(p)}`);
ok(isGitComponent('.git') && !isGitComponent('.gitignore') && !isGitComponent('.git '), 'isGitComponent is exact equality');

console.log('snapshotPath - absolute paths are refused, never judged');
for (const p of ['C:\\work\\.gitlab-runner\\ws\\a.js', 'C:/x/.git', '/home/u/.git/x', '\\\\server\\share\\x']) {
  let threw = false; try { isExcludedRelPath(p); } catch { threw = true; }
  ok(threw, `absolute refused: ${JSON.stringify(p)}`);
}
let typeErr = false; try { isExcludedRelPath(null); } catch (e) { typeErr = e instanceof TypeError; }
ok(typeErr, 'a non-string is a TypeError');

console.log('');
console.log(`  ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
