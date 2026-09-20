// The recorder the instrumented shims write into. A plain module in the MAIN module graph, so the
// shim the loader generates and the harness that reads the result share one instance.
//
// This module deliberately exports nothing that can construct anything.
import { recorder } from './witness.mjs';

export const REC = recorder();

// Called by generated shims only. `op` is the qualified name of the real function being wrapped.
export const __wrap = (op, fn) => REC.instrument(op, fn);

// Called by generated shims to hand the recorder THE SUBJECT'S OWN authority predicate. The recorder
// never writes one; it has no way to know what counts as authority in a module it is watching.
export const __brand = (pred) => REC.brand(pred);
