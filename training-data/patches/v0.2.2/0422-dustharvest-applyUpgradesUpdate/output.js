function applyUpgradesUpdate(msg) {
  if (Array.isArray(msg.upgrades)) {
    purchasedUpgrades.clear();
    for (const id of msg.upgrades) purchasedUpgrades.add(id);
    // Use _origRefreshChestUI — the wrapped version would re-broadcast
    // the chest state back to the sender (echo loop).
    try { _origRefreshChestUI(); } catch(_){}
    try { refreshMarketUI(); } catch(_){}
  }
}