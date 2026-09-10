function buyItem(itemId, qty) {
  const storePrices = { bread:8, potion:25, bigPotion:55 };
  const cost = (storePrices[itemId]||10) * qty;
  if (player.gold < cost) { showMsg(`⚠️ Need $${cost}. You have $${player.gold}.`); return; }
  player.gold -= cost;
  trackGoldSpent(cost);
  addItem(itemId, qty);
  showMsg(`Bought ${qty}× ${ITEMS[itemId].name} for $${cost}.`);
  refreshMarketUI();
}