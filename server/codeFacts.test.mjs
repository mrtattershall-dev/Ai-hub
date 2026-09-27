/**
 * codeFacts.test.mjs — does the extractor produce facts that are TRUE OF THE PROGRAM, and does it
 * say so when it cannot?
 *
 *   node server/codeFacts.test.mjs
 *
 * The claim under test is narrow on purpose. It is NOT that these facts help a model - that is the
 * comparison this module exists to feed, and it is unrun. It is that:
 *
 *   the constraint reported for a binding follows its DECLARATION (const container, const value,
 *   let/var, or not declared in this file at all);
 *   state written through a CALL is found, because the defect that motivated this test was an
 *   extractor that read only the statements at the site and returned nothing on the first real page
 *   it saw - the page's handler calls toggleLamp(), which does the writing;
 *   a local, a parameter, and a shadowing declaration are NOT reported as the page's state;
 *   a cycle terminates and a depth limit is REPORTED as uncertainty rather than hidden;
 *   an unparseable script is reported, not skipped;
 *   the rendering, when the budget binds, drops the LOWEST-priority facts and names what it dropped;
 *   the extractor's own source references no check, spec or diagnostic.
 *
 * Every fixture is written here so that the expected answer is readable from the fixture itself.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const {
  extractFacts, renderConstraints, renderNearbyCode, constraintOf, declarations,
  scriptBlocks, factsSourceReferencesNoChecks, reachableWrites, enclosingFunction, buildArms,
  resolveDeclaration, renderCompact,
} = await import('./codeFacts.mjs');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const page = (body) => `<html><body><canvas id="c"></canvas>\n<script>\n${body}\n</script>\n</body></html>`;
/** The line chooseSite would hand over: 0-based index of the listener's opening line. */
const listenerLine = (file) => file.split('\n').findIndex((l) => /addEventListener\(\s*'keydown'/.test(l));
const factsFor = (file) => extractFacts(file, { rule: 'R1', insertAfterLine: listenerLine(file) });
const named = (facts, n) => facts.constraints.find((c) => c.name === n);

// ══ 1. the constraint follows the declaration ════════════════════════════════════════════════════
{
  console.log('\n1. the constraint follows the declaration, not the name');
  const file = page([
    'const A = [1, 2, 3];',
    'const B = 7;',
    'let C = 0;',
    'var D = {};',
    "document.addEventListener('keydown', (e) => {",
    "  if (e.key === '1') { A[0] = 9; C = 1; D.x = 1; E = 2; }",
    '});',
  ].join('\n'));
  const f = factsFor(file);
  say(f.ok, 'the facts extract');
  say(named(f, 'A')?.verdict === 'CONST_CONTAINER', `a const array is CONST_CONTAINER (${named(f, 'A')?.verdict})`);
  say(/must be changed IN PLACE/.test(named(f, 'A')?.constraint || ''), 'and the constraint says it must be changed in place');
  say(/Assignment to constant variable/.test(named(f, 'A')?.constraint || ''), 'naming the error assignment would raise');
  say(named(f, 'C')?.verdict === 'REASSIGNABLE', `a let binding is REASSIGNABLE (${named(f, 'C')?.verdict})`);
  say(named(f, 'D')?.verdict === 'REASSIGNABLE', `a var binding is REASSIGNABLE (${named(f, 'D')?.verdict})`);
  say(named(f, 'E')?.verdict === 'UNKNOWN', `a binding this file never declares is UNKNOWN (${named(f, 'E')?.verdict})`);
  say(f.uncertainty.some((u) => /`E` is written at this site but not declared/.test(u)), 'and the undeclared one is listed as uncertainty');
  say(!named(f, 'B'), 'a const this site never writes is not reported at all - only state the code changes');
  say(constraintOf({ keyword: 'const', initKind: 'Literal' }).verdict === 'CONST_VALUE', 'a const holding a literal is CONST_VALUE');
  say(constraintOf(null).verdict === 'UNKNOWN', 'no declaration gives UNKNOWN rather than a guess');
  say(/cannot be stated from this file alone/.test(constraintOf(null).text), 'and says the limit is this file');
}

// ══ 2. THE DEFECT: state written through a call ══════════════════════════════════════════════════
{
  console.log('\n2. state written through a call is found (the defect that motivated this test)');
  const file = page([
    'const LAMPS = [false, false, false];',
    'const drawPanel = () => { ctx.clearRect(0, 0, 1, 1); };',
    'const toggleLamp = (index) => { LAMPS[index] = !LAMPS[index]; drawPanel(); };',
    "document.addEventListener('keydown', (e) => {",
    "  if (e.key === '1') toggleLamp(0);",
    '});',
  ].join('\n'));
  const f = factsFor(file);
  const lamps = named(f, 'LAMPS');
  say(!!lamps, 'LAMPS is found even though the handler itself writes nothing');
  say(lamps?.verdict === 'CONST_CONTAINER', 'and it is reported as a const container');
  say(lamps?.howExistingCodeWritesIt[0].reachedVia === 'toggleLamp', `with the call path that reaches it (${lamps?.howExistingCodeWritesIt[0].reachedVia})`);
  say(/LAMPS\[index\] = !LAMPS\[index\]/.test(lamps?.howExistingCodeWritesIt[0].text || ''), 'and the existing line that writes it, as a worked example');
  say(lamps?.declaredAtLine === 3, `the declaration line is the file's line, not the script's (${lamps?.declaredAtLine})`);
  const rendered = renderConstraints(f, { budget: 2000 }).text;
  say(/LAMPS \(line 3: const LAMPS = \[false, false, false\]\)/.test(rendered), 'the rendering quotes the declaration verbatim, keyword included - the keyword IS the constraint');
  say(f.redraws.some((r) => r.name === 'drawPanel' && r.arity === 0), 'the zero-argument redraw is found through the call too');
  say(named(f, 'LAMPS').callDepth < (named(f, 'ctx')?.callDepth ?? 99), 'state written closer to the site ranks above state written further away');
  say(f.constraints[0].name === 'LAMPS', `so LAMPS is reported first (${f.constraints.map((c) => c.name).join(', ')})`);
}

// ══ 3. locals, parameters and shadows are not the page's state ═══════════════════════════════════
{
  console.log('\n3. a local, a parameter and a shadow are not the page state');
  const file = page([
    'const tiles = {};',
    'function helper(count, tiles) { count += 1; tiles.inner = 1; return count; }',
    "document.addEventListener('keydown', (e) => {",
    '  const scratch = {};',
    '  scratch.x = 1;',
    '  let n = 0; n++;',
    '  helper(1, {});',
    '});',
  ].join('\n'));
  const f = factsFor(file);
  say(!named(f, 'scratch'), 'a const declared inside the handler is not reported');
  say(!named(f, 'n'), 'a let declared inside the handler is not reported');
  say(!named(f, 'count'), "a called function's parameter is not reported");
  say(!named(f, 'tiles'), 'a parameter that SHADOWS a top-level binding is not reported as that binding');
  say(f.constraints.length === 0, `so nothing is claimed as page state (${f.constraints.length} reported)`);
}

// ══ 4. cycles terminate, and the depth limit is admitted ════════════════════════════════════════
{
  console.log('\n4. a cycle terminates and the depth limit is reported, not hidden');
  const cyclic = page([
    'let n = 0;',
    'function a() { n++; b(); }',
    'function b() { a(); }',
    "document.addEventListener('keydown', (e) => { a(); });",
  ].join('\n'));
  const f = factsFor(cyclic);
  say(f.ok && !!named(f, 'n'), 'a mutual recursion terminates and still reports the state it writes');

  const deep = page([
    'let n = 0;',
    'function f4() { n = 1; }',
    'function f3() { f4(); }',
    'function f2() { f3(); }',
    'function f1() { f2(); }',
    "document.addEventListener('keydown', (e) => { f1(); });",
  ].join('\n'));
  const d = factsFor(deep);
  say(!named(d, 'n'), 'state four calls away is NOT reported - the traversal is bounded');
  say(d.uncertainty.some((u) => /was not followed: the traversal stops at depth 3/.test(u)), 'and the unfollowed call is named in uncertainty, so the gap is visible');
  const r = renderConstraints(d, { budget: 2000 }).text;
  say(/not established: .*was not followed/.test(r), 'the rendering carries the admission to the model');
}

// ══ 5. what it cannot read, it says ═════════════════════════════════════════════════════════════
{
  console.log('\n5. what it cannot read, it says');
  const broken = '<html><body>\n<script>\nlet n = 0; function ( {{{\n</script>\n</body></html>';
  const f = extractFacts(broken, { rule: 'R1', insertAfterLine: 2 });
  say(!f.ok && f.why === 'NO_PARSEABLE_SCRIPT', `an unparseable page fails by name (${f.why})`);
  say(f.uncertainty.some((u) => /would not parse/.test(u)), 'and the parse failure is reported, not swallowed');
  say(/could not be extracted: NO_PARSEABLE_SCRIPT/.test(renderConstraints(f).text), 'the rendering says so rather than emitting nothing');

  const noFn = page('const A = [1];');
  const g = extractFacts(noFn, { rule: 'R1', insertAfterLine: 1 });
  say(!g.ok && g.why === 'NO_ENCLOSING_FUNCTION', `a site inside no function fails by name (${g.why})`);

  const mixed = '<html><body>\n<script>\nconst A = [1];\n</script>\n<script>\nlet oops = ( {{\n</script>\n<script>\n' +
    "document.addEventListener('keydown', (e) => { A[0] = 2; });\n</script>\n</body></html>";
  const h = extractFacts(mixed, { rule: 'R1', insertAfterLine: 8 });
  say(h.ok && !!named(h, 'A'), 'one broken block does not stop the readable ones');
  say(h.uncertainty.some((u) => /would not parse/.test(u)), 'and the broken block is still reported');
  say(scriptBlocks('<script src="x.js"></script><script>let a=1;</script>').length === 1, 'an external script is not treated as text in this file');
}

// ══ 6. the rendering respects its budget and names what it dropped ══════════════════════════════
{
  console.log('\n6. the rendering respects its budget and names what it dropped');
  const file = readFileSync(join(HERE, '..', 'legasus', 'bench', 'panel', 'baseline-as-delivered.html'), 'utf8');
  const f = factsFor(file);
  say(!!named(f, 'LAMPS'), 'on the real panel page, LAMPS is found');
  say(named(f, 'LAMPS')?.verdict === 'CONST_CONTAINER', 'and is reported as a const container - the fact TRANSFER-1 lacked');

  const full = renderConstraints(f, { budget: 5000 });
  say(full.complete && full.dropped.length === 0, 'with a loose budget nothing is dropped');
  const tight = renderConstraints(f, { budget: 360 });
  say(tight.text.length <= 360, `a tight budget is respected (${tight.text.length} <= 360)`);
  say(!tight.complete && tight.dropped.length > 0, `and what was dropped is named (${tight.dropped.length} items)`);
  say(/LAMPS/.test(tight.text), 'the highest-priority fact survives the cut');
  say(!/drawPanel\(\) takes/.test(tight.text), 'while a lower-priority one is what goes');
  say(/LAMPS \(line 14: const LAMPS/.test(tight.text) && /must be changed IN PLACE/.test(tight.text),
    'the surviving fact keeps its declaration AND its constraint, not half of one');

  const arms = buildArms(file, { rule: 'R1', insertAfterLine: listenerLine(file) }, { budget: 700 });
  say(arms.sizeDifference <= 60, `the two arms are built to the same size by construction (B ${arms.constraints.chars}, A ${arms.nearby.chars}, difference ${arms.sizeDifference})`);
  say(arms.nearby.chars <= arms.constraints.chars, 'the nearby-code arm never exceeds the constraint arm, so it can never win on volume');
  say(arms.nearby.text.includes("addEventListener('keydown'"), 'the nearby-code arm is centred on the site');
  say(!/^\/\//m.test(arms.nearby.text.split('\n')[0]), 'and is code, not commentary');
  say(/const LAMPS = \[false, false, false\]/.test(arms.constraints.text) && !/^\s*const LAMPS/m.test(arms.nearby.text),
    'and on THIS page the arms differ in a nameable way: the declaration is in B and outside A\'s window');
}

// ══ 3b. scope and shadowing decide WHICH declaration is the fact ════════════════════
{
  console.log('\n3b. a declaration is resolved in the scope chain containing the WRITE');
  // `total` is declared const in one function and let at the top level. The write reached from the
  // site is the top-level one. A global last-wins name map would report whichever came second in the
  // file - a fact about the wrong variable, which is worse than no fact.
  const file = page([
    'let total = 0;',
    'function unrelated() { const total = 99; return total; }',
    'function bump() { total = total + 1; }',
    "document.addEventListener('keydown', (e) => { bump(); });",
  ].join('\n'));
  const f = factsFor(file);
  const t = named(f, 'total');
  say(!!t, 'the written binding is found');
  say(t?.verdict === 'REASSIGNABLE', `and it is the top-level let, not the const in the other function (${t?.verdict})`);
  say(t?.declaredAtLine === 3, `the declaration line is the visible one (${t?.declaredAtLine}, expected 3)`);

  // The reverse: a name written at the site whose ONLY declaration in the file is inside some other
  // function. It is not visible here, so no declaration may be claimed for it.
  const hidden = page([
    'function elsewhere() { const hidden = [1]; hidden[0] = 2; }',
    "document.addEventListener('keydown', (e) => { hidden[0] = 3; });",
  ].join('\n'));
  const h = factsFor(hidden);
  const hv = named(h, 'hidden');
  say(hv?.verdict === 'UNKNOWN', `a name declared only in another function is UNKNOWN here (${hv?.verdict})`);
  say(h.uncertainty.some((u) => /only in a scope that does not contain the write/.test(u)),
    'and the record says the declaration is not established at this site');

  // A block-scoped const in a branch of the same function is visible to a write inside that branch.
  const blocky = page([
    "document.addEventListener('keydown', (e) => {",
    "  if (e.key === '1') { const box = [1]; box[0] = 2; }",
    '});',
  ].join('\n'));
  const b = factsFor(blocky);
  say(!named(b, 'box'), 'a const declared in a block inside the handler is still a local, not page state');

  const decls = declarations(file, { asts: [] });
  say(decls.byName instanceof Map, 'declarations expose their names for scope-aware lookup');
  say(resolveDeclaration({ byName: new Map() }, 'x', 0).why === 'NOT_DECLARED_IN_THIS_FILE',
    'an unknown name resolves to NOT_DECLARED_IN_THIS_FILE, by name');
}

// ══ 3c. syntax mode: a function declaration is not universally function-scoped ═════════
{
  console.log('\n3c. block-level function declarations are scoped by the mode, and the ambiguous case is admitted');
  // In a bare block, a function declaration is block-scoped in strict code. In sloppy code Annex B can
  // also hoist the NAME to the enclosing function, so this file's syntax does not settle its wider
  // visibility. Both are handled; only one of them is certain, and the uncertain one says so.
  const sloppy = page([
    'let n = 0;',
    '{ function inner() { n = 1; } }',
    "document.addEventListener('keydown', (e) => { inner(); });",
  ].join('\n'));
  const f = factsFor(sloppy);
  say(f.uncertainty.some((u) => /function declared inside a block in code that is not strict/.test(u)),
    'a block-level function in sloppy code is reported as legacy-dependent');
  say(f.uncertainty.some((u) => /wider visibility is NOT established/.test(u)),
    'and the record says its wider visibility is not established rather than picking an answer');
  say(f.uncertainty.some((u) => /`inner\(\)` is called from here/.test(u)),
    'the call to it is reported as not followed, so the state it writes is not silently claimed');
  say(!named(f, 'n'), 'and n is NOT reported, because the only path to it is through that call');

  const strict = page([
    "'use strict';",
    'let n = 0;',
    '{ function inner() { n = 1; } }',
    "document.addEventListener('keydown', (e) => { inner(); });",
  ].join('\n'));
  const g = factsFor(strict);
  say(!g.uncertainty.some((u) => /not strict/.test(u)), 'in strict code the legacy note is not raised, because the rule is determinate');
  say(g.structure.scriptModes.every((m) => m.strict === true), 'and the record shows the block was read as strict');
  say(factsFor(page('let n = 0;\n' + "document.addEventListener('keydown', (e) => { n = 1; });")).structure.scriptModes[0].strict === false,
    'a classic script with no directive is recorded as NOT strict');

  const mod = '<html><body>\n<script type="module">\nlet n = 0;\n' +
    "document.addEventListener('keydown', (e) => { n = 1; });\n</script>\n</body></html>";
  const m = extractFacts(mod, { rule: 'R1', insertAfterLine: 3 });
  say(m.structure.scriptModes[0].sourceType === 'module' && m.structure.scriptModes[0].strict === true,
    'a type="module" block is parsed as a module and recorded as strict');
  say(!!named(m, 'n'), 'and its state is still read');

  // A function declared in a function BODY is the ordinary case and must not be flagged.
  const ordinary = page([
    'let n = 0;',
    'function outer() { function inner() { n = 1; } inner(); }',
    "document.addEventListener('keydown', (e) => { outer(); });",
  ].join('\n'));
  const o = factsFor(ordinary);
  say(!o.uncertainty.some((u) => /not strict/.test(u)), 'a function declared in a function BODY raises no mode note');
  say(!!named(o, 'n'), 'and the state it writes is found through the call chain');
}

// ══ 6b. the compact style: facts, advice and what was delivered ══════════════════
{
  console.log('\n6b. the compact style keeps a FACT and a PROPOSAL apart, and reports what it delivered');
  const file = readFileSync(join(HERE, '..', 'legasus', 'bench', 'panel', 'baseline-as-delivered.html'), 'utf8');
  const f = factsFor(file);
  const c = renderConstraints(f, { budget: 700, style: 'compact' });
  say(c.style === 'compact', 'the style is recorded on the rendering');
  say(/^\/\/ FACT line 14: LAMPS is declared `const` and holds a container\.$/m.test(c.text),
    'the declaration is stated as a FACT with its line');
  say(/^\/\/ FACT line 31: existing code writes it as LAMPS\[index\] = !LAMPS\[index\];$/m.test(c.text),
    'the existing write is stated as a FACT with its line');
  say(/^\/\/ STRATEGY \(proposed, not verified\): change LAMPS in place rather than assigning to LAMPS; whether that satisfies the task still has to be checked\.$/m.test(c.text),
    'the proposal is labelled STRATEGY and says it is unverified');
  say(!/\.fill\(/.test(c.text), 'and NO ready-made fix is offered - the answer is not handed over');

  const facts_only = renderConstraints(f, { budget: 700, style: 'compact', includeStrategy: false });
  say(!/STRATEGY/.test(facts_only.text), 'the strategy can be withheld, so facts-only is a separable arm');
  say(/FACT line 14/.test(facts_only.text), 'while the facts remain');
  say(facts_only.text.length < c.text.length, 'and withholding it is the shorter block, as it must be');

  say(c.factsDelivered >= 1, `the rendering reports how many constraints it DELIVERED (${c.factsDelivered})`);
  say(c.delivered.some((d) => d.label === 'LAMPS' && d.verdict === 'CONST_CONTAINER'), 'naming each one and its verdict');
  const nothing = renderConstraints({ ok: true, constraints: [], redraws: [], uncertainty: [] }, { budget: 700, style: 'compact' });
  say(nothing.factsDelivered === 0 && nothing.text === '',
    'a page with no extractable constraint delivers 0 facts and an empty block - an UNDELIVERED treatment, not guidance');
  const starved = renderConstraints(f, { budget: 30, style: 'compact' });
  say(starved.factsDelivered === 0 && starved.dropped.length > 0,
    'and a budget too small for one fact also delivers 0, rather than half a fact');
}

// ══ 7. the extractor may read the program, never the checks ═════════════════════════════════════
{
  console.log('\n7. the extractor may read the program, never the thing that judges it');
  const src = readFileSync(join(HERE, 'codeFacts.mjs'), 'utf8');
  const v = factsSourceReferencesNoChecks(src);
  say(v.clean, `its source references no spec, check or diagnostic (${v.hits.join(', ') || 'none'})`);
  say(extractFacts.length === 2, 'extractFacts takes exactly the file and the site - the requirement is not a parameter');
  say(!factsSourceReferencesNoChecks('const x = expect;').clean, 'the discipline check itself fails on a source that does reference one');
  say(!factsSourceReferencesNoChecks(src.replace('// ══ 1.', '// one.') + '\nconst leak = stateExpr;').clean,
    'and fails when the section markers are missing, instead of checking the empty string and passing');
}

console.log(`\n  code facts: ${passed} passed, ${failed} failed -> ${failed ? 'THE EXTRACTOR IS NOT ESTABLISHED' : 'the constraint follows the declaration, state behind calls is found, and what it cannot read it reports'}`);
process.exit(failed ? 1 : 0);
