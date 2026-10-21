import assert from 'node:assert/strict';
import { duplicateTopLevel } from './duplicateDecls.js';

assert.deepEqual(duplicateTopLevel('functionRun();\nfunctionRun();\n', 'a.js'), []);
// real duplicates are still found
assert.deepEqual(duplicateTopLevel('function a() {}\nfunction* a() {}\n', 'a.js'), [{ name: 'a', lines: [1, 2] }]);
console.log('ok');
