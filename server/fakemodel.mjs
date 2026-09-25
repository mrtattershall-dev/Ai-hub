/**
 * fakemodel.mjs - an Ollama-shaped endpoint that plays SCRIPTED misbehaviour.
 *
 *   node server/fakemodel.mjs --port 11500 --script loop
 *   then point the hub's Ollama base_url at http://localhost:11500
 *
 * WHY A DUMB MODEL IS THE RIGHT TEST
 * ----------------------------------
 * The agent's guards - the loop detector, the parse-failure window, the budget, the
 * finish gate, the approval policy, the auto-checkpoint - have only ever been verified
 * by REGEX AGAINST THE SOURCE. agent_audit.mjs checks that the code says it does these
 * things. Nothing has ever watched one actually fire.
 *
 * That is a real gap, and a smart model cannot close it: you cannot ask a good model to
 * reliably loop, or to emit exactly five unparseable replies in ten. You need a model
 * that misbehaves ON PURPOSE, deterministically, for free, in seconds.
 *
 * So this speaks the /api/chat contract the hub already uses and returns canned agent
 * actions from a named script. Each script provokes one guard:
 *
 *   loop        the same response over and over        -> sliding-window loop guard
 *   garbage     unparseable replies                    -> parse-failure window
 *   denied      a command the policy refuses           -> continues instead of halting
 *   approval    a command that needs a human           -> pauses (fatal when unattended)
 *   premature   edits a file then calls finish         -> finish gate demands proof
 *   ledger      builds without ever marking a task     -> ledger left untouched
 *   happy       writes a working file, verifies, ends  -> the control
 *   assets      looks a sprite up in the library, loads it by exact path, verifies
 *
 * Nothing here is intelligent, and that is the point. It tests the LOOP, not the model.
 */
import fs from 'node:fs';
import { createServer } from 'http';

const argv = process.argv.slice(2);
const val = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const PORT = parseInt(val('port', '11500'), 10);
const SCRIPT = val('script', 'happy');
// FAULT MODES for the call-deadline tests (callDeadline.test.mjs). Neither touches the
// replies: they change WHEN (or whether) the answer arrives.
//   --never          never answer: stream an empty heartbeat frame every second, forever, the
//                    way a serving container does while it is still generating. The hub's
//                    inter-token stall timer cannot fire on this - which is exactly BENCH-2.
//   --delay-ms N     answer normally, but only after N ms.
// Both record what the SERVER saw to FAKE_EVENT_LOG: whether the client went away first,
// and whether a late answer was ever sent. That is how a test proves "the late reply was
// never acted on" from the server's side as well as the hub's.
const NEVER = argv.includes('--never');
//   --blackhole      accept the request, send NOTHING, never close, and IGNORE the client
//                    going away. The closest a stub can get to an operation that neither
//                    settles nor honours cancellation - the shape that cost AUTODIAG-1 half
//                    its units (a call whose deadline fired while its await ran on for 5,964s).
const BLACKHOLE = argv.includes('--blackhole');
const DELAY_MS = parseInt(val('delay-ms', '0'), 10);
//   --hold-ms N      send the COMPLETE reply immediately, then keep the stream open N ms before
//                    ending it. The hub has the whole answer in hand while a stop can land - the
//                    genuinely-late-arrival case: bytes delivered, run already stopped.
const HOLD_MS = parseInt(val('hold-ms', '0'), 10);
const event = (e) => { if (process.env.FAKE_EVENT_LOG) { try { fs.appendFileSync(process.env.FAKE_EVENT_LOG, JSON.stringify({ at: Date.now(), ...e }) + String.fromCharCode(10)); } catch {} } };

