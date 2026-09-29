/**
 * authorityBinding.test.mjs — does the record name what Node ACTUALLY LOADED?
 *
 *   node server/authorityBinding.test.mjs
 *
 * The property under test is not "we digested the root". It is that the manifest is built from
 * RESOLVED MODULE URLS reached by following real import specifiers - so a dependency that lives
 * OUTSIDE the supplied root shows up in the manifest instead of being quietly excluded by it. A
 * listing of files under the root would pass a weaker version of every test here and still be wrong,
 * which is why the fixture below deliberately reaches outside.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { bindAuthority, AUTHORITY_CONTRACT, _internal } from './authorityBinding.mjs';

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const rejects = async (fn, m) => {
  try { await fn(); say(false, `${m} - IT WAS ALLOWED`); }
  catch (e) { say(true, `${m} (${String(e.message).slice(0, 70)})`); }
};

const REAL_ROOT = resolve('../ai-coding-hub-consolidation');

// ══ THE DECISIVE FIXTURE: a transitive dependency OUTSIDE the root ════════════════════════════════
// If the manifest were "files under the root", `outside.mjs` would be invisible - and a run could
// name one authority root while loading code from somewhere else entirely.
console.log('\nthe manifest follows resolution, not the directory tree');
{
  const base = mkdtempSync(join(tmpdir(), 'authbind-'));
  const root = join(base, 'root');
  const elsewhere = join(base, 'elsewhere');
  mkdirSync(join(root, 'legasus/runtime/epistemic-admission'), { recursive: true });
  mkdirSync(join(root, 'legasus/runtime/governedWorkspace'), { recursive: true });
  mkdirSync(elsewhere, { recursive: true });
  try {
    writeFileSync(join(elsewhere, 'outside.mjs'), 'export const SECRET = 1;\n');
    writeFileSync(join(root, 'legasus/runtime/epistemic-admission/governed-edit.mjs'),
      "import { SECRET } from '../../../../elsewhere/outside.mjs';\nexport const A = SECRET;\n");
    writeFileSync(join(root, 'legasus/runtime/governedWorkspace/workspace.mjs'), 'export const B = 1;\n');

    const contract = {
      'legasus/runtime/epistemic-admission/governed-edit.mjs': ['A'],
      'legasus/runtime/governedWorkspace/workspace.mjs': ['B'],
    };
    const { modules: g } = _internal.walkModuleGraph([
      pathToFileURL(join(root, 'legasus/runtime/epistemic-admission/governed-edit.mjs')).href,
      pathToFileURL(join(root, 'legasus/runtime/governedWorkspace/workspace.mjs')).href,
    ]);
    const urls = [...g.keys()];
    say(urls.some((u) => u.includes('elsewhere/outside.mjs')),
      'a transitive dependency OUTSIDE the supplied root is IN the manifest, not excluded by it');
    say(urls.length === 3, `all three reachable modules are digested (${urls.length})`);
    void contract;
  } finally { rmSync(base, { recursive: true, force: true }); }
}

console.log('\nchanging any reachable file changes the manifest digest');
{
  const base = mkdtempSync(join(tmpdir(), 'authbind2-'));
  const root = join(base, 'root');
  mkdirSync(join(root, 'legasus/runtime/epistemic-admission'), { recursive: true });
  mkdirSync(join(root, 'legasus/runtime/governedWorkspace'), { recursive: true });
  const dep = join(root, 'legasus/runtime/dep.mjs');
  const ge = join(root, 'legasus/runtime/epistemic-admission/governed-edit.mjs');
  const ws = join(root, 'legasus/runtime/governedWorkspace/workspace.mjs');
  const contract = {
    'legasus/runtime/epistemic-admission/governed-edit.mjs': ['A'],
    'legasus/runtime/governedWorkspace/workspace.mjs': ['B'],
  };
  try {
    writeFileSync(dep, 'export const D = 1;\n');
    writeFileSync(ge, "import { D } from '../dep.mjs';\nexport const A = D;\n");
    writeFileSync(ws, 'export const B = 1;\n');

    const first = await bindAuthority({ root, contract });
    say(first.identity.moduleCount === 3, `the graph includes the transitive dep (${first.identity.moduleCount} modules)`);

    // Change the TRANSITIVE dependency only. The entry points are untouched.
    writeFileSync(dep, 'export const D = 2; // tampered\n');
    const second = await bindAuthority({ root, contract });
    say(first.identity.manifestDigest !== second.identity.manifestDigest,
      'editing a transitive dependency moves the manifest digest, even though no entry point changed');

    await rejects(() => bindAuthority({ root, contract, pin: first.identity.manifestDigest }),
      'and a pin taken before the edit now FAILS CLOSED');
    const ok = await bindAuthority({ root, contract, pin: second.identity.manifestDigest });
    say(!!ok, 'while the matching pin binds normally - the pin check is not a blanket refusal');
  } finally { rmSync(base, { recursive: true, force: true }); }
}

// ══ THE ENFORCED LIMIT ════════════════════════════════════════════════════════════════════════════
// A computed dynamic import cannot be resolved without executing it, so it would be ABSENT from the
// manifest and the record would understate what ran. Declaring that in a comment would leave the hole
// open; the walk refuses instead. These two tests are what make that a boundary rather than a note.
console.log('\na computed dynamic import is refused, and a literal one is followed');
{
  const base = mkdtempSync(join(tmpdir(), 'authbind4-'));
  const mk = (body) => {
    const root = join(base, `r${Math.random().toString(36).slice(2, 8)}`);
    mkdirSync(join(root, 'legasus/runtime/epistemic-admission'), { recursive: true });
    mkdirSync(join(root, 'legasus/runtime/governedWorkspace'), { recursive: true });
    writeFileSync(join(root, 'legasus/runtime/epistemic-admission/governed-edit.mjs'), body);
    writeFileSync(join(root, 'legasus/runtime/governedWorkspace/workspace.mjs'), 'export const B = 1;\n');
    return root;
  };
  const contract = {
    'legasus/runtime/epistemic-admission/governed-edit.mjs': ['A'],
    'legasus/runtime/governedWorkspace/workspace.mjs': ['B'],
  };
  try {
    const computed = mk('const n = "dep";\nexport const A = () => import(n);\n');
    await rejects(() => bindAuthority({ root: computed, contract }),
      'a dynamic import with a computed specifier fails the bind');

    const templated = mk('const n = "dep";\nexport const A = () => import(`./${n}.mjs`);\n');
    await rejects(() => bindAuthority({ root: templated, contract }),
      'and so does a template specifier with a substitution');

    const literal = mk("export const A = () => import('./side.mjs');\n");
    writeFileSync(join(literal, 'legasus/runtime/epistemic-admission/side.mjs'), 'export const S = 1;\n');
    const bound = await bindAuthority({ root: literal, contract });
    say(bound.manifest.some((m) => m.url.endsWith('side.mjs')),
      'while a LITERAL dynamic import resolves and is followed into the manifest - the refusal is narrow');
  } finally { rmSync(base, { recursive: true, force: true }); }
}

console.log('\nfail closed, never degrade to running anyway');
{
  await rejects(() => bindAuthority({ root: null }), 'no --authority-root at all');
  await rejects(() => bindAuthority({ root: join(tmpdir(), 'no-such-authority-root-xyz') }), 'a root that does not exist');

  const base = mkdtempSync(join(tmpdir(), 'authbind3-'));
  try {
    mkdirSync(join(base, 'legasus/runtime/epistemic-admission'), { recursive: true });
    mkdirSync(join(base, 'legasus/runtime/governedWorkspace'), { recursive: true });
    writeFileSync(join(base, 'legasus/runtime/epistemic-admission/governed-edit.mjs'), 'export const NOPE = 1;\n');
    writeFileSync(join(base, 'legasus/runtime/governedWorkspace/workspace.mjs'), 'export const B = 1;\n');
    await rejects(() => bindAuthority({
      root: base,
      contract: { 'legasus/runtime/epistemic-admission/governed-edit.mjs': ['governedEdit'], 'legasus/runtime/governedWorkspace/workspace.mjs': ['B'] },
    }), 'a module present but missing an expected export');
  } finally { rmSync(base, { recursive: true, force: true }); }
}

// ══ AGAINST THE REAL STACK ════════════════════════════════════════════════════════════════════════
console.log('\nbinding the real authority stack');
if (!existsSync(REAL_ROOT)) {
  console.log(`  SKIP  ${REAL_ROOT} is not present - this is NOT a pass, the check did not run`);
} else {
  const a = await bindAuthority({ root: REAL_ROOT });
  say(typeof a.modules['legasus/runtime/epistemic-admission/governed-edit.mjs'].governedEdit === 'function',
    'governedEdit is bound and callable');
  say(typeof a.modules['legasus/runtime/governedWorkspace/workspace.mjs'].createWorkspace === 'function',
    'createWorkspace is bound and callable');
  say(a.identity.moduleCount >= 4,
    `the manifest covers the transitive authority stack, not just the two entry points (${a.identity.moduleCount} modules)`);
  say(a.manifest.some((m) => m.url.includes('legaknow')),
    'including legaknow, which neither entry point lives beside - reached only by following imports');
  say(!!a.identity.commit, `the commit is recorded (${String(a.identity.commit).slice(0, 12)})`);
  say(a.identity.dirty === true || a.identity.dirty === false,
    `and whether that checkout was DIRTY at bind time (${a.identity.dirty}) - a commit alone would be a half-truth`);
  say(Object.keys(AUTHORITY_CONTRACT).every((k) => k in a.identity.contract),
    'the export contract it was checked against is recorded alongside, so a later reader need not guess');
  console.log(`  manifest digest ${a.identity.manifestDigest.slice(0, 24)}  external: ${a.identity.external.join(', ')}`);
}

console.log(`\n  authority binding: ${passed} passed, ${failed} failed -> ${failed
  ? 'A RUN COULD NAME ONE AUTHORITY STACK AND LOAD ANOTHER'
  : 'the record names the resolved modules that were actually loaded, and a drift fails closed'}`);
process.exit(failed ? 1 : 0);
