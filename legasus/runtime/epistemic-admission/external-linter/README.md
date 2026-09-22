# External applicability experiment — eslint `array-callback-return`

Frozen rule: `../EXTERNAL-LINTER_PREREG.md`.  Result: `../EXTERNAL-LINTER_RESULT.md`.

The tool itself is NOT vendored here. To reproduce:

```bash
npm install eslint --no-audit --no-fund
node enumerate.mjs                                   # F1: the tool selects its own obligation
node run-dev.mjs cases/a-dev-clean-and-violating.js  # F3: the development case
node run-eval.mjs cases/b-*.js cases/c-*.js cases/d-*.js   # F4: reserved cases
node run-eval.mjs node_modules/eslint/lib/rules/a*.js      # F5: untouched external files
node scan.mjs node_modules                           # F6: the search for an external violation
```

`adapter-eslint.mjs` imports the Legasus runtime by absolute path; adjust it if the repo moves.
Every human choice in the translation is marked `STEERING:` in that file.