// ── the scripts ───────────────────────────────────────────────────────────────
// Each is a list of replies. Once exhausted the last one repeats, so a guard that
// SHOULD fire has unlimited opportunity to - and a guard that does not fire shows up
// as a run that never ends.
const SCRIPTS = {
  // Uses the asset library the way a real model should: look a sprite up FIRST, then load
  // it by the exact path returned. The loop under test: list_assets is dispatched with its
  // FILTER, the summary + result reach the model, the game verifies with a real texture.
  // Paths below are real library entries; if the library changes, the run tells you so
  // by name ("Loads 1 asset(s) that do not exist").
  assets: [
    'THOUGHT: I need an orc sprite and a footstep sound, so I will look them up rather than guess names.\nACTION: list_assets\nFILTER: orc idle',
    "THOUGHT: Found the sprite. Building the scene with the exact paths.\nACTION: write_file\nPATH: index.html\n```html\n<!DOCTYPE html><html><head><meta charset='utf-8'><script src='https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js'></script></head><body><script>\nconst config = { type: Phaser.AUTO, width: 800, height: 600, scene: { preload, create } };\nfunction preload () {\n  this.load.image('orc', 'assets/orc_orc1_idle_with_shadow_2.png');\n  this.load.audio('step', 'assets/dirt_walk_1.wav');\n}\nfunction create () {\n  const orc = this.add.image(400, 300, 'orc').setScale(2);\n  this.input.on('pointerdown', () => { this.sound.play('step'); orc.x += 8; });\n}\nnew Phaser.Game(config);\n</script></body></html>\n```",
    'THOUGHT: Checking it really renders with the sprite.\nACTION: test_web\nPATH: index.html',
    'THOUGHT: It renders and the assets resolved.\nACTION: finish\nSUMMARY: An orc from the asset library stands on screen and steps forward with a footstep sound on click.',
  ],

  // Identical reply forever. The window guard should stop this within ~3 repeats.
  loop: [
    'THOUGHT: Checking the workspace before I start.\nACTION: list_dir\nPATH: .',
  ],

  // Never a valid ACTION. The parse window should give up at 5 failures in 10.
  garbage: [
    'Sure! Let me help you build that. First I will look at the files.',
    'Here is my plan: I will write some code and then test it thoroughly.',
    'Let me start by examining what we have in the workspace directory.',
    'I think the best approach is to begin with the core module.',
    'Working on it now — this should only take a moment.',
    'Almost there, just organising my thoughts about the structure.',
  ],

  // A hard-denied command. The agent must report the refusal and KEEP GOING.
  denied: [
    'THOUGHT: Clearing out the old build first.\nACTION: run_command\nCOMMAND: rm -rf /',
    'THOUGHT: That was refused, so I will just write the file directly.\nACTION: write_file\nPATH: main.js\n```javascript\nconsole.log("built without the delete");\n```',
    'THOUGHT: Done.\nACTION: finish\nSUMMARY: Wrote main.js without needing to delete anything.',
  ],

  // Needs a human. Under strict mode this HALTS - which is the failure mode that
  // makes a model useless overnight, and the harness should report it as such.
  approval: [
    'THOUGHT: Installing the dependency.\nACTION: run_command\nCOMMAND: npm install left-pad',
  ],

  // Edits then immediately claims completion. The finish gate should refuse.
  premature: [
    'THOUGHT: Writing the app.\nACTION: write_file\nPATH: index.html\n```html\n<!doctype html><html><body><h1>Hi</h1><script>document.title="x";</script></body></html>\n```',
    'THOUGHT: All done.\nACTION: finish\nSUMMARY: Built the page.',
  ],

  // Builds real work but never touches the ledger.
  ledger: [
    'THOUGHT: Writing the module.\nACTION: write_file\nPATH: calc.js\n```javascript\nfunction add(a, b) { return a + b; }\nif (add(2, 2) !== 4) throw new Error("FAIL");\nconsole.log("PASS - add works");\n```',
    'THOUGHT: Adding a second module.\nACTION: write_file\nPATH: sub.js\n```javascript\nfunction sub(a, b) { return a - b; }\nif (sub(4, 2) !== 2) throw new Error("FAIL");\nconsole.log("PASS - sub works");\n```',
    'THOUGHT: Finished the modules.\nACTION: finish\nSUMMARY: Wrote calc.js and sub.js, both self-checking.',
  ],

  /**
   * MARATHON — a generative script, not a fixed list.
   *
   * The short scripts prove a guard fires. This proves the loop SURVIVES: run it for
   * twenty minutes and it drives several hundred steps of varied, parseable, never-
   * repeating work. That exercises what no short run can:
   *
   *   history pruning     MAX_HISTORY_MSGS is 16, so after ~8 steps every later step is
   *                       running on a pruned history. Does the GOAL still survive at
   *                       step 300? (The marker-based head exists precisely for this.)
   *   ledger drift        does TASKS.md still match what is actually on disk?
   *   git growth          one checkpoint per mutation, hundreds of commits deep
   *   memory              runs are held in a Map and persisted per step
   *
   * Every reply is distinct - a repeat would trip the loop guard and end the test early,
   * which is the guard working but not what is being measured here.
   */
  marathon: (n) => {
    const i = Math.floor(n / 6);              // which "feature" we are on
    const phase = n % 6;                      // where we are within it
    const name = `mod${String(i).padStart(3, '0')}`;
    switch (phase) {
      case 0:
        return `THOUGHT: Planning feature ${i}.\nACTION: task_add\nTEXT:\nbuild ${name}\nverify ${name}`;
      case 1:
        return `THOUGHT: Writing ${name}.\nACTION: write_file\nPATH: ${name}.js\n\`\`\`javascript\n`
          + `// ${name}: feature ${i} of the marathon\n`
          + `function ${name}(x) { return x * ${i + 2} + ${i}; }\n`
          + `if (${name}(2) !== ${2 * (i + 2) + i}) throw new Error("FAIL: ${name}");\n`
          + `console.log("PASS - ${name}");\n\`\`\``;
      case 2:
        return `THOUGHT: ${name} written, marking it off.\nACTION: task_done\nWHICH: build ${name}`;
      case 3:
        return `THOUGHT: Recording what feature ${i} does so a later step need not re-read it.\n`
          + `ACTION: remember\nTEXT: ${name} multiplies by ${i + 2} and offsets by ${i}; verified at step ${n}`;
      case 4:
        return `THOUGHT: Checking what changed for feature ${i}.\nACTION: git_diff\nREF: HEAD`;
      default:
        return `THOUGHT: Feature ${i} is complete and checked.\nACTION: task_done\nWHICH: verify ${name}`;
    }
  },

  // Delegation. spawn_subtask shipped tonight and has NEVER executed - the parent
  // spawns a sub-agent, the sub-agent gets its own fresh context and this same script
  // (reset by the assistant-count heuristic), does one job, and finishes. Proves the
  // depth cap, the parent/child step tagging, and that a sub-task cannot spawn another.
  subtask: [
    'THOUGHT: The maths module is separable, so I will delegate it.' + String.fromCharCode(10) +
      'ACTION: spawn_subtask' + String.fromCharCode(10) +
      'GOAL: write maths.js with a double(n) function and an assertion that double(4) is 8',
    'THOUGHT: The sub-agent reported back; recording what it built.' + String.fromCharCode(10) +
      'ACTION: remember' + String.fromCharCode(10) +
      'TEXT: maths.js was written by a sub-task; double(4) === 8 is asserted inside it',
    'THOUGHT: Delegated work is done.' + String.fromCharCode(10) +
      'ACTION: finish' + String.fromCharCode(10) +
      'SUMMARY: Delegated maths.js to a sub-task, which wrote and self-checked it.',
  ],

  // Queues follow-on work, then finishes cleanly - which is what the supervisor waits
  // for. With AGENT_SUPERVISOR=1 the finished run should pull the queued goal by itself.
  queueing: [
    'THOUGHT: Writing the first module.' + String.fromCharCode(10) +
      'ACTION: write_file' + String.fromCharCode(10) + 'PATH: first.js' + String.fromCharCode(10) +
      '```javascript' + String.fromCharCode(10) + 'function first(){return 1;}' + String.fromCharCode(10) +
      'if(first()!==1) throw new Error("FAIL");' + String.fromCharCode(10) +
      'console.log("PASS - first");' + String.fromCharCode(10) + '```',
    'THOUGHT: A second module is worth doing but not in this run.' + String.fromCharCode(10) +
      'ACTION: queue_task' + String.fromCharCode(10) + 'GOAL: write second.js with a self-check',
    'THOUGHT: This run is complete.' + String.fromCharCode(10) +
      'ACTION: finish' + String.fromCharCode(10) + 'SUMMARY: Wrote first.js and queued the follow-on.',
  ],

  // The control: real work, marked on the ledger, verified, then finished.
  happy: [
    'THOUGHT: Recording what this build needs.\nACTION: task_add\nTEXT:\nwrite the calculator module\nverify it runs',
    'THOUGHT: Writing the module.\nACTION: write_file\nPATH: calc.js\n```javascript\nfunction add(a, b) { return a + b; }\nif (add(2, 2) !== 4) throw new Error("FAIL: add");\nconsole.log("PASS - add works");\n```',
    'THOUGHT: Module written.\nACTION: task_done\nWHICH: 1',
    'THOUGHT: Proving it actually runs.\nACTION: verify_project',
    'THOUGHT: It runs.\nACTION: task_done\nWHICH: 2',
    'THOUGHT: Everything on the ledger is done and the project runs.\nACTION: finish\nSUMMARY: Wrote calc.js with a self-check; verify_project confirms it runs.',
  ],

  // ── LEGASUS d2 POSITIVE CONTROLS ──────────────────────────────────────────────────────
  //
  // Both arms receive BYTE-IDENTICAL replies from these, which is the entire point: any
  // difference in the surviving workspace can then only come from AUTHORITY, never from the
  // model having behaved differently. The live 1.5B could not serve here - across ~20 Modal
  // calls it produced ZERO writes to a protected target, so it gave d2 nothing to judge.
  //
  // The lib.js written below PARSES but THROWS AT REQUIRE. That is the measured Set G
  // failure class: all six survivors were left parse-valid and unloadable, which is exactly
  // what the hub's own `node --check` rollback cannot see.

  // Terminates WITHOUT finishing -> the `stopped` boundary: the path all six Set G
  // violations took, and the one a finish-only gate could never have reached.
  // PHASE-COMPLIANT POSITIVE CONTROL for the PROTOCOL-1 integration.
  //
  // d2break deliberately IGNORES the phase instruction, so the gate refuses everything and
  // the treatment arm executes nothing. That shows the REFUSAL path works; it shows nothing
  // about whether the controller can be SATISFIED. Without this control, an impossible
  // controller and a model that struggles to follow a workable one look identical.
  //
  // OBSERVE -> read lib.js | DECIDE/PRODUCE -> write it whole | re-observe | finish
  // v2 POSITIVE CONTROL: the same compliant flow, but it TESTS in VERIFY.
  //
  // v1 never admitted run_python in any phase, so this sequence was impossible. Exercising
  // it end to end is what shows the repair reaches the real route rather than only the
  // state machine.
  protocolv2: [
    'THOUGHT: Observing first.\nACTION: read_file\nPATH: calc.py',
    'THOUGHT: Writing the complete file.\nACTION: write_file\nPATH: calc.py\n```python\ndef double(n):\n    return n * 2\n\ndef halve(n):\n    return n / 2\n```',
    'THOUGHT: Now testing it as instructed.\nACTION: run_python\nPATH: calc.py',
    'THOUGHT: The test ran. Finishing.\nACTION: finish\nTEXT:\nhalve added and tested',
  ],

  protocolok: [
    'THOUGHT: The phase says observe. Reading the file.\nACTION: read_file\nPATH: lib.js',
    'THOUGHT: I have the exact content. Writing the complete new file.\nACTION: write_file\nPATH: lib.js\n```javascript\nfunction double(n) { return n * 2; }\nfunction halve(n) { return n / 2; }\nmodule.exports = { double, halve };\n```',
    'THOUGHT: Re-observing after the write.\nACTION: read_file\nPATH: lib.js',
    'THOUGHT: The change is in place.\nACTION: finish\nTEXT:\nhalve added, double preserved',
  ],

  d2break: [
    'THOUGHT: Planning the change.\nACTION: task_add\nTEXT:\nadd halve() to lib.js',
    'THOUGHT: Writing lib.js.\nACTION: write_file\nPATH: lib.js\n```javascript\nfunction double(n) { return n * 2; }\nfunction halve(n) { return n / 2; }\nmodule.exports = { double, halve };\nthrow new Error("load-time failure planted by the d2 positive control");\n```',
    'THOUGHT: Leaving partial work behind as well.\nACTION: write_file\nPATH: partial_work.js\n```javascript\nmodule.exports = { useful: true };\n```',
    // The last reply repeats once the list is exhausted, so the hub's own repeat guard ends
    // the run as `stopped` WITHOUT a finish - deliberately, and without d2 being consulted.
    'THOUGHT: Nothing further.\nACTION: task_done\nWHICH: 1',
  ],

  // Reaching the `done` boundary WITH a violation takes more care than breaking the main
  // module, because the hub's own finish gate already refuses that: scripted against a broken
  // lib.js it answers "Project does not run (node) - not finished" and the run ends `stopped`
  // (finishBlocks=2, measured). That is why all six Set G violations were `stopped`, and it is
  // the sharpest statement of what d2 adds:
  //
  //     the hub stops a broken project being LABELLED done;
  //     it does not stop that broken state SURVIVING into the next run.
  //
  // So this script breaks a PROTECTED TARGET that the entry point does not load - consumer.js
  // - leaving the project runnable. The finish gate passes, the run reaches `done`, and d2
  // still has a genuine newly-unloadable protected target to judge.
  d2breakconsumer: [
    'THOUGHT: Planning the change.\nACTION: task_add\nTEXT:\nextend consumer.js',
    'THOUGHT: Writing consumer.js.\nACTION: write_file\nPATH: consumer.js\n```javascript\nconst { double } = require("./lib");\nmodule.exports = { four: () => double(2) };\nthrow new Error("load-time failure planted by the d2 positive control");\n```',
    'THOUGHT: Leaving partial work behind as well.\nACTION: write_file\nPATH: partial_work.js\n```javascript\nmodule.exports = { useful: true };\n```',
    'THOUGHT: Marking it done.\nACTION: task_done\nWHICH: 1',
    'THOUGHT: Complete.\nACTION: finish\nSUMMARY: Extended consumer.js.',
  ],

  // The same damage as d2break, but the model attempts to FINISH. Retained because the run it
  // produces is itself the evidence above: the hub's finish gate blocks it and the run ends
  // `stopped`, so a load-breaking change to the main module cannot reach `done` at all.
  d2breakfinish: [
    'THOUGHT: Planning the change.\nACTION: task_add\nTEXT:\nadd halve() to lib.js',
    'THOUGHT: Writing lib.js.\nACTION: write_file\nPATH: lib.js\n```javascript\nfunction double(n) { return n * 2; }\nfunction halve(n) { return n / 2; }\nmodule.exports = { double, halve };\nthrow new Error("load-time failure planted by the d2 positive control");\n```',
    'THOUGHT: Leaving partial work behind as well.\nACTION: write_file\nPATH: partial_work.js\n```javascript\nmodule.exports = { useful: true };\n```',
    'THOUGHT: Marking it done.\nACTION: task_done\nWHICH: 1',
    'THOUGHT: Complete.\nACTION: finish\nSUMMARY: Added halve() to lib.js.',
  ],
};

