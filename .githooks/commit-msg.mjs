// HAZARD 1, MECHANIZED AFTER THIRTEEN OCCURRENCES.
//
// Prose passed through a shell argument gets eaten: backticks become command substitution, backslashes
// become escapes, and the loss is SILENT - the commit succeeds and the damage is found later, if ever.
// Occurrence 13 was inside the write-up of a different recording defect, which is where a rule has to
// stop being a rule and become a gate.
//
// THE GATE. A commit message longer than a bare subject must carry a `Message-File:` trailer naming a
// file whose bytes MATCH the message body. A message typed inline cannot satisfy that, because there is
// no file to match. This guards against ACCIDENT, not an adversary who would simply write the file -
// which is the correct threat model: the failure mode is carelessness thirteen times over, not cunning.
//
// BUILDING THIS GUARD REPRODUCED THE EXACT CLASS IT GUARDS AGAINST, three times over, and the comments
// stay because the next person to write a control needs to see it:
//
//   1. The first threshold was `lines.length <= 3`, which exempted the very message used to test it. A
//      threshold chosen for convenience turns a control into decoration.
//   2. The patch script that was supposed to tighten it printed "threshold tightened" and changed
//      nothing, because the replacement never matched and the script asserted nothing.
//   3. The hook used a `#!/usr/bin/env node` shebang, which git invoked and the system could not run, so
//      it FAILED OPEN - reassuring and inert.
//
// Which is why this file ends with its own proof obligation: the guard must be shown to REFUSE a damaged
// message and ADMIT a well-formed one, in that order, before it is believed.
import { readFileSync, existsSync } from 'node:fs';

const path = process.argv[2];
const raw = readFileSync(path, 'utf8');
const body = raw.split(/\r?\n/).filter((l) => !l.startsWith('#')).join('\n').trim();

// ONLY a bare one-line subject is exempt. There is nothing in one line for the shell to eat unnoticed.
const lines = body.split('\n').filter((l) => l.trim().length);
if (lines.length <= 1) process.exit(0);

const refuse = (...msg) => {
  console.error('');
  console.error('COMMIT REFUSED - HAZARD 1 GUARD');
  console.error('');
  for (const m of msg) console.error('  ' + m);
  console.error('');
  console.error('  Write the message to a file, add a trailer naming it, and commit with -F.');
  console.error('  Prose in a shell argument loses backticks and backslashes SILENTLY.');
  console.error('  Thirteen recorded occurrences; see legasus/legalabs/HAZARDS.md.');
  console.error('');
  process.exit(1);
};

const m = /^Message-File:\s*(.+)$/m.exec(body);
if (!m) refuse('A multi-line commit message must carry a trailer:', '', '    Message-File: <path>');

const file = m[1].trim();
if (!existsSync(file)) refuse('Message-File names a file that does not exist:', '    ' + file);

const strip = (s) => s.split(/\r?\n/).filter((l) => !/^Message-File:/.test(l)).join('\n').trim();
if (strip(readFileSync(file, 'utf8')) !== strip(body)) {
  refuse('The message does not match the file it claims to come from.',
    'That is the signature of shell damage: the file is intact, the argument that',
    'reached git is not.');
}
process.exit(0);
