function useBeeswaxCandle() {
  if (!gameState.inMine) { showMsg('🕯️ Candles are for the mine.'); return; }
  if (countItem('beeswaxCandle') <= 0) { showMsg('🕯️ No candles in your pack.'); return; }
  removeItem('beeswaxCandle', 1);
  gameState._candleBurnLeft = 90;
  showMsg('🕯️ Candle lit — burns for 90 seconds. The shadows pull back a little.');
  spawnParticles(player.x, player.y, '#e0d060', 4, '🕯️');
}