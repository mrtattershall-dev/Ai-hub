import assert from 'node:assert/strict';
import { parseActions } from './agentParse.js';

const F = '```';
const reply = [
  'THOUGHT: document the protocol',
  'ACTION: write_file',
  'PATH: notes.md',
  F + 'md',
  '# Protocol',
  'ACTION: finish',
  'SUMMARY: done',
  F,
].join('\n');

const acts = parseActions(reply, undefined);
assert.equal(acts.length, 1, 'expected exactly one action, got ' + JSON.stringify(acts.map((a) => a.tool)));
assert.equal(acts[0].tool, 'write_file');
assert.equal(acts[0].args.path, 'notes.md');
assert.ok(acts[0].args.content.includes('ACTION: finish'));
console.log('ok');
