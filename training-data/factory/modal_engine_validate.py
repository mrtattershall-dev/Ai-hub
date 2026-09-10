"""
modal_engine_validate.py — STAGE: engine-aware validation (headless Chromium).

   python -m modal run factory/modal_engine_validate.py        # runs the built-in self-test

The gate/node-exec stages can't run engine code (needs WebGL/canvas/DOM). This loads the
engine (Phaser/Pixi/Three) + the candidate program in real headless Chromium, runs a few
animation frames, and captures uncaught exceptions + console errors — which is exactly where
HALLUCINATED ENGINE APIS blow up (`this.add.megaSprite is not a function`). This is the only
stage that can tell a real Phaser program from plausible-looking Phaser fiction.

validate_batch(items) -> per-item {id, ok, errors}. items = [{id, code, engine}].
"""
import modal

ENGINES = {
    "phaser": "https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js",
    "pixi": "https://cdn.jsdelivr.net/npm/pixi.js@8.6.6/dist/pixi.min.js",
    "three": "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.min.js",
}

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("playwright==1.49.0")
    .run_commands("playwright install-deps chromium", "playwright install chromium")
)
app = modal.App("qwen-engine-validate")


@app.function(image=image, timeout=60 * 20)
def validate_batch(items, frames_ms: int = 1500):
    from playwright.sync_api import sync_playwright
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=[
            "--use-gl=swiftshader", "--enable-unsafe-swiftshader",   # software WebGL for headless
            "--no-sandbox", "--disable-dev-shm-usage",
        ])
        for it in items:
            lib = ENGINES.get(it.get("engine", "phaser"))
            page = browser.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e).split("\n")[0]))
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            html = (
                "<!doctype html><html><body><div id=app></div>"
                f'<script src="{lib}"></script>'
                f'<script>try{{\n{it["code"]}\n}}catch(e){{console.error("THROW:"+e.message)}}</script>'
                "</body></html>"
            )
            try:
                page.set_content(html, wait_until="load", timeout=15000)
                page.wait_for_timeout(frames_ms)        # let the engine run a few frames
                # did anything actually render onto a canvas?
                drew = page.evaluate("""() => {
                    const c = document.querySelector('canvas');
                    if (!c) return false;
                    return c.width > 0 && c.height > 0;
                }""")
            except Exception as e:
                errors.append("page:" + str(e).split("\n")[0])
                drew = False
            page.close()
            ok = len(errors) == 0 and drew
            results.append({"id": it["id"], "ok": ok, "rendered": drew, "errors": errors[:4]})
        browser.close()
    return results


@app.local_entrypoint()
def main(code_file: str = "", engine: str = "phaser"):
    import re
    if code_file:
        raw = open(code_file, encoding="utf-8").read()
        m = re.search(r"```\w*\n([\s\S]*?)```", raw)
        code = m.group(1) if m else raw
        for r in validate_batch.remote([{"id": code_file, "code": code, "engine": engine}]):
            print(f"  {'PASS' if r['ok'] else 'FAIL'}  rendered={r['rendered']}  errors={r['errors']}")
        return
    # self-test: a valid Phaser program vs one calling a hallucinated API
    good = """
const config = { type: Phaser.CANVAS, width: 320, height: 240, parent: 'app',
  scene: { create: function () { this.add.rectangle(160, 120, 60, 60, 0xff0000); } } };
new Phaser.Game(config);
"""
    bad = """
const config = { type: Phaser.CANVAS, width: 320, height: 240, parent: 'app',
  scene: { create: function () { this.add.megaSprite(160, 120, 'hero'); } } };
new Phaser.Game(config);
"""
    items = [{"id": "good_phaser", "code": good, "engine": "phaser"},
             {"id": "bad_phaser_hallucinated_api", "code": bad, "engine": "phaser"}]
    for r in validate_batch.remote(items):
        verdict = "PASS" if r["ok"] else "FAIL"
        print(f"  {verdict:4} {r['id']:32} rendered={r['rendered']} errors={r['errors']}")
