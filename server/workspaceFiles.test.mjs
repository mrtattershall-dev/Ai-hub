/**
 * workspaceFiles.test.mjs — the whole-app reply contract, and every way it can be broken.
 *
 *   node server/workspaceFiles.test.mjs
 *
 * The crossover benchmark measures whether repeated whole-application reproduction gets expensive as
 * software grows. It only measures that if the arm really reproduces the whole application. Every
 * refusal below is a way the benchmark could otherwise LIE IN THE ARM'S FAVOUR:
 *
 *   omit a file and inherit it   reproduce 1 KB, get 30 KB of credit
 *   emit a path twice            undefined which copy is the application
 *   invent a file                grow the app rather than change it
 *   echo everything back         pay nothing and change nothing
 *
 * $0, no model, no network.
 */
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { governedFiles, serializeApp, parseApp, writeApp, copyApp, FILE_MARK, END_MARK } from './workspaceFiles.mjs';

const NL = String.fromCharCode(10);
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const dir = mkdtempSync(join(tmpdir(), 'wsf-'));
mkdirSync(join(dir, 'js'), { recursive: true });
writeFileSync(join(dir, 'index.html'), '<!DOCTYPE html><html><body><div id="app"></div><script src="js/app.js"></script></body></html>', 'utf8');
writeFileSync(join(dir, 'js', 'app.js'), 'const app = document.getElementById("app");' + NL + 'app.textContent = "hello";', 'utf8');
writeFileSync(join(dir, 'js', 'util.js'), 'function tidy(s) { return String(s).trim(); }', 'utf8');
writeFileSync(join(dir, 'style.css'), 'body { font-family: sans-serif; }', 'utf8');
writeFileSync(join(dir, 'task.json'), '{"id":"x"}', 'utf8');
writeFileSync(join(dir, 'notes.txt'), 'not source', 'utf8');

// ══ 1. the manifest ═════════════════════════════════════════════════════════════════════════════
console.log('\n1. what counts as governed source');
const paths = governedFiles(dir);
say(paths.length === 4, `four governed files (${paths.length}): ${paths.join(', ')}`);
say(!paths.includes('task.json'), 'task.json is experiment apparatus, not application source');
say(!paths.includes('notes.txt'), 'a non-source extension is excluded');
say(paths.includes('js/app.js') && paths.includes('js/util.js'), 'files in subdirectories are governed, with forward-slash paths');
say(JSON.stringify(paths) === JSON.stringify([...paths].sort()), 'the manifest is sorted, so it is deterministic');

const before = Object.fromEntries(paths.map((p) => [p, readFileSync(join(dir, p), 'utf8').replace(/\s+$/, '')]));
const app = serializeApp(dir, paths);
say(app.includes(`${FILE_MARK}js/app.js ===`) && app.endsWith(END_MARK), 'the serialized app carries every file under its own marker');

// ══ 2. a correct reply ══════════════════════════════════════════════════════════════════════════
console.log('\n2. a reply that reproduces the whole application');
const changed = app.replace('app.textContent = "hello";', 'app.textContent = "hello there";');
const ok = parseApp(changed, paths, before);
say(ok.ok, `accepted (${ok.ok ? 'ok' : ok.reason})`);
say(ok.ok && ok.paths.length === 4, 'all four paths present');
say(ok.ok && ok.files.get('js/app.js').includes('hello there'), 'the change is carried');
say(ok.ok && ok.files.get('style.css') === before['style.css'], 'and the untouched files come back intact');

// ══ 3. every way it can lie ═════════════════════════════════════════════════════════════════════
console.log('\n3. the refusals - each is a way the benchmark could credit unpaid work');

const omitted = changed.split(`${FILE_MARK}style.css ===`)[0] + END_MARK;
const r1 = parseApp(omitted, paths, before);
say(!r1.ok && r1.reason === 'MISSING_PATHS', `omitting a file is ${r1.reason}, not a silent inheritance`);
say(!r1.ok && /NOT inherited/.test(r1.detail), 'and the record says so explicitly');

