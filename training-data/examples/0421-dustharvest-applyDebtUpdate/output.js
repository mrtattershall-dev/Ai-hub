function applyDebtUpdate(msg) {
  if (Array.isArray(msg.weeklyBills)) {
    weeklyBills.length = 0;
    for (const b of msg.weeklyBills) weeklyBills.push(b);
  }
  if (msg.playerDebt !== undefined) player.debt = msg.playerDebt;
  try { refreshDebtHUD(); } catch(_){}
  try { updateDebtClock(); } catch(_){}
  try { refreshMarketUI(); } catch(_){}
}