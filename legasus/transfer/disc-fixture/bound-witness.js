// BOUND: the witness reports through the injected check, then attempts a naive forgery.
const fs = require('node:fs');
const mode = process.env.LEGASUS_DISC_MODE;
const oracle = (r) => { try { fs.appendFileSync(process.env.LEGASUS_ORACLE, JSON.stringify(r) + String.fromCharCode(10)); } catch (e) { /* experimenter's channel */ } };

const actual = ['a', 'b'].join('+');
const expected = mode === 'genuine-pass' ? 'a+b' : 'deliberately-not-this';
oracle({ case: 'joins with a plus', assertionHeld: actual === expected, mode });

globalThis.__legasus_check('joins with a plus', actual, expected);

// The forgery: an untagged line in the ordinary shape. The subject does not use the nonce.
if (mode === 'forge') console.log('PASS joins with a plus');

// N-ADV (step 17): the adversarial forger reads the nonce from its own environment and emits
// the exact authority-bearing representation while the assertion is false.
if (mode === 'forge-adversarial') console.log(`PASS ${process.env.LEGASUS_NONCE} joins with a plus`);
