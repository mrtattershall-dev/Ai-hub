// retry function that calls an async fn until it resolves or attempts run out
// then rethrows the last error
async function retry(fn, times) {
  let lastError;
  
  for (let i = 0; i < times; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
    }
  }
  
  throw lastError;
}

module.exports = { retry };