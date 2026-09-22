// A callback carrying exactly the obligation, passed by reference. Same behaviour, same risk.
const cb = (x) => { if (x > 0) return x; };
export const viaVariable = (xs) => xs.map(cb);
