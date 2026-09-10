"""
modal_chromium.py - the Chromium verifier, on Modal instead of your laptop.

    python -m modal deploy factory/modal_chromium.py
    HUB=https://<workspace>--chromium-verify-web.modal.run CONCURRENCY=32 \
        node factory/gen_phaser.mjs 2500 factory/dataset_phaser_gen.jsonl

WHY
---
Generating verified Phaser rows means launching a real browser per row (~5s). Doing
that locally pinned the laptop with 8 Chromium processes and still took ~25 min for
2,500 rows. This is CPU work, not GPU work, so a Modal CPU container is cheap - and
Modal can run many of them, so concurrency stops being bounded by one machine.

It serves the SAME path and contract as the hub's own verifier (/api/game/verify), so
gen_phaser.mjs needs no changes at all - only HUB pointed here.

Engine definitions are duplicated from shared/engines.js deliberately: this file has to
stand alone inside a container that has no access to the repo.
"""
import modal
import os
import json
import hashlib

app = modal.App("chromium-verify")

# The hub's asset library, pushed here by `python factory/sync_assets.py`. The verifier
# serves it to the page under test at the SAME path the hub does, so a game that loads
# `assets/orc_orc1_idle.png` behaves identically in the hub, locally and here. Without
# this, asset-loading code could not be verified at all - page.set_content() leaves the
# document at about:blank, where a relative path resolves to nothing - which is the
# constraint that forced the "no assets" training rule in the first place.
assets_vol = modal.Volume.from_name("hub-assets", create_if_missing=True)
ASSET_HOST = "http://hub-assets.invalid/"
# The volume is mounted at /vol; `modal volume put hub-assets <repo>/assets /` uploads the
# directory AS /assets on the volume, so the library lives at /vol/assets. The first sync
# mounted the volume at /assets and looked for /assets/manifest.json - one level too
# shallow - and the verifier reported an empty library while 13k files sat beside it.
VOL_MOUNT = "/vol"
ASSET_DIR = "/vol/assets"
MIME = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
    ".webp": "image/webp", ".bmp": "image/bmp",
    ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".m4a": "audio/mp4",
    ".aac": "audio/aac", ".flac": "audio/flac",
    ".json": "application/json", ".csv": "text/csv", ".txt": "text/plain",
    ".tmx": "application/xml", ".tsx": "application/xml", ".xml": "application/xml",
    ".atlas": "text/plain", ".fnt": "application/xml",
    ".ttf": "font/ttf", ".otf": "font/otf", ".woff": "font/woff", ".woff2": "font/woff2",
}

# playwright ships a pinned chromium and the system libs it needs, which is far less
# fragile inside a slim container than apt-installing chromium and hoping.
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("playwright==1.47.0", "fastapi[standard]")
    .run_commands("playwright install --with-deps chromium")
    # THE ENGINES SHIP WITH THE IMAGE.
    #
    # Every verification used to fetch Phaser/Pixi/Three from jsdelivr at run time, so a
    # CDN hiccup was scored as a defect in the generated code. Measured 2026-09-10 on a
    # correct Phaser page: jsdelivr answered with something HTML-ish and the verdict was
    # "Rendered, but 1 runtime error(s) fired" - the error being `Unexpected token '<'`.
    # That is a network blip recorded as "the model wrote broken code", in the numbers that
    # decide whether a fine-tune was worth it and whether a training row is kept.
    #
    # Baked at build time rather than cached at run time: a cache still misses once, and
    # the first miss is indistinguishable from the failure it is meant to prevent.
    .run_commands(
        "mkdir -p /engines",
        # python, not curl - debian_slim ships no curl, and the build failed loudly on
        # that rather than shipping an image with missing engines, which is the right way
        # round.
        "python -c \"import urllib.request as u; u.urlretrieve('https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js','/engines/phaser.min.js')\"",
        "python -c \"import urllib.request as u; u.urlretrieve('https://cdn.jsdelivr.net/npm/pixi.js@7.4.2/dist/pixi.min.js','/engines/pixi.min.js')\"",
        "python -c \"import urllib.request as u; u.urlretrieve('https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.min.js','/engines/three.min.js')\"",
        # Fail the BUILD if a download was silently an error page, rather than shipping one.
        "python -c \"import sys,glob; bad=[f for f in glob.glob('/engines/*.js') if open(f,'rb').read(200).lstrip()[:1] == b'<' or len(open(f,'rb').read()) < 10000]; print('engines:', {f: len(open(f,'rb').read()) for f in glob.glob('/engines/*.js')}); sys.exit(1) if bad else None\"",
    )
)

