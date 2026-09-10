/**
 * lineNumberStrip.test.mjs - models copy read_file's "19: " prefixes back into code.
 *
 *   node server/lineNumberStrip.test.mjs
 *
 * Found by fuzzing the loop with recorded real model output. A file was left on disk as
 *
 *     19:   function zip(a, b) {
 *     20:     return a.map((val, i) => [val, b[i]]);
 *
 * - lines copied out of a read_file result with the line numbers still on. It will not parse,
 * and because that was the file's only version, the syntax rollback had nothing to go back
 * to. The prompt has said "do NOT include the N: prefix" for a long time. The model does it
 * anyway, so the parser strips it.
 *
 * Half of these tests are cases where the strip must NOT fire. Code legitimately starts lines
 * with digits, and a strip that corrupts an object literal is worse than the bug it fixes.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripLineNumberPrefixes as strip, parseAction } from './agentParse.js';

const HERE = dirname(fileURLToPath(import.meta.url));
let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};
const parses = (code) => {
  const f = join(mkdtempSync(join(tmpdir(), 'lns-')), 'x.js');
  writeFileSync(f, code, 'utf8');
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe', timeout: 10000 }); return true; } catch { return false; }
};
const fence = (lang, body) => '```' + lang + '\n' + body + '\n```';

console.log('\nline-number prefix strip\n');

// ── it must fire ─────────────────────────────────────────────────────────────
test('the real q3_list.js shape is repaired and then parses', () => {
  const leaked = [
    '18: const list = {',
    '19:   zip(a, b) {',
    '20:     return a.map((val, i) => [val, b[i]]);',
    '21:   },',
    '22: };',
  ].join('\n');
  assert.equal(parses(leaked), false, 'fixture should be broken before the strip, or this proves nothing');
  const fixed = strip(leaked);
  assert.equal(parses(fixed), true, `still does not parse after the strip:\n${fixed}`);
  assert.match(fixed, /^const list = \{/m, 'prefix not removed');
  assert.match(fixed, /^ {2}zip\(a, b\) \{/m, 'original indentation was not preserved');
});

test('the FIND-miss hint format "      19| code" is stripped too', () => {
  const leaked = '      19| function add(a, b) {\n      20|   return a + b;\n      21| }';
  assert.equal(strip(leaked), 'function add(a, b) {\n  return a + b;\n}');
});

test('blank lines inside a leaked block survive', () => {
  assert.equal(strip('19: a();\n20: \n21: b();'), 'a();\n\nb();');
});

// ── it must NOT fire ─────────────────────────────────────────────────────────
test('ordinary code is returned byte-identical', () => {
  const code = 'function add(a, b) {\n  return a + b;\n}\nmodule.exports = { add };';
  assert.equal(strip(code), code);
});

test('an object literal with numeric keys is NOT touched', () => {
  // The exact false positive this has to avoid. Indented keys never match the column-0 form.
  const code = "  1: 'one',\n  2: 'two',\n  3: 'three',";
  assert.equal(strip(code), code, 'corrupted a legitimate object literal');
});

test('a block where only SOME lines carry a prefix is left alone', () => {
  const code = '19: const a = 1;\nconst b = 2;';
  assert.equal(strip(code), code, 'a partial match must not strip - that is not a read_file dump');
});

test('numbers that do not ascend are left alone', () => {
  const code = '5: const a = 1;\n3: const b = 2;';
  assert.equal(strip(code), code, 'descending numbers are not line numbers');
});

test('non-strings pass straight through', () => {
  assert.equal(strip(undefined), undefined);
  assert.equal(strip(''), '');
});

// ── wired into the parser ────────────────────────────────────────────────────
test('write_file content arriving with prefixes is stripped before it is written', () => {
  const r = parseAction(`THOUGHT: x\nACTION: write_file\nPATH: a.js\n${fence('javascript', '1: const a = 1;\n2: const b = 2;')}`, null);
  assert.equal(r.args.content, 'const a = 1;\nconst b = 2;');
});

test('an edit_file FIND copied with its prefix now matches the real file', () => {
  // The file on disk has no prefixes, so a prefixed FIND can never match - that is a FIND
  // miss the model then retries. Stripping it turns a guaranteed miss into a working edit.
  const text = [
    'THOUGHT: fixing it', 'ACTION: edit_file', 'PATH: m.js',
    'FIND:', fence('', '12:   return a + b;'),
    'REPLACE:', fence('', '  return a - b;'),
  ].join('\n');
  const r = parseAction(text, null);
  assert.equal(r.tool, 'edit_file');
  assert.equal(r.args.find, '  return a + b;', `FIND still carries its prefix: ${JSON.stringify(r.args.find)}`);
});

// ── against the corpus ───────────────────────────────────────────────────────
const CORPUS = join(HERE, 'testdata', 'model-corpus.jsonl');
if (existsSync(CORPUS)) {
  test('CORPUS: how often real replies leak line numbers, and the strip never changes the TOOL', () => {
    const rows = readFileSync(CORPUS, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    let leaked = 0;
    for (const r of rows) {
      const m = r.text.match(/```[^\n]*\n([\s\S]*?)```/);
      if (m && strip(m[1]) !== m[1]) leaked++;
      const out = parseAction(r.text, 'prior.js');
      const tool = (r.text.match(/ACTION:\s*([a-z_]+)/i) || [])[1];
      if (out && tool && out.tool !== tool.toLowerCase() && !(out.tool === 'write_file' && tool === 'edit_file')) {
        throw new Error(`strip changed which tool was parsed: ${tool} -> ${out.tool}`);
      }
    }
    console.log(`        ${leaked} of ${rows.length} recorded replies carry a fenced block with leaked line numbers`);
  });
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
