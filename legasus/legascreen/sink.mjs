// LEGASCREEN — BACKWARD-1. Discovery from effect sinks.
//
// Forward discovery seeds on an identity brand, and a brand exists only where somebody built one.
// A screen that works only on software built to be understood by it is a mirror, not a screen.
//
//     FORWARD    evidence/authority -> possible influence
//     BACKWARD   effect -> required justification
//
// Something eventually happens. A file changes, a process starts, version control mutates. Those
// cross a RUNTIME boundary, and a subject cannot hide them by architecture the way it can hide
// authority by not having any.
//
// THE SINK CLASSES ARE CATEGORIES. The mapping below from category to runtime module is the one
// place a name appears, and every name in it is a property of the NODE PLATFORM rather than of any
// subject: no file, function or API of the code under test is named anywhere in this module. Every
// export of a sink module is wrapped, so nothing depends on picking the interesting functions.
//
// AND A PRIVATE FUNCTION IS NOT UNSCREENABLE. It is not directly interceptable, which is a different
// thing. Intercept the sink, record the ancestry that reached it, and the private frames on that
// path become candidates because they PARTICIPATED IN A WITNESSED EFFECT - not because somebody
// exported them.
export const SINK_CLASS = {
  FILESYSTEM_MUTATION: 'FILESYSTEM_MUTATION',
  PROCESS_EXECUTION: 'PROCESS_EXECUTION',
  VERSION_CONTROL_MUTATION: 'VERSION_CONTROL_MUTATION',
  STATE_PERSISTENCE: 'STATE_PERSISTENCE',
  NETWORK_EGRESS: 'NETWORK_EGRESS',
  COMMIT_OPERATION: 'COMMIT_OPERATION',
};

// Category -> runtime module boundary. Platform names only.
export const SINK_MODULES = {
  fs: SINK_CLASS.FILESYSTEM_MUTATION,
  'node:fs': SINK_CLASS.FILESYSTEM_MUTATION,
  'fs/promises': SINK_CLASS.FILESYSTEM_MUTATION,
  'node:fs/promises': SINK_CLASS.FILESYSTEM_MUTATION,
  child_process: SINK_CLASS.PROCESS_EXECUTION,
  'node:child_process': SINK_CLASS.PROCESS_EXECUTION,
  http: SINK_CLASS.NETWORK_EGRESS,
  'node:http': SINK_CLASS.NETWORK_EGRESS,
  https: SINK_CLASS.NETWORK_EGRESS,
  'node:https': SINK_CLASS.NETWORK_EGRESS,
  net: SINK_CLASS.NETWORK_EGRESS,
  'node:net': SINK_CLASS.NETWORK_EGRESS,
};

export const REACHABILITY = {
  PRODUCTION_REACHED: 'PRODUCTION_REACHED',
  TEST_ONLY: 'TEST_ONLY',
  UNREACHED: 'UNREACHED',
  // A claim that needs the whole path cannot be made from a path with a hole in it.
  ANCESTRY_INCOMPLETE: 'ANCESTRY_INCOMPLETE',
};

export const STAGE = {
  EFFECT_DISCOVERED: 'EFFECT_DISCOVERED',
  EFFECT_WITNESSED: 'EFFECT_WITNESSED',
  ANCESTRY_OBSERVED: 'ANCESTRY_OBSERVED',
  SUPPORT_CHARACTERIZED: 'SUPPORT_CHARACTERIZED',
  JUSTIFICATION_ESTABLISHED: 'JUSTIFICATION_ESTABLISHED',
  SCREENED: 'SCREENED',
};

// A frame, parsed from a stack. Names come from the runtime and are used for REPORTING; nothing in
// discovery depends on them.
// ANCHORED AT THE END, NOT AT THE PATH SHAPE. The first version tried to recognise a path by its
// prefix and stopped at the first colon, so every ESM frame on Windows - `file:///C:/...` - failed
// to parse and was dropped. The run then reported PRODUCTION_REACHED 0 with complete confidence:
// an unparsed representation became a measured absence, which is this project's oldest failure
// wearing a regular expression. The line/column pair is the only reliable anchor.
const FRAME = /at (?:async )?(?:(.+?) )?\(?(.+):(\d+):(\d+)\)?$/;

// A LINE THAT LOOKS LIKE A FRAME AND DOES NOT PARSE IS `FRAME_UNPARSED`, NOT NOTHING.
//
// Dropping it silently is how the last run reported PRODUCTION_REACHED 0 with complete confidence:
//
//     REPRESENTATION_UNRECOGNIZED  ->  EMPTY SET  ->  SEMANTIC ABSENCE
//
// Information destruction increased certainty, which is Law 1 arriving inside the instrument. An
// unparsed frame therefore POISONS every downstream claim that needs complete ancestry - it might
// have been the frame where control crossed - while leaving the frames that did parse valid as
// participation. NO OBSERVATION IS NOT OBSERVED NOTHING.
export function frames(stack) {
  const parsed = [];
  let unparsed = 0;
  let excluded = 0;
  for (const raw of String(stack || '').split('\n').slice(1)) {
    const line = raw.trim();
    if (!line.startsWith('at ')) continue;                 // not a frame line at all
    const m = FRAME.exec(line);
    if (!m) { unparsed++; continue; }                      // a frame we could not read
    const file = m[2].replace(/^file:\/\/\/?/, '').replace(/\\/g, '/');
    // Recognised and deliberately out of scope - a different fact from unreadable.
    if (/[/\\]node_modules[/\\]/.test(file) || file.startsWith('node:')) { excluded++; continue; }
    parsed.push({ fn: m[1] || '<anonymous>', file, line: Number(m[3]) });
  }
  return { parsed, unparsed, excluded, complete: unparsed === 0 };
}

export const isTestFile = (f) => /\.test\.[cm]?[jt]s$|[/\\]tests?[/\\]/.test(f || '');

// The observations. One per witnessed effect.
export function sinkRecorder() {
  const events = [];
  let armed = true;

  const api = {
    // Wraps ONE export of a sink module. Non-functions pass through untouched.
    wrap(sinkClass, moduleName, exportName, value) {
      if (typeof value !== 'function') return value;
      return function instrumentedSink(...args) {
        if (armed) {
          const err = new Error('lgs-sink');
          armed = false;                        // a sink reached from inside a sink is one effect
          try {
            const f = frames(err.stack);
            events.push({ sinkClass, module: moduleName, name: exportName,
              arity: args.length, at: events.length, stack: f.parsed,
              unparsed: f.unparsed, excluded: f.excluded, ancestryComplete: f.complete });
          } finally { armed = true; }
        }
        return value.apply(this, args);
      };
    },
    events: () => events.slice(),
    clear() { events.length = 0; },
  };
  return api;
}
