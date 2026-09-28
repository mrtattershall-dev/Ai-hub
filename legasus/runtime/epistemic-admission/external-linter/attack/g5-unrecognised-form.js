const cb = (x) => { if (x > 0) return x; };
export const viaVariable = (xs) => xs.map(cb);
export const viaFrom = (xs) => Array.from(xs, (x) => { if (x > 0) return x; });
