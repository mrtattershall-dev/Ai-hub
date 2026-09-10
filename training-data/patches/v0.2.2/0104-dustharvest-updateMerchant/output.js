function updateMerchant() {
  if (!merchantPresent && gameState.day >= merchantNextDay && !gameState.isNight) {
    merchantPresent = true;
    showMsg('🐪 A traveling merchant has arrived on the road! [E] to trade. Here until dusk.');
  }
  // Leave at night
  if (merchantPresent && gameState.isNight) {
    merchantPresent = false;
    merchantShopOpen = false;
    closeMerchantShop();
    merchantNextDay = gameState.day + 3 + Math.floor(Math.random() * 2);
    showMsg('🐪 The traveling merchant packed up and rode off into the night.');
  }
}