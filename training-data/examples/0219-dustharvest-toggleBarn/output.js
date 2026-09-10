function toggleBarn() {
  if (!player._barnRepaired) {
    showMsg('🏚 The barn is derelict — buy the Barn Repair upgrade at the market first ($500).');
    return;
  }
  barnOpen = !barnOpen;
  // Set barn door tiles
  setT(BARN_TX,   BARN_TY, barnOpen ? TL.BARN_OPEN : TL.BARN_CLOSED);
  setT(BARN_TX+1, BARN_TY, barnOpen ? TL.BARN_OPEN : TL.BARN_CLOSED);
  showMsg(barnOpen ? '🚪 Barn open.' : '🚪 Barn closed — animals inside are safe.');
}