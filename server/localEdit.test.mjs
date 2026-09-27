/**
 * localEdit.test.mjs - the localized-edit protocol, driven end to end through the real play, the
 * real evaluator and the real acceptance policy.
 *
 *   node server/localEdit.test.mjs
 *
 * The cell that matters most is the POSITIVE CONTROL: a hand-written correct edit, applied
 * through the protocol, must reach RETAIN. Without it, a run where the model scores zero cannot
 * be told apart from a protocol that could never have succeeded - which is exactly the mistake
 * that made an earlier arm score 0/20 for reasons that had nothing to do with the model.
 *
 *   1. parsing and applying, as units (unique match, missing, ambiguous, cut off, partial)
 *   2. anchor: a hand-written CORRECT edit            -> every boundary YES, RETAIN
 *   3. anchor: FIND text that is not in the file      -> E2 no, nothing written, file untouched
 *   4. anchor: FIND text that appears twice           -> AMBIGUOUS, refused, file untouched
 *   5. anchor: prose around a good block              -> E1b no, still applied (both recorded)
 *   6. anchor: the whole file instead of a block      -> E1 no (the INC2-1 failure mode, refused)
 *   7. fim: a hand-written CORRECT infill             -> every boundary YES, RETAIN
 *   8. fim: an empty completion                       -> E1 no, nothing written
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const { parseEditBlocks, applyEditBlocks, cutRegion } = await import('./localEdit.mjs');
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const START = readFileSync(join(HERE, '..', 'legasus', 'screen', 'NARROW-2_accepted_index.html'), 'utf8');
const WIRING = [
  "        document.addEventListener('keydown', movePlayer);",
  "        document.addEventListener('p', plantSeed);",
  "        document.addEventListener('t', advanceTime);",
  "        document.addEventListener('h', harvestCrop);",
  "        document.addEventListener('s', saveGame);",
  "        document.addEventListener('load', loadGame);",
].join('\n');

/**
 * A correct increment 2, written by hand. It replaces the broken wiring: `p` and `t` were bound
 * as if they were event names, planting never spent a seed and time never grew anything. draw()
 * throws on a missing element and lives outside this region, so every call to it is guarded -
 * the fixture's job is to be correct about planting and growth, not to fix the whole page.
 */
const GOOD_REPLACEMENT = [
  '        function plantHere() {',
  '            const k = `${player.x},${player.y}`;',
  '            if (!tiles[k] && inventory.seeds > 0) {',
  "                tiles[k] = { crop: 'wheat', stage: 0 };",
  '                inventory.seeds--;',
  '                try { draw(); } catch (e) { /* drawing is not what is under test here */ }',
  '            }',
  '        }',
  '',
  '        function tick() {',
  '            day++;',
  '            for (const k of Object.keys(tiles)) {',
  '                if (tiles[k].stage < 3) tiles[k].stage++;',
  '            }',
  '            try { draw(); } catch (e) { /* as above */ }',
  '        }',
  '',
  "        document.addEventListener('keydown', (e) => {",
  "            if (e.key === 'p') plantHere();",
  "            else if (e.key === 't') tick();",
  "            else { try { movePlayer(e); } catch (err) { /* as above */ } }",
  '        });',
].join('\n');

const GOOD_BLOCK = ['<<<<<<< FIND', WIRING, '=======', GOOD_REPLACEMENT, '>>>>>>> END'].join('\n');

