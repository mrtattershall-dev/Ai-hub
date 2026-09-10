function appendMineJournal(text, isSurveyor=false) {
  if (!gameState._mineJournal) gameState._mineJournal = [];
  gameState._mineJournal.push({ day: gameState.day, text, isSurveyor });
  // Keep last 40 entries
  if (gameState._mineJournal.length > 40) gameState._mineJournal.shift();
  // After every 10 entries, generate a surveyor's note
  if (gameState._mineJournal.length % 10 === 0) {
    const notes = [
      `📜 "Grid reference 3-E shows anomalous density. Hargrove has been informed. Survey team not returning calls." — surveyor's note`,
      `📜 "The blue coal seam wasn't on any Altaverde Holdings map. Someone removed it." — surveyor's note`,
      `📜 "Coordinate 7-G: do NOT drill. This is a standing order. No explanation given." — surveyor's note`,
      `📜 "Vein D-7 output has tripled since the last survey. The stone around it looks… younger." — surveyor's note`,
      `📜 "Foreman Kreis left a note: the canary stopped singing on Floor 4. It just stares at the east wall." — surveyor's note`,
    ];
    const note = notes[Math.floor(gameState._mineJournal.length / 10 - 1) % notes.length];
    gameState._mineJournal.push({ day: gameState.day, text: note, isSurveyor: true });
  }
}