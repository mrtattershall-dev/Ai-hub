"""
modal_judge.py — STAGE-3b: the LLM-judge half of the audit (semantic / requirement fidelity).

   python -m modal run --detach factory/modal_judge.py --in-name dataset_vb.execpass.jsonl

The static audit (audit.mjs) catches structural failures (god objects, dead fields, orphan
systems). It CANNOT catch the failure you flagged: a class named `Personality` that's really
a combat archetype — code that passes gate + exec + static-audit but builds the WRONG thing.
That needs semantic judgment, so we use the 14B as a HOSTILE reviewer over (request, code).

Design notes / caveats:
- The 14B judging its own output is weak, so the prompt is adversarial ("find every way it
  fails") + structured JSON, and the judge is used as a FILTER/score, not an oracle.
- Calibrate before trusting: run it on a few known-bad cases (the Personality monolith) and a
  few known-good (the hand seeds) and check it flags the bad and passes the good.
- It checks three things: DOMAIN MATCH (did it build what was asked, not mislabel something
  else), REQUIREMENT COVERAGE (all requested features present + wired, not stubbed), and
  DEAD/DISCONNECTED (systems/fields that exist but are never reached).
- Output: a verdict per row -> gen-output volume; keep verdict=="pass" locally to filter.

Reuses the vLLM image (flashinfer sampler disabled — same nvcc fix as modal_generate.py).
"""
import json
import modal

MODEL = "Qwen/Qwen2.5-Coder-14B-Instruct"

hf_cache = modal.Volume.from_name("hf-cache", create_if_missing=True)
gen_output = modal.Volume.from_name("gen-output", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("vllm", "huggingface_hub", "hf_transfer")
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1", "VLLM_USE_FLASHINFER_SAMPLER": "0"})
)

app = modal.App("qwen-judge")

JUDGE_SYSTEM = (
    "You are a ruthless senior code reviewer. You are given the REQUEST a developer was asked "
    "to fulfil and the CODE they wrote. Your job is to find every way the code fails to deliver "
    "what was requested — be adversarial, assume it is wrong until proven right. Check exactly "
    "three things:\n"
    "1. DOMAIN MATCH — does the code implement the requested concept, or did it build something "
    "else and mislabel it (e.g. a class named Personality that is really combat stats)?\n"
    "2. REQUIREMENT COVERAGE — is every requested feature actually present AND wired in (not "
    "stubbed, not commented, not a no-op)?\n"
    "3. DEAD / DISCONNECTED — are there systems, fields, methods, or branches that exist but are "
    "never used or reached?\n"
    "Respond with ONLY a JSON object: "
    '{"domain_match": true|false, "missing_requirements": [..], "dead_or_disconnected": [..], '
    '"verdict": "pass"|"fail", "reason": "<one sentence>"}'
)


@app.function(image=image, gpu="A100", timeout=60 * 60,
              volumes={"/root/.cache/huggingface": hf_cache, "/output": gen_output})
def judge(items, out_name):
    from vllm import LLM, SamplingParams
    llm = LLM(model=MODEL, dtype="bfloat16", gpu_memory_utilization=0.92,
              max_model_len=8192, enforce_eager=True)
    sp = SamplingParams(temperature=0.0, max_tokens=512)   # deterministic verdicts
    convos = [[
        {"role": "system", "content": JUDGE_SYSTEM},
        {"role": "user", "content": f"REQUEST:\n{it['request']}\n\nCODE:\n```javascript\n{it['code']}\n```"},
    ] for it in items]
    outs = llm.chat(convos, sp)
    with open(f"/output/{out_name}", "w", encoding="utf-8") as f:
        for it, o in zip(items, outs):
            f.write(json.dumps({"id": it["id"], "raw": o.outputs[0].text}) + "\n")
    gen_output.commit()
    print(f"judged {len(items)} -> gen-output / {out_name}")
    return len(items)


@app.local_entrypoint()
def main(in_name: str = "dataset_vb.execpass.jsonl", out: str = "verdicts.jsonl"):
    import re
    items = []
    with open(f"factory/{in_name}", encoding="utf-8") as f:
        for i, line in enumerate(f):
            r = json.loads(line)
            code = (re.search(r"```\w*\n([\s\S]*?)```", r["messages"][2]["content"]) or [None, ""])[1]
            items.append({"id": i, "request": r["messages"][1]["content"], "code": code})
    print(f"judging {len(items)} modules ...")
    judge.remote(items, out)
    print(f"done -> gen-output / {out}.  download + keep verdict=='pass' to filter.")