/** A fake ollama answering BOTH endpoints, so chat and infill cells share one server. */
function fakeOllama(reply, doneReason = 'stop') {
  return new Promise((resolve) => {
    const srv = createServer((req, res) => {
      let body = '';
      req.on('data', (d) => { body += d; });
      req.on('end', () => {
        res.writeHead(200, { 'content-type': 'application/x-ndjson' });
        const chunks = String(reply).match(/[\s\S]{1,120}/g) || [];
        for (const c of chunks) res.write(JSON.stringify({ model: 'fake', response: c, message: { role: 'assistant', content: c }, done: false }) + '\n');
        res.end(JSON.stringify({ model: 'fake', response: '', message: { role: 'assistant', content: '' }, done: true, done_reason: doneReason, eval_count: 40, prompt_eval_count: 900 }) + '\n');
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

async function run(label, reply, protocol, doneReason = 'stop', extra = []) {
  const { srv, port } = await fakeOllama(reply, doneReason);
  const base = mkdtempSync(join(tmpdir(), `le-base-${label}-`));
  writeFileSync(join(base, 'index.html'), START, 'utf8');
  const dir = mkdtempSync(join(tmpdir(), `le-${label}-`));
  const out = join(dir, 'result.json');
  await new Promise((resolve) => {
    const p = spawn(process.execPath, [join(HERE, 'localEdit.mjs'), '--model-url', `http://127.0.0.1:${port}`,
      '--model', 'fake', '--task', 'farm-i2', '--protocol', protocol, '--seed', '7',
      '--workspace', base, '--deadline-sec', '120', '--out', out, ...extra], { stdio: ['ignore', 'pipe', 'pipe'] });
    let o = ''; p.stdout.on('data', (d) => { o += d; }); p.stderr.on('data', (d) => { o += d; });
    p.on('exit', () => { console.log(o.split('\n').filter(Boolean).map((l) => '        ' + l).join('\n')); resolve(); });
  });
  srv.close();
  const rec = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : null;
  const startUntouched = readFileSync(join(base, 'index.html'), 'utf8') === START;
  try { rmSync(dir, { recursive: true, force: true }); rmSync(base, { recursive: true, force: true }); } catch { /* best effort */ }
  return { rec, startUntouched };
}

console.log('=== 1. parsing and applying, as units ===');
{
  const p = parseEditBlocks(GOOD_BLOCK);
  say(p.blocks.length === 1 && p.outside === '' && !p.incomplete, 'one clean block parses with nothing outside it');
  const a = applyEditBlocks(START, p.blocks);
  say(a.applicable && a.results[0].status === 'APPLIED' && a.text !== START && a.text.includes('function tick()'), 'a unique FIND applies and changes the text');

  const missing = parseEditBlocks(['<<<<<<< FIND', 'a line that is not in the file', '=======', 'x', '>>>>>>> END'].join('\n'));
  const am = applyEditBlocks(START, missing.blocks);
  say(!am.applicable && am.results[0].status === 'NOT_FOUND' && am.text === START, 'a FIND that is absent is NOT_FOUND and the text is returned unchanged');

  const twice = parseEditBlocks(['<<<<<<< FIND', '            draw();', '=======', '            draw(); // once', '>>>>>>> END'].join('\n'));
  const at = applyEditBlocks(START, twice.blocks);
  say(!at.applicable && at.results[0].status === 'AMBIGUOUS' && at.results[0].count > 1 && at.text === START, `a FIND matching ${at.results[0].count} places is AMBIGUOUS, never guessed at`);

  const cut = parseEditBlocks(['<<<<<<< FIND', WIRING, '======='].join('\n'));
  say(cut.blocks.length === 0 && cut.opened === 1 && cut.incomplete, 'a block cut off before its end is INCOMPLETE and yields no block');

  const two = parseEditBlocks([GOOD_BLOCK, ['<<<<<<< FIND', 'not present anywhere', '=======', 'y', '>>>>>>> END'].join('\n')].join('\n'));
  const a2 = applyEditBlocks(START, two.blocks);
  say(two.blocks.length === 2 && !a2.applicable && a2.text === START, 'one good block and one bad block change NOTHING - no partial splice');

  const region = cutRegion(START, '        function plantSeed() {', "        document.addEventListener('load', loadGame);");
  say(region.ok && region.prefix.endsWith('\n') && region.removed.includes('function advanceTime') && region.suffix.includes('window.game'), 'the fim region cuts between the named lines, leaving the seam in the suffix');
  say(cutRegion(START, 'no such line', 'x').ok === false, 'a region whose first line is absent is refused, not approximated');
}

console.log('\n=== 2. anchor: a hand-written CORRECT edit ===');
{
  const { rec } = await run('good', GOOD_BLOCK, 'anchor');
  const b = rec?.boundaries || {};
  say(b.editProduced && b.editContractClean && b.editApplicable && b.editApplied, 'E1-E3: produced, clean, applicable, applied');
  say(b.changedProgram === true, 'E4: the program CHANGED (the boundary INC2-1 failed)');
  say(b.reachedExecution === true && b.passedProtected === true, 'E5-E6: it runs and the protected steps still pass');
  say(b.passedDiagnostic === true, `E7: planting and growth work (play passing [${(rec?.play?.passing || []).join(',')}])`);
  say(b.accepted === true && rec?.acceptance?.disposition === 'RETAIN', `E8: RETAIN (${rec?.acceptance?.disposition})`);
  say(rec?.assistance?.editSiteChosenBy === 'model' && rec?.assistance?.featureSplitIntoSteps === false, 'the record states the site was chosen by the model and the feature was not split');
}

console.log('\n=== 3. anchor: FIND text that is not in the file ===');
{
  const { rec, startUntouched } = await run('absent', ['<<<<<<< FIND', '        function plantSeed() { // with a comment it does not have', '=======', '        function plantSeed() {', '>>>>>>> END'].join('\n'), 'anchor');
  const b = rec?.boundaries || {};
  say(b.editProduced === true && b.editApplicable === false, 'E1 yes, E2 no: a well-formed edit that does not match');
  say(b.editApplied === undefined && !('changedProgram' in b), 'nothing was applied and no program change is claimed');
  say(rec?.edit?.results?.[0]?.status === 'NOT_FOUND', `the refusal names why (${rec?.edit?.results?.[0]?.status})`);
  say(startUntouched, 'the starting file on disk is untouched');
}

console.log('\n=== 4. anchor: FIND text that appears twice ===');
{
  const { rec } = await run('ambig', ['<<<<<<< FIND', '            draw();', '=======', '            draw(); /* edited */', '>>>>>>> END'].join('\n'), 'anchor');
  say(rec?.boundaries?.editApplicable === false && rec?.edit?.results?.[0]?.status === 'AMBIGUOUS', 'an ambiguous anchor is refused rather than applied at the first match');
}

console.log('\n=== 5. anchor: prose around a good block ===');
{
  const { rec } = await run('prose', ['Here is the change you asked for:', '', GOOD_BLOCK, '', 'Let me know if you want more!'].join('\n'), 'anchor');
  const b = rec?.boundaries || {};
  say(b.editProduced === true && b.editContractClean === false, 'E1 yes, E1b no: the block is usable, the contract was still broken');
  say(b.accepted === true, 'and the edit itself still reaches RETAIN, so the two are recorded apart');
}

console.log('\n=== 6. anchor: the whole file instead of a block (the INC2-1 failure mode) ===');
{
  const { rec, startUntouched } = await run('wholefile', '```html\n' + START + '\n```', 'anchor');
  say(rec?.boundaries?.editProduced === false, 'E1 no: a whole-file reply produces no edit under this protocol');
  say(startUntouched, 'and nothing is written');
}

console.log('\n=== 7. fim: a hand-written CORRECT infill ===');
{
  const { rec } = await run('fimgood', GOOD_REPLACEMENT + '\n', 'fim');
  const b = rec?.boundaries || {};
  say(b.editProduced && b.editApplicable && b.editApplied && b.changedProgram, 'E1-E4: the infill was produced, applied and changed the program');
  say(b.passedProtected === true && b.passedDiagnostic === true && b.accepted === true, `E6-E8: protected and requested both pass, RETAIN (${rec?.acceptance?.disposition})`);
  say(rec?.assistance?.editSiteChosenBy === 'harness' && !!rec?.assistance?.region?.removedLines, `the record states the HARNESS chose the site (${rec?.assistance?.region?.removedLines} lines removed) and carries the instruction comment`);
  say(typeof rec?.assistance?.instructionComment === 'string' && rec.assistance.instructionComment.includes('Increment 2'), 'the instruction comment the harness inserted is recorded verbatim');
}

console.log('\n=== 8. fim: an empty completion ===');
{
  const { rec, startUntouched } = await run('fimempty', '   \n', 'fim');
  say(rec?.boundaries?.editProduced === false, 'E1 no: an empty infill is not an edit');
  say(startUntouched, 'and nothing is written');
}

console.log('\n=== 9. a whole-file FIND is followed as a format and refused as an edit ===');
{
  // What the 1.5B actually did on every anchor attempt: copy the ENTIRE file into FIND, then
  // replace it with a few characters. The block is well formed and applicable, so E1 and E2 say
  // yes; E2b must say no, or "changed the program" would read as a localized change when the
  // program was in fact deleted.
  const destroy = ['<<<<<<< FIND', START.replace(/\n$/, ''), '=======', '=======', '>>>>>>> END'].join('\n');
  const { rec } = await run('whole-find', destroy, 'anchor');
  const b = rec?.boundaries || {};
  say(b.editProduced === true && b.editApplicable === true, 'E1-E2: the block is well formed and its FIND matches');
  say(b.editIsLocalized === false, 'E2b: it is NOT a localized edit - the FIND is the whole file');
  say(b.changedProgram === true && b.passedProtected === false, 'E4 yes and E6 no: the program changed because it was destroyed');
  say(rec?.acceptance?.disposition === 'RESTORED', `and the rollback put the accepted page back (${rec?.acceptance?.disposition})`);
  say(rec?.edit?.localization?.[0]?.findIsWholeFile === true, 'the record says the FIND was the whole file');
}

console.log('\n=== 10. the SMALLER fim region, with the movement wiring left intact ===');
{
  // The first fim region ran from plantSeed through the last listener, which swallowed
  // addEventListener('keydown', movePlayer) - so an infill that did not re-add it lost movement,
  // and four of five attempts failed the protected steps for that reason. This region starts one
  // line later, leaving movement wired, and must still be passable by a correct edit.
  const FROM = "        document.addEventListener('p', plantSeed);";
  const TO = "        document.addEventListener('load', loadGame);";
  const region = cutRegion(START, FROM, TO);
  say(region.ok && region.prefix.includes("addEventListener('keydown', movePlayer)"), 'the smaller region leaves the movement wiring in the prefix');
  const GOOD_SMALL = [
    "        document.addEventListener('keydown', (e) => {",
    "            if (e.key === 'p') {",
    '                const k = `${player.x},${player.y}`;',
    '                if (!tiles[k] && inventory.seeds > 0) {',
    "                    tiles[k] = { crop: 'wheat', stage: 0 };",
    '                    inventory.seeds--;',
    '                }',
    "            } else if (e.key === 't') {",
    '                day++;',
    '                for (const k of Object.keys(tiles)) if (tiles[k].stage < 3) tiles[k].stage++;',
    '            }',
    '            try { draw(); } catch (err) { /* draw throws on a missing element, outside this region */ }',
    '        });',
  ].join('\n');
  const { rec } = await run('fimsmall', GOOD_SMALL + '\n', 'fim', 'stop', ['--region-from', FROM, '--region-to', TO]);
  const b = rec?.boundaries || {};
  say(b.passedProtected === true, 'movement and existing behaviour survive (steps 1-3)');
  say(b.passedDiagnostic === true && b.accepted === true, `planting and growth work, RETAIN (${rec?.acceptance?.disposition})`);
  say(rec?.assistance?.region?.removedLines <= 6, `the hole is ${rec?.assistance?.region?.removedLines} lines, not 42`);
  // The raw completion, the harness's transformation of it and the judged candidate must ALL be on
  // the record, so the assistance can never become invisible in a later reading.
  say(typeof rec?.rawReply === 'string' && rec.rawReply.length > 0, 'the RAW completion is recorded');
  say(rec?.transformed?.kind === 'fim-middle' && typeof rec.transformed.middleUsed === 'string', 'the TRANSFORMED middle the harness spliced is recorded beside it');
  say(!!rec?.candidate?.sha256 && rec.candidate.chars > rec.transformed.middleUsedChars, 'the CANDIDATE the gate judged is recorded with its sha256');
  say(rec.transformed.identicalToRaw === true, 'and this run reports the transformation as a no-op, because no trim was requested');
}

console.log(`\n  localized edit: ${passed} passed, ${failed} failed -> ${failed ? 'THE PROTOCOL IS NOT ESTABLISHED' : 'a correct edit reaches RETAIN through both protocols, and every refusal is deterministic'}`);
process.exit(failed ? 1 : 0);
