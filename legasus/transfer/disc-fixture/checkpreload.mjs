/**
 * The harness's injected reporter. It prints a tagged PASS line ONLY when the two values it
 * received are equal - the representation is produced FROM the comparison, not chosen by the
 * caller. The nonce is generated per run by the driver.
 */
const NONCE = process.env.LEGASUS_NONCE || '';
globalThis.__legasus_check = (id, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${NONCE} ${id}`);
  return ok;
};
