---
name: transfer-bind-cannot-attach
description: 2026-09-21 TRANSFER-BIND ended CANNOT_ATTACH — BIND's ESM resolve hook does not intercept CommonJS require (Node 24); the ai-native-engine is otherwise a measured, viable foreign target; arm B showed the live false-preservation path that substitution identity (R11) caught
metadata:
  type: project
---

BIND's mutant transport (`module.register` + ESM `resolve` hook) does NOT answer a CommonJS
`require` on Node 24.15/win32. Proven with a four-arm probe whose arm D (ESM, same mechanism,
same run) DID substitute — so the negative is about the CJS loading path, not about the probe.
Conclusion is narrow: *this frozen transport does not support this CommonJS module-loading
path.* Not "CJS can't be instrumented", not "BIND can't generalize".

Arm B is the finding: a RETURN_EMPTY mutant was requested, never served, and the witness passed
2/2 exit 0 — which read from the outcome alone is "equivalent / preserved". Caught only by the
served file's load-time self-identification (contract R11, frozen first).

`C:\Users\tatte\OneDrive\Documents\ai-native-engine` is a MEASURED foreign target: 33 CJS test
files, all exit 0, 776 uniquely identified cases, V8 coverage emits under CJS, zero side
effects on its own tree, no package.json/.git/deps, canonical invocation UNESTABLISHED.

**Why:** separates target observability (fine) from intervention capability (blocked), so
future work has a specific job rather than "port BIND".
**How to apply:** BIND-CJS = establish a CJS intervention mechanism with the SAME evidentiary
properties, under its own prereg; it cannot retroactively make this transfer succeed. Next
falsification: same transfer against an ESM foreign repo with no manifest, to separate
"CommonJS" from "no documented invocation" — and R4 must stay UNESTABLISHED even if R8
succeeds. Artifacts: legasus/out/transfer-engine/, commits b822ed6 / 7ba9c9e / db4f3d9.
See [[bind-2-support-result]], [[cancer-scanner-bar-and-pipeline]].