ENGINES = {
    "phaser": {"label": "Phaser", "cdn": "https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js", "global": "Phaser"},
    "pixi":   {"label": "PixiJS", "cdn": "https://cdn.jsdelivr.net/npm/pixi.js@7.4.2/dist/pixi.min.js",   "global": "PIXI"},
    "three":  {"label": "Three.js", "cdn": "https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.min.js", "global": "THREE"},
}

SETTLE_MS = 1200
MAX_CODE = 200_000


def build_doc(engine_id: str, code: str) -> str:
    e = ENGINES.get(engine_id, ENGINES["phaser"])
    return (
        "<!DOCTYPE html><html><head><meta charset='utf-8'>"
        f"<base href='{ASSET_HOST}'>"
        "<style>html,body{margin:0;height:100%;background:#0c0d11;overflow:hidden}"
        "canvas{display:block;margin:0 auto}</style>"
        f"<script src='{e['cdn']}'></script></head><body><script>\ntry {{\n{code}\n}} "
        "catch (err) { window.__gameError = String((err && err.message) || err); throw err; }\n"
        "</script></body></html>"
    )


@app.cls(image=image, cpu=2.0, memory=2048, min_containers=0, scaledown_window=120,
         volumes={VOL_MOUNT: assets_vol})
class Verifier:
    @modal.enter()
    async def start(self):
        from playwright.async_api import async_playwright
        # MUST be the async API: this class serves an ASGI app, so an asyncio loop is
        # already running and playwright's sync API refuses to start inside one
        # ("Cannot run the event loop while another loop is running").
        #
        # One browser per container, reused across requests - the launch is the expensive
        # part (~3s), so paying it once per container rather than once per row is most of
        # the speedup over doing this locally.
        self._pw = await async_playwright().start()
        self.browser = await self._pw.chromium.launch(args=["--no-sandbox", "--disable-setuid-sandbox"])
        print("[chromium-verify] browser ready", flush=True)

    @modal.exit()
    async def stop(self):
        try:
            await self.browser.close()
            await self._pw.stop()
        except Exception:
            pass

    def _manifest(self) -> dict:
        """The asset manifest, re-read only when the file changes.

        The version hash is computed exactly as server/assets.js does (sha256 over sorted
        "name:sha256" lines, first 16 hex chars) so the hub and this verifier report the
        SAME version for the same library - that is what lets an eval result be pinned to
        the assets it ran against.
        """
        path = os.path.join(ASSET_DIR, "manifest.json")
        try:
            assets_vol.reload()   # see the latest sync without a container restart
        except Exception:
            pass
        try:
            mtime = os.path.getmtime(path)
        except OSError:
            return {"byName": {}, "version": "empty", "count": 0}
        cached = getattr(self, "_manifest_cache", None)
        if cached and cached["mtime"] == mtime:
            return cached
        try:
            with open(path, "r", encoding="utf-8") as f:
                items = json.load(f).get("items", [])
        except Exception:
            items = []
        by_name = {it["name"]: it for it in items if "name" in it}
        h = hashlib.sha256()
        for it in sorted(items, key=lambda x: x.get("name", "")):
            h.update(f"{it.get('name')}:{it.get('sha256')}\n".encode())
        self._manifest_cache = {
            "mtime": mtime, "byName": by_name, "count": len(items),
            "version": h.hexdigest()[:16] if items else "empty",
        }
        return self._manifest_cache

    async def _verify(self, engine: str, code: str) -> dict:
        if engine not in ENGINES:
            return {"error": f'unknown engine "{engine}"'}
        if not code or not code.strip():
            return {"error": "no code supplied"}
        if len(code) > MAX_CODE:
            return {"error": f"code too large ({len(code)} > {MAX_CODE})"}

        eng = ENGINES[engine]
        errors: list[str] = []
        warnings: list[str] = []   # collected and reported, never fatal
        cdn_blocked: list[str] = []  # INFRASTRUCTURE, never the code's fault
        page = await self.browser.new_page(viewport={"width": 800, "height": 600})
        try:
            # A WARNING IS NOT AN ERROR.
            #
            # This counted console.warning as a runtime error, so a page that loaded, ran
            # and rendered perfectly was scored as FAILED because Chromium advised that a
            # <script src> from a CDN is parser-blocking. Measured 2026-09-10 on a correct
            # Phaser page: engineLoaded true, canvas 320x240, rendered true, and the verdict
            # was "Rendered, but 1 runtime error(s) fired" - the one error being that advice.
            #
            # Browsers warn about parser-blocking scripts, deprecations, autoplay policy,
            # passive listeners and a dozen other things that are style notes about the
            # platform, not defects in the code under test. This axis feeds eval scores and
            # the training gate, and Phaser is the ONE axis where the fine-tune looked
            # better than base (4/6 vs 2/6) - a systematic false failure there is not a
            # small measurement error, it is the measurement.
            #
            # Warnings are still COLLECTED, because "it works but warns" is worth seeing.
            # They just do not decide pass or fail.
            page.on("pageerror", lambda e: errors.append(f"[JS ERROR] {e}"))
            page.on("console", lambda m: errors.append(f"[console.error] {m.text}")
                    if m.type == "error" and "Failed to load resource" not in m.text else None)
            page.on("console", lambda m: warnings.append(f"[console.{m.type}] {m.text}")
                    if m.type == "warning" else None)
            page.on("requestfailed", lambda r: errors.append(f"[NETWORK] {r.failure} - {r.url}"))
            page.on("response", lambda r: errors.append(f"[HTTP {r.status}] {r.url}") if r.status >= 400 else None)

            # Serve the asset library to the page. Returns which assets were used and which
            # were asked for but do not exist - the second list is the useful one, because
            # "you loaded assets/hero.png and it does not exist" is a fixable error where a
            # blank canvas is a mystery.
            manifest = self._manifest()
            used: list[str] = []
            missing: list[str] = []

            async def serve_asset(route, request):
                want = request.url[len(ASSET_HOST):].split("?")[0].split("#")[0]
                name = want.rsplit("/", 1)[-1]
                item = manifest["byName"].get(name)
                fpath = os.path.join(ASSET_DIR, name) if item else None
                cors = {"Access-Control-Allow-Origin": "*"}
                if not item or not os.path.isfile(fpath):
                    if want not in missing:
                        missing.append(want)
                    errors.append(f"[ASSET 404] {want} - not in the asset library")
                    await route.fulfill(status=404, content_type="text/plain", headers=cors, body="not in the asset library")
                    return
                if item.get("path") not in used:
                    used.append(item.get("path"))
                ext = os.path.splitext(name)[1].lower()
                with open(fpath, "rb") as f:
                    body = f.read()
                await route.fulfill(status=200, content_type=MIME.get(ext, "application/octet-stream"), headers=cors, body=body)

            # Serve every known engine from disk. ANY other external script is aborted
            # and recorded apart from `errors`, so "a library would not download" can never
            # be mistaken for "this code throws".
            async def serve_engine(route, request):
                url = request.url
                local = None
                for key, meta in ENGINES.items():
                    stem = {"phaser": "phaser", "pixi": "pixi", "three": "three"}[key]
                    if stem in url.lower():
                        local = f"/engines/{stem}.min.js"
                        break
                if local and os.path.exists(local):
                    with open(local, "rb") as fh:
                        await route.fulfill(status=200, content_type="application/javascript", body=fh.read())
                    return
                cdn_blocked.append(url)
                await route.abort()

            await page.route("https://cdn.jsdelivr.net/**", serve_engine)
            await page.route(f"{ASSET_HOST}**", serve_asset)

            await page.set_content(build_doc(engine, code), wait_until="networkidle", timeout=20000)
            await page.wait_for_timeout(SETTLE_MS)

            checks = await page.evaluate(
                """(g) => {
                    const c = document.querySelector('canvas');
                    return {
                        engineLoaded: typeof window[g] !== 'undefined',
                        canvasFound: !!c,
                        canvasWidth: c ? c.width : 0,
                        canvasHeight: c ? c.height : 0,
                        thrownAtTopLevel: window.__gameError || null,
                    };
                }""",
                eng["global"],
            )
            checks["rendered"] = bool(checks["canvasFound"] and checks["canvasWidth"] > 0 and checks["canvasHeight"] > 0)
            hard = [e for e in errors if e.startswith("[JS ERROR]") or e.startswith("[NETWORK]")]
            # Phaser paints a placeholder for a texture that 404'd and carries on, so a game
            # whose sprite does not exist renders a canvas and passes every other check.
            # That must fail here, or the training gate (which rejects unknown asset paths)
            # and this verifier would disagree about the same code.
            ok = bool(checks["engineLoaded"] and checks["rendered"] and not hard
                      and not checks["thrownAtTopLevel"] and not missing)

            if not checks["engineLoaded"]:
                verdict = f"{eng['label']} never loaded - the CDN script failed or was blocked."
            elif checks["thrownAtTopLevel"]:
                verdict = f"Code threw before it finished: {checks['thrownAtTopLevel']}"
            elif missing:
                shown = ", ".join(missing[:3]) + (", ..." if len(missing) > 3 else "")
                verdict = f"Loads {len(missing)} asset(s) that do not exist: {shown}. Use list_assets for exact names."
            elif not checks["canvasFound"]:
                verdict = f"{eng['label']} loaded but no <canvas> was created - nothing rendered."
            elif not checks["rendered"]:
                verdict = f"A <canvas> exists but has zero size ({checks['canvasWidth']}x{checks['canvasHeight']})."
            elif hard:
                verdict = f"Rendered, but {len(hard)} runtime error(s) fired."
            elif errors:
                verdict = f"Runs clean. {len(errors)} warning(s) worth a look."
            else:
                verdict = f"Runs clean in Chromium - {eng['label']} loaded and rendered {checks['canvasWidth']}x{checks['canvasHeight']}."

            # warnings are reported so "it works but warns" is visible, and are absent
            # from `errors` so they cannot decide pass/fail.
            return {"ok": ok, "verdict": verdict, "engine": engine, "checks": checks, "errors": errors[:30],
                    "warnings": warnings[:15], "cdnBlocked": cdn_blocked[:8],
                    "assetsUsed": used, "assetsMissing": missing, "assetVersion": manifest["version"],
                    "assetCount": manifest["count"]}
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "verdict": f"Verification failed to run: {e}", "engine": engine,
                    "checks": None, "errors": errors[:30]}
        finally:
            try:
                await page.close()
            except Exception:
                pass

    @modal.asgi_app()
    def web(self):
        from fastapi import FastAPI, Request

        api = FastAPI()

        # Same path and contract as the hub's own verifier, so gen_phaser.mjs works
        # against either with only HUB changed.
        @api.post("/api/game/verify")
        async def verify(req: Request):
            body = await req.json()
            return await self._verify(body.get("engine", "phaser"), body.get("code", ""))

        @api.get("/api/health")
        def health():
            m = self._manifest()
            # What the container actually sees on the volume. Cheap, and it is the
            # difference between "empty" and knowing WHY it is empty.
            try:
                seen = sorted(os.listdir(VOL_MOUNT))[:6]
            except Exception as e:  # noqa: BLE001
                seen = [f"listdir failed: {e}"]
            return {"ok": True, "where": "modal", "engines": list(ENGINES),
                    "assetVersion": m["version"], "assetCount": m["count"],
                    "volume": {"mount": VOL_MOUNT, "assetDir": ASSET_DIR, "sees": seen,
                               "manifestExists": os.path.exists(os.path.join(ASSET_DIR, "manifest.json"))}}

        return api
