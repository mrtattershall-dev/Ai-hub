function openShop() {
  if (shopState.open) return;
  shopState.open = true;
  gameRunning = false;
  elShopOverlay.classList.add('show');
  elShopCash.textContent = shopState.cash;
  // Random Shifty quote
  document.getElementById('shop-shifty-quote').textContent =
    shiftyQuotes[Math.floor(Math.random() * shiftyQuotes.length)];
  // Update item states
  document.querySelectorAll('.shop-item').forEach(el => {
    const key = el.dataset.item;
    const item = shopItems[key];
    const owned = shopState.boughtItems.has(key);
    const canAfford = shopState.cash >= item.price;
    el.classList.remove('disabled','purchased');
    const priceEl = el.querySelector('.item-price');
    if (!item.repeatable && owned) {
      el.classList.add('purchased');
      if (priceEl) { priceEl.textContent = '✓ OWNED'; priceEl.classList.add('free'); }
    } else if (!canAfford) {
      el.classList.add('disabled');
    } else {
      // Restore original price if re-opening shop
      if (priceEl && priceEl.textContent === '✓ OWNED') priceEl.textContent = '$'+item.price;
    }
  });
}