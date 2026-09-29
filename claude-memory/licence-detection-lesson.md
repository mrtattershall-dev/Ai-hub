---
name: licence-detection-lesson
description: "Absence of a LICENSE file is not absence of terms — three misses in one day (CraftPix URL-only file, Franuka \"License and index.txt\", phaserjs/examples MIT-in-README) excluded the single best Phaser source twice"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-10T06:10:10.071Z
---

On 2026-09-09/10, licence detection failed three times with the same root cause: treating
the absence of a *conventional file* as the absence of *terms*.

- CraftPix packs: `License.txt` contains only a URL (`craftpix.net/file-licenses`).
- Franuka icon pack: file is `License and index.txt` — a pattern requiring a dot after the
  word missed it; that pack is CC BY 4.0 and legally requires attribution.
- `phaserjs/examples`: GitHub API says `license: null` because there is no LICENSE file,
  but the README states "released under the MIT license". I excluded it twice as
  all-rights-reserved. It then yielded **8,274 rows** — more than the entire 397-repo
  search planned around it. 484 repos had been dropped on that null field alone.

**Why:** the user pointed at the repo directly; without that, the highest-yield source in
the whole project would have stayed excluded on a wrong assumption stated confidently.

**How to apply:** before excluding anything for licence reasons, check the README and any
`*licen*`/`*readme*`/`*terms*` file with a loose pattern, and record the matched sentence
as evidence. `training-data/factory/search_repos.mjs` now does README recovery. State
"no terms found in archive/repo" rather than "all rights reserved" — the first is what was
actually measured. Related: [[asset-library-contract-2026-09-09]].
