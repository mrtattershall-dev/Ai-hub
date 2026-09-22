import { evaluate } from './adapter-eslint-repaired.mjs';
const r = await evaluate(process.argv[2]);
console.log(JSON.stringify({ file: r.file, linter: r.linter.decision,
  reasons: r.linter.reasons, conditions: r.conditions,
  legasus: r.legasus }, null, 2));
