// Applies EXTERNAL-LINTER_PREREG.md clause "the obligation, frozen", mechanically.
// The tool's OWN enumeration order and the tool's OWN metadata decide, not me.
import { builtinRules } from 'eslint/use-at-your-own-risk';
const rules = [...builtinRules.entries()];
console.log('total builtin rules:', rules.length);
console.log('first 8 in the tool\'s own enumeration order:');
for (const [id, r] of rules.slice(0, 8)) {
  console.log('  ', id.padEnd(28), 'meta.type =', (r.meta && r.meta.type) || '(none)');
}
// "semantic correctness" = the tool's own classification: meta.type === 'problem'
//   ESLint defines type 'problem' as "code that will cause errors or unintended behavior"
const first = rules.find(([, r]) => r.meta && r.meta.type === 'problem');
console.log('');
console.log('FIRST rule with meta.type === "problem":', first[0]);
console.log('  description:', first[1].meta.docs.description);
console.log('  url        :', first[1].meta.docs.url);
console.log('  fixable    :', first[1].meta.fixable || 'no');
