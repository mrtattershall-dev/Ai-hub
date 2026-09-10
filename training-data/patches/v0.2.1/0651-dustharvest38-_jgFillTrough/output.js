function _jgFillTrough(enclosureId) {
  const enc = jgEnclosures.find(e => e.id === enclosureId);
  if (!enc) return;
  const def = JG_ANIMAL_DEFS[enc.type];
  const needed = 100 - (enc.troughFill || 0);
  if (needed <= 0) { showMsg('✓ Trough already full.'); return; }
  // Feed with appropriate item or generic (heartleaf, ashgrain, jungleBanana)
  const feedItems = [def.feedItem, 'heartleaf', 'jungleBanana', 'ashgrain', 'caneReed'].filter(Boolean);
  let filled = 0;
  for (const item of feedItems) {
    while (filled < needed && countItem(item) > 0) {
      removeItem(item, 1);
      filled += 15;
    }
    if (filled >= needed) break;
  }
  if (filled === 0) {
    showMsg(`⚠ No suitable feed. ${def.name} likes ${ITEMS[def.feedItem]?.name || def.feedItem}, or any jungle crop.`);
    return;
  }
  enc.troughFill = Math.min(100, (enc.troughFill || 0) + filled);
  showMsg(`🪣 Trough filled +${filled}% (${ITEMS[def.feedItem]?.name || 'feed'} used).`);
  _renderJGAnimalPanel();
}