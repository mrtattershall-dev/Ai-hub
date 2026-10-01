# Cleanup debt — state whose lifecycle is not tied to the experiment that created it

Recorded 2026-10-01 at tatte's request, deliberately SEPARATE from D-COPY.

## Stale session monitors (2026-10-01)

During D-CONSUME-1 and D-ID-1 the assistant session armed tool-level "Monitor" watches on probe
output files. Each outlived its probe: the probe finished, sealed its EH1 run and was committed, and
the monitor kept running until its 30-minute timeout, then reported "expired" into the session as
if something had happened. Harmless operationally - they watched files that no longer changed - but
they are the same shape as the stale index.lock (set D) and the never-reaped containers this project
has paid for: state whose end is not mechanically tied to the end of the work that created it.

Instances: D-CONSUME-1 run 1 and run 2 monitors, the D-ID-1 regression monitor.

Not repaired. A mechanical fix would make a watch's lifetime end with the process it watches
(e.g. tail --pid, or watching the process rather than its output file), instead of a fixed timeout.
