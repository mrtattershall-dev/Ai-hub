// IS SITE 3 OF MY OWN REFERENCE PLAN DEAD CODE, AND DOES THE DELTA PROBE MISS IT?
//
// MUTATE_PRESERVE=3 inserted `current.append("ZZZ")` - valid Python that should corrupt paragraph
// accumulation - and the run still verified 7/7. That is only possible if the insertion is never
// executed. Site 3's anchor ends with `continue`, so everything inserted there lands AFTER the
// continue: unreachable.
//
// Which means my reference patch's site 3 (`flush_ol()` in the blank-line branch) is also dead. The
// reference still passes both suites, so the question is whether the DELTA PROBE is simply not testing
// the input that would expose it - two ordered lists separated by a blank line should be two <ol>
// blocks, and with a dead flush there is nothing to close the first one.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SITES, locate } from './oraclesites.mjs';

const NL = String.fromCharCode(10);
let src = readFileSync('./seed60/s4_markdown.py', 'utf8');
const sites = SITES[64].sites;

// Apply the full reference patch.
for (const site of sites) {
  const l = locate(src, site);
  if (!l.ok) throw new Error('anchor: ' + l.why);
  src = l.before + site.reference + l.after;
}

// Is the site-3 insertion reachable? Find the line and check what precedes it in its block.
const lines = src.split(NL);
const idx = lines.findIndex((l, i) => l.trim() === 'flush_ol()' && i > 0
  && lines[i - 1].trim() === 'continue');
console.log('  site-3 insertion preceded by `continue` in the same block: ' + (idx !== -1)
  + (idx !== -1 ? '  -> line ' + (idx + 1) + ' is UNREACHABLE' : ''));

const d = mkdtempSync(join(tmpdir(), 'deadsite-'));
writeFileSync(join(d, 'm.py'), src, 'utf8');
const t = [
  'import m',
  'a = m.to_html("1. a' + '\\n' + '2. b")',
  'b = m.to_html("1. a' + '\\n\\n' + '2. b")',
  'print("single list   ", repr(a))',
  'print("blank-separated", repr(b))',
  'print("expected       ", repr("<ol><li>a</li></ol>' + '\\n' + '<ol><li>b</li></ol>"))',
  'print("CORRECT        ", b == "<ol><li>a</li></ol>' + '\\n' + '<ol><li>b</li></ol>")',
].join(NL);
writeFileSync(join(d, 't.py'), t, 'utf8');
console.log(execSync('python t.py', { cwd: d }).toString());

// And does the delta probe even ask?
const probeSrc = readFileSync('./probes60.mjs', 'utf8');
const body = probeSrc.slice(probeSrc.indexOf('export const probe64'), probeSrc.indexOf('export const probe74'));
const asks = /1\.\s*a?\\n\\n|\\n\\n/.test(body);
console.log('  does probe64 test any blank-line-separated ordered list? ' + asks);
console.log('  probe64 inputs:');
for (const m of body.matchAll(/to_html\("([^"]*)"\)/g)) console.log('    ' + JSON.stringify(m[1]));
