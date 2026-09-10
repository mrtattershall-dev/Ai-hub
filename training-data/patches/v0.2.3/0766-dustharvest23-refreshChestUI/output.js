function refreshChestUI() {
  const grid = document.getElementById('chestGrid');
  grid.innerHTML = '';
  let totalW = 0;
  for (let i = 0; i < CHEST_SIZE; i++) {
    const slot = chestSlots[i];
    const cell = document.createElement('div');
    cell.className = 'inv-cell' + (slot ? ' filled' : '');
    if (slot) {
      const it = ITEMS[slot.itemId];
      cell.innerHTML = `<span class="ci">${it ? it.icon : '?'}</span><span class="cn">${it ? it.name.split(' ')[0] : ''}</span><span class="cq">${slot.qty}</span>`;
      totalW += ((it && it.weight) || 0) * slot.qty;
      // Click to move slot back to player inventory
      cell.addEventListener('click', () => {
        const added = addItem(slot.itemId, slot.qty);
        if (added > 0) {
          chestSlots[i] = null;
          refreshChestUI();
          refreshInvUI();
          buildHotbar();
        } else {
          showMsg('⚠️ Bag full — sell goods first!');
        }
      });
    }
    grid.appendChild(cell);
  }
  document.getElementById('chestWeightLabel').textContent = Math.round(totalW * 10) / 10 + ' kg';
}