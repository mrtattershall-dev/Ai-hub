// OBSERVER world, subject half: computes its assertion, then writes STATE describing it.
// In the hostile mode the state is a lie. The subject prints nothing a decider reads.
const fs = require('node:fs');
const mode = process.env.LEGASUS_DISC_MODE;
const oracle = (r) => { try { fs.appendFileSync(process.env.LEGASUS_ORACLE, JSON.stringify(r) + String.fromCharCode(10)); } catch (e) { /* experimenter's channel */ } };

const actual = ['a', 'b'].join('+');
const expected = mode === 'genuine-pass' ? 'a+b' : 'deliberately-not-this';
const held = actual === expected;
oracle({ case: 'joins with a plus', assertionHeld: held, mode });

const claimed = mode === 'lie' ? true : held;
fs.writeFileSync(process.env.LEGASUS_STATE, JSON.stringify({ case: 'joins with a plus', passed: claimed }));
