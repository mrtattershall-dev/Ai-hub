# Releasing

1. suites green: `node --check desksprite.js && node tools/test-skin.cjs && node tools/verify-blue-boy.cjs && node tools/test-png-to-skin.mjs && node tools/test-render-gif.mjs`
2. `npm pack --dry-run` — check the file list still looks like the library, not the workshop
3. bump `version` in package.json (this repo ships from `main`)
4. `npm login` (once per machine) → `npm publish`
5. tag it: `git tag v<version> && git push --tags`
