function chestWithdrawAll() {
  let moved = 0;
  for (let i = 0; i < getChestSize(); i++) {
    if (!chestSlots[i]) continue;
    const added = addItem(chestSlots[i].itemId, chestSlots[i].qty);
    if (added > 0) { chestSlots[i] = null; moved += added; }
  }
  if (moved > 0) { showMsg(`📦 Withdrew ${moved} item${moved > 1 ? 's' : ''} from chest.`); refreshChestUI(); refreshInvUI(); buildHotbar(); }
  else showMsg('Chest is empty — or bag full.');
}