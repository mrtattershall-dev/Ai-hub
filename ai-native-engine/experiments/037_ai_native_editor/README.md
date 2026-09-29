# 037 — The AI-Native Editor (visual, speaks human)

Born 2026-07-16 from the first live human session's verdict: the engine spoke
only code language. This experiment adds the language layer, both directions,
with the gate unchanged in the middle.

## Run it

Double-click **`START_EDITOR.cmd`** at the project root, or:

```
node experiments\036_multiplayer\m1_server.js
```

then open **http://127.0.0.1:4243/** (use that exact address; `localhost` can
resolve to IPv6 on Windows and miss the server). Terminal clients
(`m1_client.js`) share the same world.

## Enable the AI rule-writing pane (remote model — NEVER local)

```
set MODEL_ENDPOINT=https://mr-tattershall--editor-llm.modal.run
set MODEL_NAME=Qwen/Qwen2.5-Coder-32B-Instruct
set MODEL_KEY=engine-editor-2026
node experiments\036_multiplayer\m1_server.js
```

The endpoint scales to zero ($0 idle); a cold propose pays ~1-2 min of model
load, warm ones take seconds. Deploy/update it with:
`python -m modal deploy experiments/037_ai_native_editor/modal_endpoint.py`

## What's in here

| file | what | proof |
|---|---|---|
| `intent.js` | plain English → engine ops, pure function ("water the driest crop", "plant 3 corn", "who claimed what?") | `node intent_test.js` — 77/77 |
| `explain.js` | rule JSON → English sentence; gate errors & pipeline rejections humanized | `node explain_test.js` — 85/85 (pinned to the REAL gate) |
| `editor.html` | the visual editor v2 — command bar, explain-before-install, sentence feed, petnames | served at `/` by m1_server |
| `modal_endpoint.py` | Qwen2.5-Coder-32B on A100-80GB, OpenAI-compatible, scale-to-zero | live e2e: authored 'wilt' in 1 attempt |

## The invariant, restated for this layer

The AI drafts against a **sandbox clone** (`P.load(P.save(engine))`). The live
world cannot change until a human reads the English explanation and clicks
install — and the RD-B6 gate re-validates the rule on the live world even then.
A rejected or discarded proposal changes NOTHING; that's the same thesis the
whole project runs on, now with a human-readable face.

## Known gaps (honest)

- Rule-spawned crops are all literally named `seed` — the rule grammar has no
  dynamic spawn-props. The editor shows stable petnames (display-layer only);
  the grammar gap is an open card.
- One sentence = one intent; no chained commands ("water A then claim B").
- NL rule GOALS go to the remote model; NL world COMMANDS are deterministic
  (`intent.js`) and free.
