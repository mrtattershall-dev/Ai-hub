function rollOreQuality(floor) {
  // Weights by floor: deeper = more pure
  const tables = [
    { flawed:0.55, standard:0.40, pure:0.05 }, // floor 0
    { flawed:0.35, standard:0.50, pure:0.15 }, // floor 1
    { flawed:0.20, standard:0.45, pure:0.35 }, // floor 2
    { flawed:0.10, standard:0.35, pure:0.55 }, // floor 3 — The Unmapped
  ];
  const table = tables[Math.min(floor, 3)];
  const r = Math.random();
  if (r < table.flawed) return 'flawed';
  if (r < table.flawed + table.standard) return 'standard';
  return 'pure';
}