function openMerchantShop() {
  if (!merchantPresent) return;
  merchantShopOpen = true;
  const el = document.getElementById('merchantShop');
  if (!el) return;
  let h = `<div style="font-size:11px;color:#e8c860;margin-bottom:6px;letter-spacing:.05em">🐪 TRAVELING MERCHANT</div>`;
  h += `<div style="font-size:9px;color:#907050;margin-bottom:10px">Rare goods from afar. Gone by nightfall.</div>`;
  for (const item of MERCHANT_STOCK) {
    const canAfford = item.isTrade || player.gold >= item.cost;
    h += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="font-size:16px">${item.icon}</span>
      <span style="flex:1;font-size:9px;color:#d4b870">${item.label}</span>
      ${item.isTrade ? '' : `<span style="font-size:9px;color:#80b0f0">$${item.cost}</span>`}
      <button onclick="merchantBuy(${MERCHANT_STOCK.indexOf(item)})"
        style="font-size:8px;padding:2px 8px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(180,140,40,.15);border:1px solid rgba(180,140,40,.4);color:#d4b870;border-radius:2px;${!canAfford?'opacity:.4':''}"
        ${!canAfford?'disabled':''}>${item.isTrade ? 'TRADE' : 'BUY'}</button>
    </div>`;
  }
  h += `<button onclick="closeMerchantShop()" style="margin-top:6px;width:100%;font-size:9px;padding:4px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(100,60,20,.3);border:1px solid rgba(180,140,40,.3);color:#907050;border-radius:2px">CLOSE</button>`;
  el.innerHTML = h;
  el.style.display = 'block';
}