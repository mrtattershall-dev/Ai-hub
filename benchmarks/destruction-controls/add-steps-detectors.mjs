import { readFileSync, writeFileSync } from 'node:fs';

const SP = process.argv[2];
let src = readFileSync(SP + '/replay-run-attrib.mjs', 'utf8');
const anchor = src.split('\n').find((l) => l.includes('duplicateNotes:'));
if (!anchor) throw new Error('anchor missing');

const add = [
  '    duplicateFromSteps: steps.filter((x) => /refused: it would have duplicated/.test(String(x.text || 1))).map((x) => String(x.text).slice(0, 220)),',
  '    removalFromSteps: steps.filter((x) => /refused: it would have removed/.test(String(x.text || 1))).map((x) => String(x.text).slice(0, 220)),',
].join('\n').replace(/\|\| 1\)/g, "|| '')");

src = src.replace(anchor, anchor + '\n' + add);
writeFileSync(SP + '/replay-run-attrib2.mjs', src);
console.log('added: ' + ['duplicateFromSteps', 'removalFromSteps'].filter((f) => src.includes(f + ':')).join(' '));
