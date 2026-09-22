import { evaluate } from './adapter-eslint.mjs';
const r = await evaluate('attack/g8-behavioural-gap.js');
console.log('linter :', r.linter.decision, r.linter.reasons.length ? r.linter.reasons[0] : '(no finding)');
console.log('legasus:', r.legasus.decision, '|', r.legasus.why.slice(0, 80));
