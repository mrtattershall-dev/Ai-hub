"""
sync_assets.py - push the hub's asset library to the Modal volume the verifier serves from.

    python factory/sync_assets.py                 # upload assets/ -> volume "hub-assets"
    python factory/sync_assets.py --check URL     # ...then confirm the verifier sees the same version

WHY
---
The Chromium verifier on Modal is what scores the Phaser eval. If it serves a different
set of assets than the hub does, a game can pass locally and fail on Modal (or the
reverse) for reasons that have nothing to do with the model. So the library is pushed
whole, and both sides compute the same version hash (sha256 over sorted "name:sha256"
lines, first 16 hex chars - see server/assets.js and modal_chromium.py). If the hashes
match, the eval is measuring the code, not the asset set.

Run this after any import. It is idempotent; unchanged files are cheap.
"""
import hashlib
import json
import os
import subprocess
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, "..", "..", "assets"))
VOLUME = "hub-assets"


def local_version() -> tuple[str, int]:
    manifest = os.path.join(ASSETS, "manifest.json")
    if not os.path.exists(manifest):
        return "empty", 0
    with open(manifest, "r", encoding="utf-8") as f:
        items = json.load(f).get("items", [])
    if not items:
        return "empty", 0
    h = hashlib.sha256()
    for it in sorted(items, key=lambda x: x.get("name", "")):
        h.update(f"{it.get('name')}:{it.get('sha256')}\n".encode())
    return h.hexdigest()[:16], len(items)


def main() -> int:
    if not os.path.isdir(ASSETS):
        print(f"no asset library at {ASSETS}")
        return 1
    version, count = local_version()
    size = sum(os.path.getsize(os.path.join(ASSETS, f)) for f in os.listdir(ASSETS)
               if os.path.isfile(os.path.join(ASSETS, f)))
    print(f"local library: {count} files, {size / 1048576:.1f} MB, version {version}")

    # Upload the directory contents to the volume root. --force overwrites files that
    # changed; unchanged ones are skipped by content.
    cmd = [sys.executable, "-m", "modal", "volume", "put", VOLUME, ASSETS, "/", "--force"]
    print("  $", " ".join(cmd), flush=True)
    rc = subprocess.run(cmd, cwd=os.path.dirname(HERE)).returncode
    if rc != 0:
        print("upload failed")
        return rc
    print(f"uploaded to volume {VOLUME}")

    if "--check" in sys.argv:
        url = sys.argv[sys.argv.index("--check") + 1].rstrip("/") + "/api/health"
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                j = json.loads(r.read().decode())
        except Exception as e:  # noqa: BLE001
            print(f"health check failed: {e}")
            return 2
        remote = j.get("assetVersion")
        print(f"verifier reports version {remote} ({j.get('assetCount')} files)")
        if remote != version:
            print("MISMATCH - the verifier is serving a different library than the hub. "
                  "Re-run this, or wait for the container to see the new volume commit.")
            return 3
        print("versions match - the eval and the hub are looking at the same assets.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
