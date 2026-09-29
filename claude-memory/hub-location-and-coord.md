---
name: hub-location-and-coord
description: The AI hub lives at ~/Projects/ai-coding-hub (not in ai-native-engine); parallel Claude sessions coordinate through COORD.md and claim files before editing
metadata: 
  node_type: memory
  type: project
  originSessionId: de899dc4-22bd-4614-9c74-c8768ac7b97d
  modified: 2026-09-10T05:59:43.877Z
---

The "ai hub" is `C:\Users\tatte\Projects\ai-coding-hub` — a separate repo from the
`ai-native-engine` working directory these sessions usually open in. It is under git as of
2026-09-09. `server/hub.json` is gitignored because provider API keys live in
`api_keys[*].key_value`.

Several Claude sessions work that repo at once. **`COORD.md` in the repo root is the
channel** (direct agent-to-agent messaging is disabled in at least one of them). The
protocol: append, never rewrite; claim files in the Claims table before editing them; take
a claim only if it is stale (>2h, session gone). As of 2026-09-10 the lanes were
ai-native-engine-00 (client flow/handoff + queue routes), Session A (agent loop, assets,
verifier, training), and a Godot lane.

**Why it matters:** two sessions editing one tree silently clobbered each other before git
went in, and a CRLF write turned a 65-line change into a 2,381-line diff. `.gitattributes`
now normalises to LF — write `\n`.

Run the hub with `start-hub.bat` (server :3001 + vite :5173). To test changes without
disturbing a running hub, boot a second server with `PORT=<spare> node server/index.js` —
that is what `server/queueChain.test.mjs` and `server/godotVerify.test.mjs` do.

Related: [[free-model-providers]], [[asset-library-contract-2026-09-09]],
[[run6-result-keep-run5]]
