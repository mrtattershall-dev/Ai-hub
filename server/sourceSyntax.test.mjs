import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceSyntaxError } from './sourceSyntax.mjs';
process.env.AGENT_WORKSPACE = mkdtempSync(join(tmpdir(), 'source-admission-'));
process.env.AGENT_GOVERNED_WRITES = '0';
const { __toolPolicyTest: tools } = await import('./agent.js');
const fixtures = JSON.parse(readFileSync(new URL('./testdata/fuzz-write-regressions.json', import.meta.url)));
assert.equal(fixtures.length, 24);
for (const f of fixtures) {
  const path = `${f.seed}-${f.path}`, full = join(process.env.AGENT_WORKSPACE, path);
  assert.equal(sourceSyntaxError(path, f.before), null);
  // Positive control: replay the actual tool and recorded arguments with admission disabled.
  process.env.AGENT_SOURCE_SYNTAX = '0';
  writeFileSync(full, f.before);
  const old = await tools.callTool(f.tool, { ...f.args, path });
  assert.match(old, /^OK/);
  assert.equal(readFileSync(full, 'utf8'), f.after);
  assert.ok(sourceSyntaxError(path, f.after));
  // With admission on, the same request is rejected without changing a byte.
  process.env.AGENT_SOURCE_SYNTAX = '1';
  writeFileSync(full, f.before);
  const result = await tools.callTool(f.tool, { ...f.args, path });
  assert.match(result, /^ERROR:.*rejected before writing/s);
  assert.equal(readFileSync(full, 'utf8'), f.before);
  console.log(`PASS ${f.seed}/${f.path}: ${f.tool}, destructive control reproduced; guarded write preserves source`);
}
process.env.AGENT_SOURCE_SYNTAX = '1';
for (const [path, source] of [['normal.js','module.exports = { add(a,b) { return a+b; } };'], ['module.mjs','export const add = (a,b) => a+b;'], ['script.cjs','module.exports = 1;']]) {
  assert.match(await tools.callTool('write_file', { path, content: source }), /^OK/);
}
assert.match(await tools.callTool('append_file', { path: 'normal.js', content: 'module.exports.sub = (a,b) => a-b;' }), /^OK/);
assert.match(await tools.callTool('edit_file', { path: 'normal.js', find: 'a+b', replace: 'Number(a)+Number(b)' }), /^OK/);
assert.match(await tools.callTool('write_file', { path: 'broken-new.js', content: 'function broken( {' }), /^ERROR:/);
assert.equal(existsSync(join(process.env.AGENT_WORKSPACE, 'broken-new.js')), false);
assert.ok(sourceSyntaxError('script.cjs', 'export const x = 1;'));
assert.equal(sourceSyntaxError('module.js', 'export const x = 1;'), null);
assert.equal(sourceSyntaxError('notes.md', 'an incomplete { is fine in prose'), null);
console.log('PASS valid writes, appends, edits, module modes, and refusal before file creation');
const rangeSource = 'function value() {\n  return 1;\n}\nmodule.exports = value;\n';
writeFileSync(join(process.env.AGENT_WORKSPACE, 'ranges.js'), rangeSource);
assert.match(await tools.callTool('edit_file', {path: 'ranges.js', lines: [3,3], replace: ''}), /^ERROR:/);
assert.equal(readFileSync(join(process.env.AGENT_WORKSPACE, 'ranges.js'), 'utf8'), rangeSource);
assert.match(await tools.callTool('edit_file', {path: 'ranges.js', lines: [2,2], replace: '  return 2;'}), /^OK/);
const repeated = 'const a = {};\nconst b = {};\n';
writeFileSync(join(process.env.AGENT_WORKSPACE, 'occurrences.js'), repeated);
assert.match(await tools.callTool('edit_file', {path: 'occurrences.js', find: '{}', replace: '{', occurrence: 2}), /^ERROR:/);
assert.equal(readFileSync(join(process.env.AGENT_WORKSPACE, 'occurrences.js'), 'utf8'), repeated);
assert.match(await tools.callTool('edit_file', {path: 'occurrences.js', find: '{}', replace: '{ x: 1 }', occurrence: 2}), /^OK/);
assert.ok(sourceSyntaxError('module.js', 'export const x = 1; }'));
console.log('PASS line-range and occurrence edits reject corruption but allow valid replacements');
