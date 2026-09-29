import { writeFileSync } from 'node:fs';

const SP = process.argv[2];
const NL = '\n';

const PY_START = ['def foo():', '    return 1', '', 'def bar():', '    return 2', ''].join(NL);
const JS_START = ['function jfoo() { return 1; }', '', 'function jbar() { return 2; }', ''].join(NL);
const MD_START = ['# notes', '', 'first line', ''].join(NL);

const START = { 'ctl.py': PY_START, 'ctl.js': JS_START, 'NOTES.md': MD_START };

const plan = ['1. Work on the control files', '2. FILES: ctl.py ctl.js NOTES.md',
  '3. BUILD ORDER: 1) one append', '4. HOW TO VERIFY: python ctl.py'].join(NL);
const fin = ['ACTION: finish', 'SUMMARY: done'].join(NL);

const act = (tool, path, lang, body, extra) => {
  const head = ['ACTION: ' + tool, 'PATH: ' + path];
  if (extra) head.push(extra);
  return head.concat(['```' + lang, body, '```']).join(NL);
};

const mk = (id, reply, expect) => ({
  id, set: 'ctl', model: 'ctl', goalNo: 0,
  goal: 'Append-route preservation control. EXPECTATION: ' + expect,
  source: 'hand-written control', complete: true, startFrom: null, startHow: 'synthetic',
  start: START, replies: [plan, reply, fin], hubSaid: [],
  outcome: { status: 'done', finishBlocks: 0, modelCalls: 3, steps: 0, verdict: null },
  tags: ['control', 'append-route'],
});

const dupPy = ['def foo():', '    return 99', ''].join(NL);

const rows = [
  // THE DEFECT. Must be REFUSED after the fix; landed before it.
  mk('ap1-DUP-PY', act('append_file', 'ctl.py', 'python', dupPy),
    'REFUSED after fix - duplicates foo (1->2)'),
  // THE SAME DEFECT IN JS. Extension coverage of the gate.
  mk('ap2-DUP-JS', act('append_file', 'ctl.js', 'javascript', 'function jfoo() { return 99; }'),
    'REFUSED after fix - duplicates jfoo (1->2)'),
  // LEGITIMATE APPENDS. Every one of these must STILL LAND after the fix.
  mk('ap3-NEWDEF', act('append_file', 'ctl.py', 'python', ['def baz():', '    return 3', ''].join(NL)),
    'LANDS - a genuinely new definition'),
  mk('ap4-NEWFILE', act('append_file', 'newmod.py', 'python', ['def qux():', '    return 4', ''].join(NL)),
    'LANDS - the file does not exist yet, so there is no before-image and nothing to compare'),
  mk('ap5-NONSOURCE', act('append_file', 'NOTES.md', 'markdown', 'second line'),
    'LANDS - not a source extension, outside the gate entirely'),
  mk('ap6-NODEFS', act('append_file', 'ctl.py', 'python', ['x = foo()', 'y = bar()', ''].join(NL)),
    'LANDS - adds no definitions at all'),
  // THE OVERRIDE MUST STILL WORK, or the refusal is a loop with no exit.
  mk('ap7-DECLARED', act('append_file', 'ctl.py', 'python', dupPy, 'DUPLICATE: foo'),
    'LANDS - the caller declared DUPLICATE: foo'),
];

writeFileSync(SP + '/append-suite.jsonl', rows.map((r) => JSON.stringify(r)).join(NL) + NL);
console.log('append suite: ' + rows.length + ' scenarios');
for (const r of rows) console.log('  ' + r.id.padEnd(14) + r.goal.replace('Append-route preservation control. EXPECTATION: ', ''));
