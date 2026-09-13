/**
 * destructiveWritePython.test.mjs - the destructive-write guard must cover Python and Godot too.
 *
 *   node server/destructiveWritePython.test.mjs
 *
 * THE DEFECT, found 2026-09-12 reading write_file cold.
 *
 *     const CODEISH = { html: ..., js: ..., mjs: ..., css: ..., json: ... }[ext];
 *     const looksLikeCode = !CODEISH || CODEISH.test(content);
 *     if (shrank && !looksLikeCode) refuse
 *
 * For any extension NOT in that map - py, gd, and everything else - CODEISH is undefined, so
 * `!CODEISH` is true, `looksLikeCode` is true, and the refusal is unreachable. The guard exists
 * because "the 32B wrote 158 bytes of English prose about a User class over a working 1,040-byte
 * Phaser page - hallucinated content, unrelated to the goal, and the game was gone."
 *
 * Python is not hypothetical in this archive. agent.js itself cites s6_graph.py (set I goal 16) and
 * q8_units.py (set E goal 8); set G's corruption of s6_graph.py took 50 of 100 hidden checks with it.
 * Every one of those files was written by a guard that could not see it.
 *
 * WHAT THIS DOES NOT CHANGE, and the controls that pin it: the permissive default for genuinely
 * unknown extensions is correct - prose IS valid content for a .txt or .md file, and refusing there
 * would break legitimate writes. Only the languages the hub actually builds in are added. A
 * legitimate SHRINKING rewrite in real Python must still be allowed, because a refusal a caller
 * cannot get past is a loop - that is the lesson from the tolerant-matcher deadlock.
 *
 * RED-FIRST: cases 1 and 2 FAIL before the fix (the write is allowed and the file is destroyed);
 * cases 3-6 pass both before and after, and exist so a fix that simply refuses more cannot pass.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.AGENT_WORKSPACE = mkdtempSync(join(tmpdir(), 'destrpy-'));
const WS = process.env.AGENT_WORKSPACE;

const { __toolPolicyTest } = await import('./agent.js');
const write = (path, content) => String(__toolPolicyTest.callTool('write_file', { path, content }));
const read = (path) => readFileSync(join(WS, path), 'utf8');

let passed = 0, failed = 0;
const test = (n, f) => {
  try { f(); passed++; console.log('  ok    ' + n); }
  catch (e) { failed++; console.error('  FAIL  ' + n + '\n        ' + String(e.message).split('\n').slice(0, 4).join('\n        ')); }
};

/** >400 bytes of real Python, so `shrank` can apply at all (before.length > 400). */
const REAL_PY = `class Graph:
    def __init__(self):
        self.nodes = {}
        self.edges = []

    def add_node(self, name, weight=1):
        if not isinstance(name, str):
            raise TypeError("node name must be a string")
        self.nodes[name] = weight
        return self

    def add_edge(self, a, b, cost=1.0):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("both endpoints must exist before adding an edge")
        self.edges.append((a, b, cost))
        return self

    def neighbours(self, name):
        return [b for (a, b, _c) in self.edges if a == name]
`;

// MEASURED, not assumed. The first version of this fixture was 342 bytes, and `shrank` requires
// before.length > 400 - so the guard correctly did NOT fire and the test reported a failure in the
// FIX when the fault was in the fixture. The premise is asserted below now, exactly as it already
// was for REAL_PY. A test whose premise is never checked reports on the wrong thing.
const REAL_GD = `extends Node2D

var speed := 200.0
var health := 100
var facing := 1

func _ready() -> void:
    set_process(true)
    print("ready")

func _process(delta: float) -> void:
    position.x += speed * delta * facing
    if position.x > 640.0:
        position.x = 0.0

func take_damage(amount: int) -> void:
    health -= amount
    if health <= 0:
        queue_free()

func heal(amount: int) -> void:
    health = min(health + amount, 100)

func turn_around() -> void:
    facing = -facing
`;

const PROSE = 'This module defines a Graph class that stores nodes and edges for the project.';

console.log('\nthe destructive-write guard covers python and godot, not only web files\n');

test('THE BUG: prose must not silently replace a working .py file', () => {
  write('s6_graph.py', REAL_PY);
  assert.ok(REAL_PY.length > 400, 'premise: the original is big enough for `shrank` to apply');
  const r = write('s6_graph.py', PROSE);
  assert.match(r, /^ERROR/, `the write should have been refused, got: ${r.slice(0, 120)}`);
  assert.equal(read('s6_graph.py'), REAL_PY, 'and the working file must still be on disk, untouched');
});

test('THE BUG: prose must not silently replace a working .gd file', () => {
  write('player.gd', REAL_GD);
  assert.ok(REAL_GD.length > 400, `premise: the original must clear the 400-byte floor (got ${REAL_GD.length})`);
  const r = write('player.gd', 'This script moves the player to the right and handles damage.');
  assert.match(r, /^ERROR/, `the write should have been refused, got: ${r.slice(0, 120)}`);
  assert.equal(read('player.gd'), REAL_GD, 'the .gd file must be untouched');
});

