function _getJGExportPrice(itemId) {
  const base = BASE_PRICES[itemId] || 1;
  const jungleRepMult = (() => {
    const tier = getRepTier('jungle');
    if (tier === 'revered')      return 1.15;
    if (tier === 'trusted')      return 1.08;
    if (tier === 'acquaintance') return 1.00;
    return 0.90;
  })();
  return Math.floor(base * JG_EXPORT_MULT * jungleRepMult);
}