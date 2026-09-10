function buildRuinsMap() {
  if (_ruinsMapBuilt) return;
  _ruinsMapBuilt = true;
  ruinsMap.fill(JG.FLOOR);

  // Outer walls
  for (let y = 0; y < RU_H; y++) {
    for (let x = 0; x < RU_W; x++) {
      if (x === 0 || x === RU_W-1 || y === 0 || y === RU_H-1) setRUT(x, y, JG.WALL);
    }
  }

  // Entry Hall: y:0-9. Exit tile at top centre.
  setRUT(19, 0, JG.ASCEND); setRUT(20, 0, JG.ASCEND); // exit back to jungle

  // Dividing wall between Hall and Processing floor y:9
  for (let x = 0; x < RU_W; x++) {
    if (x !== 18 && x !== 19 && x !== 20 && x !== 21) setRUT(x, 9, JG.WALL);
  }

  // Dividing wall between Processing and Archive y:19
  for (let x = 0; x < RU_W; x++) {
    if (x !== 9 && x !== 10 && x !== 11) setRUT(x, 19, JG.WALL);
  }

  // Room rubble — deterministic scatter
  const rubble = [
    // Entry hall
    [4,2],[8,3],[14,2],[22,4],[28,3],[34,2],[6,6],[16,7],[30,6],[36,7],
    // Processing floor
    [3,11],[10,12],[18,11],[26,13],[33,11],[7,16],[22,15],[35,16],
    // Archive — more debris, older
    [4,21],[9,22],[15,21],[20,24],[25,22],[30,21],[35,24],
    [6,27],[13,26],[19,28],[27,27],[33,26],
  ];
  for (const [x, y] of rubble) {
    if (x > 0 && x < RU_W-1 && y > 0 && y < RU_H-1) setRUT(x, y, JG.ROCK);
  }

  // Archive — old Altaverde equipment crates (WALL tile with different visual)
  const crates = [[7,23],[16,25],[24,23],[31,25]];
  for (const [x, y] of crates) setRUT(x, y, JG.WALL);

  // Document location tiles — specific spots
  setRUT(15, 12, JG.FLOOR); // manifest spot  (processing floor)
  setRUT(28, 11, JG.FLOOR); // memo spot       (processing floor east)
  setRUT(8,  25, JG.FLOOR); // land promise    (archive, deep)
}