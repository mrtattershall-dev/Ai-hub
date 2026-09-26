/**
 * playV2.test.mjs - the second increment's play (farm-v2: day/night + selling) against both
 * controls, both ways. A play must pass its own positive control, and the earlier control must
 * fail exactly the new steps - otherwise "protected" and "requested" cannot be told apart.
 *
 *   node server/playV2.test.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { playCheck } = await import('./playCheck.js');
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const FARM = join(HERE, '..', 'legasus', 'bench', 'farm');
const spec1 = JSON.parse(readFileSync(join(FARM, 'play.json'), 'utf8'));
const spec2 = JSON.parse(readFileSync(join(FARM, 'play-v2.json'), 'utf8'));

const r2 = await playCheck(join(FARM, 'controls', 'positive-v2'), spec2, { timeoutMs: 60_000 });
say(r2.status === 'OK' && r2.passing.size === 11 && r2.failing.size === 0, `v2 control under the v2 play: ${r2.passing.size}/${r2.total}${r2.failing.size ? ' failing ' + [...r2.failing].join(',') : ''}`);
if (r2.failing.size) console.log(r2.log.split('\n').filter((l) => /FAIL|ERROR/.test(l)).map((l) => '        ' + l.slice(0, 220)).join('\n'));
const r1 = await playCheck(join(FARM, 'controls', 'positive'), spec2, { timeoutMs: 60_000 });
say(r1.status === 'OK' && [1, 2, 3, 4, 5, 6, 7, 8].every((n) => r1.passing.has(n)) && [9, 10, 11].every((n) => r1.failing.has(n)), `v1 control under the v2 play: passes ${[...r1.passing].join(',')} fails ${[...r1.failing].join(',')} (exactly the new steps)`);
const r2b = await playCheck(join(FARM, 'controls', 'positive-v2'), spec1, { timeoutMs: 60_000 });
say(r2b.status === 'OK' && r2b.passing.size === 8, `v2 control under the v1 play: ${r2b.passing.size}/8 (v2 keeps everything v1 had)`);

console.log(`\n  play v2: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