test('CONTROL: a legitimate SHRINKING rewrite in real Python is still allowed', () => {
  write('shrink_ok.py', REAL_PY);
  // A third of the size, and unmistakably Python. A guard that refused this would deadlock a
  // legitimate simplification - exactly the failure the tolerant-matcher refusal already caused.
  const smaller = 'def neighbours(graph, name):\n    return [b for (a, b, _c) in graph.edges if a == name]\n';
  const r = write('shrink_ok.py', smaller);
  assert.match(r, /^OK/, `real python must still be writable, got: ${r.slice(0, 160)}`);
  assert.equal(read('shrink_ok.py'), smaller, 'and it must actually have been written');
});

test('CONTROL: a genuinely unknown extension stays permissive - prose IS valid in a .txt', () => {
  write('notes.txt', REAL_PY);            // >400 bytes of something
  const r = write('notes.txt', 'Short note replacing the old one.');
  assert.match(r, /^OK/, `.txt must not be gated, got: ${r.slice(0, 160)}`);
});

test('CONTROL: .md stays permissive too', () => {
  write('README.md', REAL_PY);
  const r = write('README.md', 'A shorter readme.');
  assert.match(r, /^OK/, `.md must not be gated, got: ${r.slice(0, 160)}`);
});

/**
 * THE js ROW KEYS ON WORDS THAT PROSE ABOUT CODE ALSO USES.
 *
 * Logged when the py/gd rows were added and left alone then, deliberately, so that change could not
 * move destructiveWrite's baseline. Picking it up now, having checked what that baseline actually
 * covers: all 8 of its tests are about DEFINITION LOSS (lostDefs / lostExports), none of them
 * exercises the CODEISH prose guard at all. So the js row is essentially untested and safe to correct.
 *
 * The row tests for \bclass\b, \bfunction\b, \bconst\b, \blet\b, \bvar\b. English prose ABOUT code
 * contains those words constantly - and the incident this whole guard was built for was, in the
 * original comment's words, "158 bytes of English prose about a User class". Prose about a User class
 * is exactly what this row cannot see. It fired in 2026-09-10 only because the victim was an .html
 * file, whose row needs a TAG and therefore has no such hole.
 *
 * The py and gd rows added earlier already key on SYNTAX - brackets, parens, equals, or a
 * line-initial statement keyword - because that is what prose does not contain. This brings js into
 * line with them.
 */
// ONE fixture, shared by the bug case and its control, and MEASURED.
//
// The first version of this was defined twice, inline, at 365 bytes - under the 400-byte floor that
// `shrank` requires - so the guard correctly never fired and the bug case reported a failure in the
// FIX. That is the third fixture-too-short of this session (REAL_GD was the second). The premise
// assertion below is what caught it; without one, the control ("shrinking JS is still allowed") would
// have passed VACUOUSLY, proving nothing, for exactly the same reason.
// Shared rather than duplicated so the two can never drift apart again.
const REAL_JS = `class User {\n`
  + `  constructor(name, email) {\n    this.name = name;\n    this.email = email;\n    this.roles = [];\n    this.active = true;\n  }\n\n`
  + `  addRole(role) {\n    if (typeof role !== 'string' || !role) {\n      throw new TypeError('role must be a non-empty string');\n    }\n`
  + `    this.roles.push(role);\n    return this;\n  }\n\n`
  + `  hasRole(role) {\n    return this.roles.includes(role);\n  }\n\n`
  + `  deactivate() {\n    this.active = false;\n    return this;\n  }\n\n`
  + `  describe() {\n    return this.name + ' <' + this.email + '> [' + this.roles.join(', ') + ']';\n  }\n}\n\n`
  + `module.exports = { User };\n`;

test('THE BUG: prose that merely CONTAINS the words class/function must not replace a working .js file', () => {
  assert.ok(REAL_JS.length > 400, `premise: the original must clear the 400-byte floor (got ${REAL_JS.length})`);
  write('user.js', REAL_JS);
  // Prose, not code - but it says "class" and "function", which is all the js row looks for.
  const r = write('user.js', 'This module defines a User class and a function that looks accounts up by email.');
  assert.match(r, /^ERROR/, `the write should have been refused, got: ${r.slice(0, 140)}`);
  assert.equal(read('user.js'), REAL_JS, 'and the working file must still be on disk, untouched');
});

test('CONTROL: real JavaScript that SHRINKS is still allowed after the js row changes', () => {
  write('shrink_ok.js', REAL_JS);
  const smaller = 'const hasRole = (u, r) => u.roles.includes(r);\nmodule.exports = { hasRole };\n';
  assert.ok(smaller.length < REAL_JS.length * 0.4,
    `premise: the replacement must actually trip \`shrank\` (${smaller.length} vs ${REAL_JS.length})`);
  const r = write('shrink_ok.js', smaller);
  assert.match(r, /^OK/, `real javascript must still be writable, got: ${r.slice(0, 160)}`);
  assert.equal(read('shrink_ok.js'), smaller, 'and it must actually have been written');
});

test('CONTROL: the existing .js behaviour is unchanged - prose over js is still refused', () => {
  const js = REAL_PY.replace(/def /g, 'function ').replace(/:/g, ' {') + '\n};\n'.repeat(3);
  write('app.js', js);
  const r = write('app.js', 'This file sets up the application and its routes.');
  assert.match(r, /^ERROR/, `the pre-existing js guard must still fire, got: ${r.slice(0, 120)}`);
});

test('CONTROL: creating a NEW .py file is never gated (nothing to destroy)', () => {
  const r = write('brand_new.py', 'x = 1\n');
  assert.match(r, /^OK/, `a new file must always be writable, got: ${r.slice(0, 160)}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
