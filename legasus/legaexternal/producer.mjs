// r4 — EXTERNAL EVIDENCE PRODUCER.
//
//     REASON AT THE BOUNDARY WHERE AUTHORITY ORIGINATES; ADAPT EVIDENCE RATHER THAN REENACTING THE
//     AUTHORITY BEHIND IT.
//
// Three defects in one night all had the same root, and it was not "the doctest replay has bugs":
//
//     doctest truth              Legasus reconstruction
//     want = "integer\n"    ->   "integer"              information destroyed
//     example identity      ->   module|source          identity destroyed
//     failure semantics     ->   a local vocabulary     semantics approximated
//
// LEGASUS HAD PLACED ITSELF INSIDE THE TRUTH-PRODUCING MECHANISM WHEN IT ONLY NEEDED TO BE AN EVIDENCE
// CONSUMER. CPython owns discovery, sequencing, shared globals, exception semantics, output comparison
// and option flags. This module runs that authority and records what it said. It does not decide any of
// those things, and it must never say "here is what I think doctest would have reported".
//
// DOCTEST IS NOT AN ORACLE. A PASS establishes satisfaction of THAT example under THAT execution and
// context - nothing about general correctness, preservation outside the exercised behaviour, or project
// advancement. The record below carries the scope that bounds it.
//
// IDENTITY IS NOT SOURCE TEXT. Two identical `print(result.dump())` examples in different DocTests are
// DIFFERENT EXPERIMENTS; `module|source` collapsed them and silently corrupted a cohort. Identity here is
// the producer, the DocTest name and the example's ordinal within it. The source text is carried as
// DESCRIPTION. A hash is not used as identity either: a hash only faithfully identifies the fields
// chosen to hash, so hashing a coarse tuple would merely make the coarseness look authoritative.
import { runIsolated } from '../legaexercise/channel.mjs';

const NL = String.fromCharCode(10);

const PROGRAM = [
  'import doctest, importlib, json, sys, platform',
  'sys.path.insert(0, sys.argv[1])',
  'mods = json.loads(sys.argv[2])',
  'records = []',
  'finder = doctest.DocTestFinder(exclude_empty=True)',
  'checker = doctest.OutputChecker()',
  'for modname in mods:',
  '    try:',
  '        mod = importlib.import_module(modname)',
  '    except BaseException as e:',
  '        records.append({"module": modname, "nativeResult": "IMPORT_FAILED",',
  '                        "nativeDetails": {"exception": type(e).__name__}})',
  '        continue',
  '    for t in finder.find(mod, modname):',
  '        seen = {"i": 0}',
  '        class R(doctest.DocTestRunner):',
  '            def _rec(self, test, example, native, details):',
  '                records.append({',
  '                    "module": modname,',
  '                    "testName": test.name,',
  '                    "ordinal": test.examples.index(example),',
  '                    "lineno": getattr(example, "lineno", None),',
  '                    "nativeResult": native,',
  '                    "nativeDetails": details,',
  '                    "source": example.source.rstrip(),',
  '                    "want": example.want,',
  '                    "optionflags": example.options and {str(k): v for k, v in',
  '                                                        example.options.items()} or {},',
  '                })',
  '            def report_success(self, o, test, example, got):',
  '                self._rec(test, example, "PASS", {"got": got[:600]})',
  '            def report_failure(self, o, test, example, got):',
  '                self._rec(test, example, "OUTPUT_MISMATCH", {"got": got[:600]})',
  '            def report_unexpected_exception(self, o, test, example, exc_info):',
  '                self._rec(test, example, "UNEXPECTED_EXCEPTION",',
  '                          {"exception": exc_info[0].__name__})',
  '        R(verbose=False, optionflags=0).run(t, out=lambda s: None, clear_globs=False)',
  '        del seen',
  '_emit({"producer": "CPython doctest",',
  '       "producerVersion": platform.python_version(),',
  '       "records": records})',
].join(NL);

// Run the producer. Uses the V1 isolated channel, so a subject that prints cannot corrupt the producer's
// own report - the two repairs compose.
export function runProducer({ rootDir, modules, timeoutMs = 300000 }) {
  const r = runIsolated({ body: PROGRAM, timeoutMs, args: [rootDir, JSON.stringify(modules)] });
  if (r.protocol === null) {
    // PRODUCER FAILURE IS NEVER SUBJECT EVIDENCE. This says the producer could not be run; it says
    // nothing whatever about the code under test.
    return { ok: false, producerFailed: true,
      why: r.parseError || r.threw || 'the producer emitted no protocol',
      subjectBytes: r.subjectBytes };
  }
  const { producer, producerVersion, records } = r.protocol;
  return {
    ok: true,
    producer,
    producerVersion,
    subjectBytes: r.subjectBytes,
    // RAW, and preserved verbatim. A later revision with a better vocabulary must be able to re-adapt
    // this without rerunning the subject or pretending its ontology existed at observation time.
    // A RECORD WITH NO EXAMPLE HAS NO DOCUMENT AND NO ORDINAL. The first version wrote
    // `document: testName ?? '<module>'` and `ordinal: x.ordinal ?? i` - the flat index of the record
    // in this array - so an IMPORT_FAILED record was given coordinates it does not have, and the
    // adapter then built a history for an experiment that never existed (composition attack W2-f).
    // That is the producer #2 strain, "undefined#undefined", living in producer #1 with a nicer
    // spelling. A coordinate the producer cannot establish is ABSENT; the module the failure belongs
    // to is carried as the one thing such a record does know.
    records: records.map((x) => ({
      ...x,
      identity: x.testName === undefined
        ? { producer, producerVersion, module: x.module, lineno: x.lineno ?? null }
        : { producer, producerVersion, document: x.testName, ordinal: x.ordinal,
          lineno: x.lineno ?? null },
    })),
  };
}

// The identity of one external experiment, as a comparable string. Source text is deliberately absent,
// and a record with no example says so with '-' rather than borrowing a number.
export const externalIdentity = (rec) => [rec.identity.producer, rec.identity.producerVersion,
  rec.identity.document ?? ('module:' + rec.identity.module),
  rec.identity.ordinal === undefined ? '-' : String(rec.identity.ordinal)].join('|');

export { NL };