const twice = changed.replace(END_MARK, `${FILE_MARK}style.css ===${NL}body { color: red; }${NL}${END_MARK}`);
const r2 = parseApp(twice, paths, before);
say(!r2.ok && r2.reason === 'DUPLICATE_PATHS', `emitting a path twice is ${r2.reason}`);

const invented = changed.replace(END_MARK, `${FILE_MARK}js/extra.js ===${NL}console.log(1);${NL}${END_MARK}`);
const r3 = parseApp(invented, paths, before);
say(!r3.ok && r3.reason === 'EXTRA_PATHS', `inventing a file is ${r3.reason}`);

const echoed = parseApp(app, paths, before);
say(!echoed.ok && echoed.reason === 'ECHOED_THE_INPUT', `returning the application unchanged is ${echoed.reason}`);

const prose = parseApp('Sure, here are the files you asked for!', paths, before);
say(!prose.ok && prose.reason === 'NO_FILE_MARKERS', `a reply in no recognisable shape is ${prose.reason}`);

const fenced = parseApp('Here you go:' + NL + '```' + NL + changed + NL + '```', paths, before);
say(fenced.ok, 'but a correct reply wrapped in a markdown fence is still accepted - shape is not the test');

// == 3b. running out of room is a CAPACITY outcome, not a coding failure ========================
console.log('\n3b. the output cap - a cost outcome of the whole-app method, not a mistake');
const truncated = changed.split(`${FILE_MARK}style.css ===`)[0];  // stops mid-manifest, no END marker
const cap1 = parseApp(truncated, paths, before, { doneReason: 'length' });
say(!cap1.ok && cap1.reason === 'OUTPUT_CAP_EXHAUSTED', `a reply cut off by the backend is ${cap1.reason}, not MISSING_PATHS`);
say(cap1.capped === true && cap1.signals.length === 2, `with BOTH signals recorded (${cap1.signals && cap1.signals.join(' + ')})`);
say(cap1.reproduced === 3 && cap1.ofManifest === 4, `and how far it got, which is the number the benchmark needs (${cap1.reproduced}/${cap1.ofManifest})`);

const cap2 = parseApp(truncated, paths, before, {});
say(!cap2.ok && cap2.reason === 'OUTPUT_CAP_EXHAUSTED', 'the structural signal alone is enough - a manifest begun and never closed');
say(cap2.signals.length === 1 && /END marker/.test(cap2.signals[0]), `naming only the signal it actually has (${cap2.signals[0]})`);

const deliberate = omitted;  // ends with END_MARK, so it CHOSE to stop
const notCapped = parseApp(deliberate, paths, before, { doneReason: 'stop' });
say(!notCapped.ok && notCapped.reason === 'MISSING_PATHS', 'a reply that closed its manifest and still omitted a file is MISSING_PATHS, not a cap');
say(!notCapped.capped, 'the two are never conflated: one is capacity, the other is a mistake');

const capNoMarkers = parseApp('I will start with the first file', paths, before, { doneReason: 'length' });
say(capNoMarkers.reason === 'OUTPUT_CAP_EXHAUSTED', 'running out before even one marker is still a cap, not an unrecognisable shape');

// ══ 4. round trip ═══════════════════════════════════════════════════════════════════════════════
console.log('\n4. a parsed application can be written back and re-read');
const ws = mkdtempSync(join(tmpdir(), 'wsf-out-'));
writeApp(ws, ok.files);
const back = governedFiles(ws);
say(JSON.stringify(back) === JSON.stringify(paths), `the written workspace has the same manifest (${back.join(', ')})`);
say(readFileSync(join(ws, 'js', 'app.js'), 'utf8').includes('hello there'), 'with the change intact');

const ws2 = mkdtempSync(join(tmpdir(), 'wsf-copy-'));
copyApp(dir, ws2, paths);
say(JSON.stringify(governedFiles(ws2)) === JSON.stringify(paths), 'and copyApp reproduces the manifest for the other arm');

for (const d of [dir, ws, ws2]) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
console.log(`\n  whole-app contract: ${passed} passed, ${failed} failed -> ${failed ? 'THE CONTRACT CAN BE BROKEN WITHOUT BEING CAUGHT' : 'an omitted, duplicated, invented or echoed file is refused and named'}`);
process.exit(failed ? 1 : 0);
