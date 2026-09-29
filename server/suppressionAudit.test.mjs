/**
 * suppressionAudit.test.mjs — can the leak check FIRE?
 *
 *   node server/suppressionAudit.test.mjs
 *
 * The first version of the leak check was a proximity test and reported 36 leaks that were all one false
 * positive. Replacing it with a narrower test risks the opposite defect: a check that never fires and
 * therefore always reports "no problems". That is the class this project has already shipped once
 * (`[].every()` is true) and caught twice (`|| true`, and a kill test that killed the wrong process).
 *
 * So the narrowed predicate is exercised against prompts that DO carry the answer and prompts that do
 * not. Both directions, or the check is not a check.
 */
const NL = String.fromCharCode(10);
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

/** The predicate exactly as `suppressionAudit.mjs` applies it. */
function wiredInPrompt(prompt, id) {
  const bindAfter = new RegExp(`${id}['"]?\\s*\\)?\\s*\\.\\s*(addEventListener|onclick|onClick)`);
  const sameLine = prompt.split(NL).some((l) => l.includes(id) && /addEventListener|onclick/i.test(l));
  return bindAfter.test(prompt) || sameLine;
}

const ID = 'clear-filter';

// ══ it must FIRE on a prompt that really does carry a wired implementation ══════════════════════
console.log('\nprompts that DO carry the answer - the check must fire');
const leaks = [
  ["getElementById then addEventListener", `document.getElementById('clear-filter').addEventListener('click', function () { field.value = ''; });`],
  ['querySelector form', `document.querySelector('#clear-filter').addEventListener('click', reset);`],
  ['onclick property', `document.getElementById('clear-filter').onclick = reset;`],
  ['split across whitespace', `document.getElementById('clear-filter')${NL}  .addEventListener('click', reset);`],
  ['a variable assigned then bound on one line', `const b = q('clear-filter'); b.addEventListener('click', reset);`],
];
for (const [name, p] of leaks) say(wiredInPrompt(p, ID), `${name}`);

// ══ it must STAY SILENT on the prompts this experiment actually sent ════════════════════════════
console.log('\nprompts that do NOT carry the answer - the check must stay silent');
const clean = [
  ['the real chat prompt shape: the page, then the requirement naming the control',
    `field.addEventListener('input', filterRows);${NL}</script>${NL}</body>${NL}</html>${NL}${NL}A user wants this change: when #clear-filter is clicked: #q is empty; every item in the list is visible again.`],
  ['the requirement alone', `when #clear-filter is clicked: #q is empty; every item in the list is visible again.`],
  ['the page alone, with its own listener', `field.addEventListener('input', filterRows);`],
  ['the control named near a listener on a DIFFERENT element, on separate lines',
    `document.getElementById('q').addEventListener('input', go);${NL}// the user wants a #clear-filter control`],
];
for (const [name, p] of clean) say(!wiredInPrompt(p, ID), `${name}`);

console.log(`\n  leak-check control: ${passed} passed, ${failed} failed -> ${failed ? 'THE CHECK IS NOT TRUSTWORTHY' : 'it fires on a real leak and stays silent on the prompts actually sent'}`);
process.exit(failed ? 1 : 0);
