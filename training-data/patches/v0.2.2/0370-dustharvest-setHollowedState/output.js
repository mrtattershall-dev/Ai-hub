function setHollowedState(newState) {
  const prev = getHollowedState();
  if (prev === newState) return;
  gameState._hollowedState = newState;
  // Update rep to reflect state
  const repMap = { hostile: -20, cautious: 10, open: 35, allied: 70 };
  if (repMap[newState] !== undefined) {
    REPUTATION.hollowed = repMap[newState];
  }
}