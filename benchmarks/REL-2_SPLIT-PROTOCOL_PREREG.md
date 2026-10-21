# REL-2 — JSON for the action, plain text for the code: does a split protocol make a small model's turns parse?

Frozen before the treatment exists in code. Amendments are recorded forward in their own files.

## Why this question

The hub's protocol is plain text on purpose. agentParse.js:1-15: "deliberately plain text rather than JSON. File
content arrives in a raw fenced block ... JSON-string encoding is what broke smaller models." The measured failure
is FILE CONTENT inside JSON strings - every newline and quote in code escaped by a small model. It is not JSON as
such. The research report "Atlas coding agents for Legasus" (2026-10-21) found inferstep/ATLAS enforcing a JSON
action envelope with a decode-time grammar, and recommended against JSON tool calls that carry file content.

The split protocol takes the grammar where it is safe and refuses it where it is not:

    call 1  Ollama `format` = a JSON schema: thought, action (an ENUM of the hub's real tools), and the short
            header fields (path, lines, command, query, url, summary, occurrence, ...). NO content field exists in
            the schema, so content cannot be JSON-escaped: the grammar has nowhere to put it.
    call 2  only when the action carries a body (write_file, append_file, edit_file, run_python without PATH):
            an ordinary call asking for that body alone, in a normal fenced block.
    then    the hub assembles call 1's fields and call 2's body into the existing THOUGHT/ACTION/PATH + fence
            reply and hands it to the UNCHANGED parseAction - every guard applies exactly as in CONTROL.

Feasibility, measured 2026-10-21 on qwen3.5:4b (Ollama 0.40.7): with that schema the reply was valid JSON, the
action came from the enum, the path was set, no content was emitted, and the model's reasoning arrived in the
separate `thinking` field.

## Arms

    CONTROL     the plain-text protocol as at the freeze commit (AGENT_JSON_ACTIONS unset).
    TREATMENT   AGENT_JSON_ACTIONS=1: the split protocol above. Ollama provider only. Same prompt, model, goals,
                budgets, gates and flags otherwise; the treatment appends one system line asking for the JSON shape.

## Design

- Model qwen3.5:4b via Ollama, this laptop, CPU. Goals: gather.mjs's pool and `withPrerequisites`.
- Paired sessions as in REL-1: seeds 201-210, both arms per seed on fresh hubs, arm order by seed parity (odd:
  CONTROL first). 50 goals per arm. Fixed plan; no early stop, no extension. A hub that fails to start is re-run.
- Runs AFTER REL-1 completes, so the two experiments never share the CPU and REL-1's frozen code is untouched.
- Environment for both arms: gather.mjs's experiment environment at the freeze commit of the implementation
  (AGENT_FINISH_EVIDENCE=1, AGENT_WEB_QUARANTINE=1, worker ceiling 1g/2, MODEL_FIRST_BYTE_S=1200, 240 min/goal),
  with AGENT_REPEAT_WARN unset in both arms.

## Endpoints, from typed records only (each run's JSON, data/gather/sessions.jsonl, server/enoch/enoch.jsonl)

    J1  PRIMARY. Share of model turns whose reply yielded NO action (run.parseLog false entries over all entries).
        Prediction: TREATMENT < CONTROL.
    J2  Share of goals finishing VERIFIED (finishKind verified or screen_checked). Prediction: TREATMENT >= CONTROL.
    J3  Share of goals the postmortem Watcher judges goal_met = 'yes'. Reported; never used alone.
    J4  CONTENT HARM. Share of landed writes followed by a SYNTAX CHECK FAILED note. Prediction: TREATMENT not
        higher - the split exists so code is never JSON-escaped; if this rises, the split failed at its purpose.
    J5  COST. Model calls per goal including body calls. Prediction: TREATMENT higher (one extra call per body
        action), reported with wall minutes per goal. A J1 gain bought with a J2 loss is not a win.
    J6  SENSITIVITY CONTROL. TREATMENT turns that actually used the schema. If 0, every comparison is UNINFORMATIVE.

Analysis: counts per arm; paired by seed and goal position; exact two-sided tests on J2 (Fisher) and J1 (turns,
reported with the per-goal spread, since turns within a goal are not independent). Every goal is reported.

## What would falsify the idea

J1 not lower with J6 > 0; J2 lower; or J4 higher. Each is a result and is written up as one.
