/**
 * bind2-replay-child.mjs - one fresh process per served file: import it DIRECTLY, call
 * segments(x) for every recorded input in recorded order, print one JSON line per input.
 *
 *   node legasus/bind2-replay-child.mjs <served-file> <fn> <inputs.json>
 *
 * Output per input: { k, o: JSON-string of the return value } | { k, throw: "Name: message" }
 * | { k, apparatus: reason }. A throw is an observation of the subject; an apparatus
 * failure (import failed, function missing) is not, and is typed so it can never read as
 * "returned undefined".
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [file, fn, inputsPath] = process.argv.slice(2);
const inputs = JSON.parse(readFileSync(inputsPath, 'utf8'));
let mod;
try {
  mod = await import(pathToFileURL(file).href);
} catch (e) {
  for (const { k } of inputs) console.log(JSON.stringify({ k, apparatus: `import failed: ${e && e.message}` }));
  process.exit(0);
}
const f = mod[fn];
if (typeof f !== 'function') {
  for (const { k } of inputs) console.log(JSON.stringify({ k, apparatus: `export ${fn} is ${typeof f}` }));
  process.exit(0);
}
for (const { k, x } of inputs) {
  try {
    const r = f(x);
    let o;
    try { o = JSON.stringify(r); } catch (e) { o = `UNSERIALISABLE(${e.message})`; }
    if (o === undefined) o = 'undefined';   // JSON.stringify(undefined) is undefined - keep it visible
    console.log(JSON.stringify({ k, o }));
  } catch (e) {
    console.log(JSON.stringify({ k, throw: `${e && e.name}: ${e && e.message}` }));
  }
}
