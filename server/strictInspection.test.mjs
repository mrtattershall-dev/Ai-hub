/**
 * strictInspection.test.mjs - A-REPAIR-1. THE PROPERTY, not a list of `find` flags.
 *
 *   node server/strictInspection.test.mjs
 *
 * THE PROPERTY UNDER TEST:
 *
 *     In strict mode, a command is auto-allowed ONLY IF neither its head nor its arguments can
 *     execute another program or modify the filesystem.
 *
 * NOT "find -delete must be refused". SECGATE-1 reported `find` because that is what the audit
 * named, but the mechanism is head-only allowlisting: `classifySegment` returns `allow` on
 * `INSPECT.has(head)` BEFORE the `mode === 'strict'` gate is reached, and nothing inspects
 * arguments. Several inspection heads can write or execute through their arguments, so a fix
 * aimed at `find` would leave the property violated.
 *
 * Measured unrepaired: TWELVE forms auto-allowed under strict, including `env node evil.js` -
 * arbitrary execution through an allowlisted head, while bare `node evil.js` correctly asks.
 *
 * ANTI-OVER-REFUSAL ARMS ARE HALF THIS SUITE. strict mode exists so read-only inspection runs
 * unattended; a fix that refuses `find . -name "*.js"` has destroyed the feature to close the
 * hole. Every P arm must stay ALLOW.
 */
import { classifyCommand } from './approvalPolicy.js';

let passed = 0, failed = 0;
const ok = (c, m) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${m}`); c ? passed++ : failed++; };

/** The property: in strict mode this must NOT be auto-allowed. */
const mustNotAutoRun = (cmd, why) => {
  const r = classifyCommand(cmd, 'strict');
  ok(r.decision !== 'allow', `${String(r.decision).toUpperCase().padEnd(5)} ${cmd.padEnd(36)} ${why}`);
};
/** The counter-property: strict mode must still auto-run genuine inspection. */
const mustAutoRun = (cmd, why) => {
  const r = classifyCommand(cmd, 'strict');
  ok(r.decision === 'allow', `${String(r.decision).toUpperCase().padEnd(5)} ${cmd.padEnd(36)} ${why}`);
};

console.log('A - strict mode must not auto-run anything that executes or modifies');
console.log('');
console.log('MUTATION / EXECUTION ARMS - none may be ALLOW');

// find: deletion and execution predicates
mustNotAutoRun('find . -delete', 'deletes');
mustNotAutoRun('find . -name "*.js" -delete', 'deletes, with an intervening predicate');
mustNotAutoRun('find . -type f -exec rm {} ;', 'executes an arbitrary command');
mustNotAutoRun('find . -execdir rm {} ;', 'executes, per-directory form');
mustNotAutoRun('find . -ok rm {} ;', 'executes, interactive form');
// find: predicates that WRITE FILES - easy to miss because they are not named like mutations
mustNotAutoRun('find . -fprint out.txt', 'writes a file');
mustNotAutoRun('find . -fls out.txt', 'writes a file');
mustNotAutoRun('find . -fprintf out.txt %p', 'writes a file');

// env: an allowlisted head that runs an arbitrary program
mustNotAutoRun('env FOO=1 node evil.js', 'ARBITRARY EXECUTION through an allowlisted head');
mustNotAutoRun('env node evil.js', 'arbitrary execution, no assignment');

// heads whose ARGUMENTS name an output file
mustNotAutoRun('sort -o victim.txt input.txt', 'writes via -o');
mustNotAutoRun('sort --output=victim.txt input.txt', 'writes via --output=');
mustNotAutoRun('uniq input.txt victim.txt', 'writes via a positional output argument');

// redirection to a RELATIVE path inside the workspace still modifies the workspace
mustNotAutoRun('cat src.txt > dest.txt', 'redirects output into a file');

console.log('');
console.log('ANTI-OVER-REFUSAL ARMS - all must remain ALLOW');

mustAutoRun('find . -name "*.js"', 'genuine read-only find');
mustAutoRun('find . -type f', 'genuine read-only find');
mustAutoRun('find . -maxdepth 2 -name "*.md"', 'read-only with several predicates');
mustAutoRun('grep -rn foo .', 'read-only search');
mustAutoRun('ls -la', 'listing');
mustAutoRun('cat f.txt', 'reading');
mustAutoRun('wc -l f.txt', 'counting');
mustAutoRun('head -5 f.txt', 'reading a window');
mustAutoRun('sort f.txt', 'sorting to stdout - no -o, so nothing is written');
mustAutoRun('uniq f.txt', 'single argument, so stdout only');
mustAutoRun('diff a.txt b.txt', 'comparing');
mustAutoRun('du -sh .', 'disk usage');
mustAutoRun('env', 'bare env prints the environment and runs nothing');

console.log('');
console.log('MODE PRESERVATION - strict must stay stricter than build, and deny must still deny');
{
  const a = classifyCommand('node evil.js', 'strict');
  ok(a.decision === 'ask', `strict still ASKS for an executor head (${a.decision})`);
  const b = classifyCommand('rm -rf .', 'strict');
  ok(b.decision === 'deny', `strict still DENIES a recursive delete (${b.decision})`);
  const c = classifyCommand('find . -delete', 'build');
  ok(c.decision !== 'allow', `build does not auto-allow it either (${c.decision})`);
}

console.log('');
console.log(`  ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
