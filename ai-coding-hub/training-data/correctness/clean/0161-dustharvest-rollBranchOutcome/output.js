function rollBranchOutcome(floor) {
  // Weights by floor — deeper = more variance
  const tables = [
    { safe:0.50, hollow:0.30, gasPocket:0.20, richVein:0, gemCache:0, fossil:0, collapse:0 },
    { safe:0.38, hollow:0.22, gasPocket:0.15, richVein:0.22, gemCache:0, fossil:0.03, collapse:0 },
    { safe:0.28, hollow:0.18, gasPocket:0.12, richVein:0.20, gemCache:0.10, fossil:0.07, collapse:0.05 },
    { safe:0.18, hollow:0.12, gasPocket:0.10, richVein:0.25, gemCache:0.15, fossil:0.10, collapse:0.10 },
  ];
  const table = tables[Math.min(floor, 3)];
  let r = Math.random();
  for (const [k, w] of Object.entries(table)) {
    r -= w;
    if (r <= 0) return k;
  }
  return 'safe';
}