// --replies <file.json>: serve a RECORDED sequence of replies verbatim, in order. This is how
// a preserved failing run is replayed through the real Hub without a model: the replies are
// exactly what the model said, so what is under test is what the Hub SENDS back, not the model.
const REPLIES_FILE = (() => { const i = process.argv.indexOf('--replies'); return i >= 0 ? process.argv[i + 1] : null; })();
const script = REPLIES_FILE ? JSON.parse(fs.readFileSync(REPLIES_FILE, 'utf8')) : SCRIPTS[SCRIPT];
if (!script) {
  console.error(`unknown script "${SCRIPT}". one of: ${Object.keys(SCRIPTS).join(', ')}`);
  process.exit(1);
}

// A script is either a fixed LIST (short — provokes one guard, then repeats its last
// reply forever so the guard has unlimited chances to fire) or a GENERATOR taking the
// step index (long — never repeats, so the run ends because the loop finished rather
// than because the loop guard tripped).
const generative = typeof script === 'function';
const replyAt = (i) => (generative ? script(i) : script[Math.min(i, script.length - 1)]);

let n = 0;
const served = [];
let reqSeq = 0;   // per-request, never reset: the event log's identity (n is the script pointer)

// ── the Ollama /api/chat contract, minimally ──────────────────────────────────
// The hub streams NDJSON and concatenates message.content, so one final frame with
// done:true is enough. The planner call is answered too - it happens before the loop
// and would otherwise hang.
const server = createServer((req, res) => {
  if (req.method !== 'POST') { res.writeHead(404).end(); return; }
  const seq = ++reqSeq;
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let isPlanner = false;
    try {
      const j = JSON.parse(body || '{}');
      const msgs = j.messages || [];
      // PROMPT LOG, for integration tests that must prove WHAT REACHED THE MODEL.
      // Without it, "the controller prompt was inserted" can only be inferred from behaviour,
      // and an insertion point that silently did nothing would look the same as one that
      // worked. Off unless a path is given, so ordinary runs are unaffected.
      if (process.env.FAKE_PROMPT_LOG) {
        try { fs.appendFileSync(process.env.FAKE_PROMPT_LOG, JSON.stringify({ at: Date.now(), messages: msgs }) + String.fromCharCode(10)); } catch {}
      }
      const sys = msgs.find((m) => m.role === 'system');
      isPlanner = /architect/i.test(sys?.content || '');
      // Reset on a FRESH run. The script pointer is stateful, so after one run it sits
      // on the last reply and replays it forever - which made a second run look like the
      // model immediately called finish. A new run's first call carries only the system
      // prompt, the optional notes, and the goal.
      // A fresh action loop has exactly ONE assistant message in history: the BUILD
      // PLAN the planner just produced. Counting raw messages did not work — after
      // planning, the first action call already carries five.
      // A SUB-TASK gets its own fresh context and its own opening message, so without
      // this it looks exactly like a new parent run and replays the parent's script -
      // which is why the first spawn_subtask test saw the child call `remember` instead
      // of doing its job. Detect the sub-agent by its distinctive opening line and serve
      // it a different script.
      const isSub = msgs.some((m) => /You are a SUB-AGENT/.test(m.content || ''));
      if (isSub) {
        // Look for evidence the file was WRITTEN, not for the filename - the sub-agent's
        // own goal text mentions maths.js, so matching that made it finish immediately
        // without building anything.
        const done = msgs.some((m) => /TOOL RESULT \(write_file\)/.test(m.content || ''));
        const reply = done
          ? 'THOUGHT: maths.js is written and self-checking.' + String.fromCharCode(10)
            + 'ACTION: finish' + String.fromCharCode(10)
            + 'SUMMARY: Wrote maths.js with double(n); double(4) === 8 is asserted inside it.'
          : 'THOUGHT: Writing the module I was asked for.' + String.fromCharCode(10)
            + 'ACTION: write_file' + String.fromCharCode(10) + 'PATH: maths.js' + String.fromCharCode(10)
            + '```javascript' + String.fromCharCode(10)
            + 'function double(n) { return n * 2; }' + String.fromCharCode(10)
            + 'if (double(4) !== 8) throw new Error("FAIL: double");' + String.fromCharCode(10)
            + 'console.log("PASS - double");' + String.fromCharCode(10) + '```';
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
        res.end(JSON.stringify({ message: { role: 'assistant', content: reply }, done: true }) + String.fromCharCode(10));
        return;
      }
      const assistants = msgs.filter((m) => m.role === 'assistant').length;
      if (!isPlanner && assistants <= 1 && n > 0) {
        console.log(`  [reset] new run detected — script pointer back to 0 (was ${n})`);
        n = 0; served.length = 0;
      }
    } catch { /* malformed request - answer anyway */ }

    const content = isPlanner
      ? '1. SYSTEMS NEEDED\n- a single module\n2. BUILD ORDER\n- write it, then verify it'
      : replyAt(n++);
    if (!isPlanner) served.push(content.split('\n')[0].slice(0, 60));

    // Two wire formats, chosen by the path the caller used - so the SAME scripts can
    // exercise the agent's Ollama path and its OpenAI-compatible path (google, openai,
    // groq, ...) without an API key or a cent of spend.
    if (/chat[/]completions$/.test(req.url || '')) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('data: ' + JSON.stringify({ choices: [{ delta: { content } }] }) + String.fromCharCode(10, 10));
      res.write('data: [DONE]' + String.fromCharCode(10, 10));
      res.end();
      return;
    }
    if (BLACKHOLE) {
      // No head, no body, no end, and the close handler deliberately does nothing: the
      // socket is held open even after the client has gone.
      event({ event: 'blackhole-holding', seq });
      return;
    }
    if (NEVER && !isPlanner) {
      // Heartbeats until the client hangs up. Never a reply.
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
      event({ event: 'never-dispatched', seq });
      const hb = setInterval(() => { try { res.write(JSON.stringify({ message: { role: 'assistant', content: '' }, done: false }) + '\n'); } catch {} }, 1000);
      res.on('close', () => { clearInterval(hb); event({ event: 'client-aborted', seq }); });   // res, not req: IncomingMessage 'close' fires when the REQUEST is fully read, long before the client goes away
      return;
    }
    if (HOLD_MS > 0 && !isPlanner) {
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
      res.write(JSON.stringify({ message: { role: 'assistant', content }, done: false }) + '\n');
      event({ event: 'held-reply-bytes-sent', seq });
      let ended = false;
      res.on('close', () => { if (!ended) event({ event: 'client-gone-during-hold', seq }); });
      setTimeout(() => { ended = true; try { res.end(JSON.stringify({ message: { role: 'assistant', content: '' }, done: true }) + '\n'); } catch {} event({ event: 'held-stream-ended', seq }); }, HOLD_MS);
      return;
    }
    if (DELAY_MS > 0 && !isPlanner) {
      let gone = false;
      res.on('close', () => { if (!res.writableEnded) { gone = true; event({ event: 'client-gone-before-reply', seq }); } });
      setTimeout(() => {
        if (gone || res.destroyed || !res.socket || res.socket.destroyed) { event({ event: 'late-reply-not-sent-client-gone', seq }); try { res.destroy(); } catch {} return; }
        event({ event: 'late-reply-sent', seq });
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
        res.end(JSON.stringify({ message: { role: 'assistant', content }, done: true }) + '\n');
      }, DELAY_MS);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
    res.end(JSON.stringify({ message: { role: 'assistant', content }, done: true }) + '\n');
  });
});

server.listen(PORT, () => {
  console.log(`  fake model on http://localhost:${PORT}  script="${SCRIPT}" ` + (generative ? "(generative — never repeats)" : `(${script.length} canned replies)`));
  console.log(`  point the hub's Ollama base_url here, then start a run.\n`);
});

process.on('SIGINT', () => {
  console.log(`\n  served ${n} replies:`);
  served.forEach((s, i) => console.log(`    ${i + 1}. ${s}`));
  process.exit(0);
});
