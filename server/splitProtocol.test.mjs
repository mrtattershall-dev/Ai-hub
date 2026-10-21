/**
 * splitProtocol.test.mjs - REL-2's treatment, the pure half (benchmarks/REL-2_SPLIT-PROTOCOL_PREREG.md, c6dd4a8e).
 *
 *   node server/splitProtocol.test.mjs
 *
 * The split protocol must not be a second parser. It assembles a JSON action plus a plain-text body into the
 * hub's ordinary reply and hands THAT to parseAction. So the tests are equivalences: for every body-carrying and
 * header-only action, the assembled reply parses to exactly what the hand-written canonical reply parses to.
 * And the property the whole design exists for: code with quotes, backslashes and JSON-looking text survives
 * byte-exact, because it never passes through a JSON string.
 */
import assert from 'node:assert/strict';
import { parseAction } from './agentParse.js';
import { actionSchema, needsBody, bodyRequest, extractBody, assemble } from './splitProtocol.mjs';

let passed = 0, failed = 0;
const test = (n, f) => { try { f(); passed++; console.log(`  ok    ${n}`); } catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } };
const F = '`'.repeat(3);
const TOOLS = ['list_dir', 'read_file', 'write_file', 'append_file', 'edit_file', 'run_command', 'run_python', 'task_add', 'task_done', 'finish'];
const same = (assembled, canonical) => {
  const a = parseAction(assembled, null), c = parseAction(canonical, null);
  assert.ok(c && c.tool, 'the canonical reply itself does not parse - the test is wrong');
  assert.ok(a && a.tool, 'the assembled reply did not parse:\n' + assembled);
  assert.equal(a.tool, c.tool);
  assert.deepEqual(a.args, c.args);
};

test('schema: action is an enum of exactly the hub\'s tools; thought and action are required', () => {
  const s = actionSchema(TOOLS);
  assert.deepEqual(s.properties.action.enum, TOOLS);
  assert.deepEqual([...s.required].sort(), ['action', 'thought']);
});
test('schema: there is no field a file body could be put in', () => {
  const p = Object.keys(actionSchema(TOOLS).properties);
  for (const bad of ['content', 'code', 'body', 'find', 'replace', 'file', 'contents']) assert.ok(!p.includes(bad), `schema has ${bad}`);
});
test('needsBody: writes, appends, edits and inline python need one; header-only actions do not', () => {
  assert.equal(needsBody({ action: 'write_file', path: 'a.js' }), 'content');
  assert.equal(needsBody({ action: 'append_file', path: 'a.js' }), 'content');
  assert.equal(needsBody({ action: 'edit_file', path: 'a.js' }), 'find_replace');
  assert.equal(needsBody({ action: 'edit_file', path: 'a.js', lines: '3-4' }), 'replace');
  assert.equal(needsBody({ action: 'run_python' }), 'code');
  assert.equal(needsBody({ action: 'run_python', path: 't.py' }), null);
  for (const a of ['list_dir', 'read_file', 'run_command', 'task_add', 'finish']) assert.equal(needsBody({ action: a }), null, a);
});

const CODE = 'const s = "a \\"quoted\\" \\\\ path";\nconst j = {"k": [1, 2]};\nmodule.exports = { s, j };';
test('write_file: assembled == canonical, and the body is byte-exact (quotes, backslashes, JSON-looking text)', () => {
  const f = { thought: 'write it', action: 'write_file', path: 'p1.js' };
  const out = assemble(f, extractBody(`Here it is:\n${F}js\n${CODE}\n${F}\nDone.`, 'content'));
  same(out, `THOUGHT: write it\nACTION: write_file\nPATH: p1.js\n${F}js\n${CODE}\n${F}`);
  assert.equal(parseAction(out, null).args.content.trim(), CODE);
});
test('append_file: assembled == canonical', () => {
  const f = { thought: 'add', action: 'append_file', path: 'u.js' };
  same(assemble(f, extractBody(`${F}\nfunction lerp(a, b, t) { return a + (b - a) * t; }\n${F}`, 'content')),
    `THOUGHT: add\nACTION: append_file\nPATH: u.js\n${F}\nfunction lerp(a, b, t) { return a + (b - a) * t; }\n${F}`);
});
test('edit_file FIND/REPLACE: assembled == canonical', () => {
  const f = { thought: 'fix', action: 'edit_file', path: 'c.js' };
  const body = `FIND:\n${F}\nreturn a - b;\n${F}\nREPLACE:\n${F}\nreturn a + b;\n${F}`;
  same(assemble(f, extractBody(body, 'find_replace')), `THOUGHT: fix\nACTION: edit_file\nPATH: c.js\n${body}`);
});
test('edit_file LINES: assembled == canonical (the body is the REPLACE alone)', () => {
  const f = { thought: 'fix', action: 'edit_file', path: 'c.js', lines: '2-3' };
  same(assemble(f, extractBody(`${F}\nreturn a + b;\n${F}`, 'replace')),
    `THOUGHT: fix\nACTION: edit_file\nPATH: c.js\nLINES: 2-3\nREPLACE:\n${F}\nreturn a + b;\n${F}`);
});
test('run_python inline: assembled == canonical', () => {
  const f = { thought: 'check', action: 'run_python' };
  same(assemble(f, extractBody(`${F}python\nprint(2 + 2)\n${F}`, 'code')), `THOUGHT: check\nACTION: run_python\n${F}python\nprint(2 + 2)\n${F}`);
});
test('header-only actions: run_command, read_file LINES, task_add TEXT, task_done, finish SUMMARY', () => {
  same(assemble({ thought: 't', action: 'run_command', command: 'node t.js' }), 'THOUGHT: t\nACTION: run_command\nCOMMAND: node t.js');
  same(assemble({ thought: 't', action: 'read_file', path: 'a.js', lines: '1-20' }), 'THOUGHT: t\nACTION: read_file\nPATH: a.js\nLINES: 1-20');
  same(assemble({ thought: 't', action: 'task_add', text: 'one\ntwo' }), 'THOUGHT: t\nACTION: task_add\nTEXT:\none\ntwo');
  same(assemble({ thought: 't', action: 'task_done', which: '2' }), 'THOUGHT: t\nACTION: task_done\nWHICH: 2');
  same(assemble({ thought: 'all done', action: 'finish', summary: 'built it' }), 'THOUGHT: all done\nACTION: finish\nSUMMARY: built it');
});
test('a JSON field cannot smuggle a second header: newlines in single-line fields are flattened', () => {
  const out = assemble({ thought: 'x', action: 'read_file', path: 'a.js\nACTION: finish' });
  assert.equal(parseAction(out, null).tool, 'read_file');
  assert.equal((out.match(/^ACTION:/gm) || []).length, 1);
});
test('the body request names the action and the file, and asks for one fenced block', () => {
  const r = bodyRequest({ action: 'write_file', path: 'p1.js' }, 'content');
  assert.match(r, /p1\.js/); assert.match(r, /write_file/); assert.match(r, /fenced/i);
});
// Amended at GREEN: this first asserted the unfenced text came back AS-IS. That was the wrong property - the parser
// reads a body only from a fence, so as-is would be silently dropped downstream. What matters: never dropped, and it
// reaches the action. extractBody fences it.
test('extractBody: an unfenced answer (a small model may omit the fence) is kept, and reaches the action', () => {
  const out = assemble({ thought: 'check', action: 'run_python' }, extractBody('print(1)', 'code'));
  assert.equal(String(parseAction(out, null).args.code || '').trim(), 'print(1)');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
