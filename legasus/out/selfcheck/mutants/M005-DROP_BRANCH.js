// A synthetic subject with one site for every operator in the frozen family, and KNOWN
// answers, so the apparatus can be checked before it is pointed at a real subject.
export function clamp(x) {
  let out = x;
  if (out > 10) {
    out = 10;
  } 
  try {
    if (typeof x !== 'number') throw new TypeError('not a number');
  } catch (e) {
    return -1;
  }
  return out;
}

export function untouched(y) {
  return y * 2;
}
