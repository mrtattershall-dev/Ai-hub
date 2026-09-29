import { writeFileSync } from 'node:fs';

const SP = process.argv[2];
const NL = '\n';

// The REAL observed shape, from set H: append_file x22 on s8_grades.py left `set_weight` x20, an
// INDENTED Python method. Appending 4-space-indented text straight after a class body keeps it
// inside the class, which is how that happened - and it is the shape column-0 duplicateDecls could
// never see and defCounts was built for. The top-level controls do not cover it.
const START = {
  'grades.py': ['class Gradebook:', '    def __init__(self):', '        self.g = {}', '',
    '    def set_weight(self, k, w):', '        self.g[k] = w', ''].join(NL),
};

const plan = ['1. Work on grades.py', '2. FILES: grades.py', '3. BUILD ORDER: 1) one append',
  '4. HOW TO VERIFY: python grades.py'].join(NL);
const fin = ['ACTION: finish', 'SUMMARY: done'].join(NL);

const act = (tool, path, body) => ['ACTION: ' + tool, 'PATH: ' + path, '```python', body, '```'].join(NL);

const dupMethod = ['    def set_weight(self, k, w):', '        self.g[k] = w * 2', ''].join(NL);
const newMethod = ['    def total(self):', '        return sum(self.g.values())', ''].join(NL);

const mk = (id, reply, expect) => ({
  id, set: 'ctl', model: 'ctl', goalNo: 0,
  goal: 'Indented class-method append control. EXPECTATION: ' + expect,
  source: 'hand-written control, set H shape', complete: true, startFrom: null, startHow: 'synthetic',
  start: START, replies: [plan, reply, fin], hubSaid: [],
  outcome: { status: 'done', finishBlocks: 0, modelCalls: 3, steps: 0, verdict: null },
  tags: ['control', 'append-route', 'method'],
});

const rows = [
  mk('am1-METHOD-DUP', act('append_file', 'grades.py', dupMethod),
    'REFUSED after fix - duplicates the INDENTED method set_weight (1->2), the set H shape'),
  mk('am2-METHOD-NEW', act('append_file', 'grades.py', newMethod),
    'LANDS - a genuinely new method added to the class by append, which is legitimate and common'),
];

writeFileSync(SP + '/method-suite.jsonl', rows.map((r) => JSON.stringify(r)).join(NL) + NL);
console.log('method suite: ' + rows.length + ' scenarios');
for (const r of rows) console.log('  ' + r.id.padEnd(16) + r.goal.split('EXPECTATION: ')[1]);
