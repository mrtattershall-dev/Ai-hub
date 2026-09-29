---
name: free-model-providers
description: "Hub gained google/openrouter/huggingface providers 2026-09-09; free tiers measured — reliability, not speed, is what an agent loop needs"
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-09T15:55:07.431Z
---

The hub's agent was hardwired to `api_keys.ollama` while Chat/Code could already reach
eight providers. Fixed 2026-09-09: `AGENT_PROVIDER=<name>` selects, `ollama` stays default.
Added `google`, `openrouter`, `huggingface` — all OpenAI-compatible, so no new response
parsing, only URL + auth.

**The measurement that mattered — sustained success, not one-shot latency:**

```
                                  one-shot     6 back-to-back
google/gemma-4-26b-a4b-it:free      2,277ms    0/6   <- fastest once, then gone
nvidia/nemotron-3-super-120b:free   4,256ms    4/6
nex-agi/nex-n2.5-pro:free           9,359ms    6/6   <- the default
gemini-3.6-flash (direct)          66,381ms    -     unusable in a loop
```

Gemma's 429 says `limit_source: upstream_provider_shared_pool, provider: Google AI Studio`
— **OpenRouter and Gemini direct are the same pool through different doors.** A model that
is fast once and absent afterwards is worthless to an agent making sequential calls.

**Free-tier ceilings:** Hugging Face ~300 req/hour (the binding constraint for a text
agent; the ~$0.10/month credit pool is for HEAVY models, not a 7B chat model) and models
under ~10B only. OpenRouter free models share upstream provider pools.

**Why:** no free tier survives 24/7 operation — the scripted marathon made 4,149 calls in
25 minutes. But a normal build (20-100 steps) runs fine on free, and better than the
local 14B fine-tune, which scores 9/18.

**How to apply:** for a build, `AGENT_PROVIDER=openrouter`. For loop marathons use
`server/fakemodel.mjs`, not a real model. Free tiers 429 and drop streams constantly, so
the agent now retries transient 429/5xx with backoff and KEEPS partial content when a
stream dies mid-body rather than failing the run. See [[no-local-models-hard-rule]].
