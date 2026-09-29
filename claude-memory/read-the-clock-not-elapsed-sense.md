---
name: read-the-clock-not-elapsed-sense
description: "2026-09-22 — I estimated wall-clock for ~6 turns without reading it, diagnosed a healthy 20-min run as \"stuck for 47 min\", and stamped frozen prereg amendments with invented times; always `date` before any elapsed-time claim or record stamp"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 784f5dee-d411-40db-b5ec-cf91b8f4605f
  modified: 2026-09-22T10:20:32.356Z
---

2026-09-22, Set G clean recovery run. I believed it was ~06:05 when it was **05:19**. From that
I inferred: the run was 65 min old (it was 20), a checker child was "stuck 47 minutes with 2.2 s
CPU" (it was 66 seconds old and its work lives in grandchildren), and `spawnSync`'s 15-minute
timeout "wasn't firing on Windows" (it had not been reached). All three were false, all three
were reported, and I nearly proposed killing my own healthy run.

Worse for the records: prereg amendments were stamped "05:40", "05:45", "05:55" while being
written before 05:19. Order was right; absolute times were fiction inside a FROZEN document.
Fixed by appending a clock-stamped correction, not by editing history.

**Why:** I have no clock. Elapsed time between turns is unknowable to me - it can be seconds or
many minutes. Any "it's been a while" inference is a reported state with nothing behind it,
the same class as inferring a child's success from an output file existing
([[setg-survivors-load-time-throws]] records the rig-side version of that bug).

**How to apply:**
- Before ANY claim of the form "X has been running for N minutes" or "this should have
  finished by now": run `date` (or `Get-Date`) in the same call as the check.
- Before stamping a time into a record: generate it from `date` in the write command
  (`printf ... $(date +%H:%M:%S)`), never type it.
- Process age = CreationDate vs NOW read in the same query, not vs a remembered "now".
- A low CPU-seconds number on a parent process is not "stuck" when its work is in child
  processes; look at the descendants before concluding anything.
