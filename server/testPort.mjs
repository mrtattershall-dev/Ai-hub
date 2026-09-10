/**
 * testPort.mjs - a port that is actually free, for tests that spawn a server.
 *
 * WHY
 * ---
 * Every suite that boots a hub picked a random port from a hand-chosen band:
 *
 *   chatTimeout  3400-3799     godotVerify  3400-3699
 *   googleE2E    3700-3899     loopSmoke    3820-3969
 *   hostileModel 3960-4159     queueChain   3099-3398
 *   ...and two different fake servers both on 11600+
 *
 * Those bands overlap, so suites pass alone and fail in a batch - which is the worst
 * failure mode a test can have, because the natural reading is "my change broke it".
 * Measured 2026-09-10: a full sweep reported queueLock failing; queueLock was fine, it had
 * simply lost a coin toss with a neighbour. Ten minutes went into looking for a bug that
 * did not exist.
 *
 * Reshuffling the constants would just move the collision further away. Asking the OS is
 * the only answer that keeps working when someone adds the next suite.
 *
 * THE CAVEAT, STATED
 * ------------------
 * There is a gap between closing the probe socket and the child binding, so this is very
 * unlikely to collide rather than impossible. That is strictly better than a fixed band,
 * and it needs no coordination between suites - which is the actual problem being solved.
 */
import { createServer } from 'node:net';

/** One free port, from the OS. */
export function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/** Several at once, guaranteed distinct - a test that needs a hub AND a fake upstream. */
export async function freePorts(n = 2) {
  const held = [];
  const ports = [];
  // Hold each one open until all are chosen, or the OS may hand out the same port twice.
  await new Promise((resolve, reject) => {
    let left = n;
    for (let i = 0; i < n; i++) {
      const probe = createServer();
      probe.unref();
      probe.on('error', reject);
      probe.listen(0, '127.0.0.1', () => {
        ports.push(probe.address().port);
        held.push(probe);
        if (--left === 0) resolve();
      });
    }
  });
  await Promise.all(held.map((s) => new Promise((r) => s.close(r))));
  return ports;
}
