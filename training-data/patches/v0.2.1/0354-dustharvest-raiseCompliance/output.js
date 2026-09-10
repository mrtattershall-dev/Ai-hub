function raiseCompliance(reason) {
  if (!gameState.inJungle) return;
  const amount = JG_COMPLIANCE_RAISE[reason] || 0.3;
  const prev = gameState._complianceLevel || 0;
  gameState._complianceLevel = Math.min(JG_COMPLIANCE_MAX, prev + amount);
  gameState._complianceLastContact = gameState.totalSeconds || 0;

  // Show tier-up message when crossing a threshold
  const newTier = getComplianceTier();
  const prevTier = (() => {
    let t = JG_COMPLIANCE_TIERS[0];
    for (const ct of JG_COMPLIANCE_TIERS) { if (prev >= ct.min) t = ct; }
    return t;
  })();

  if (newTier.level > prevTier.level) {
    const msg = newTier.msgs[Math.floor(Math.random() * newTier.msgs.length)];
    showMsg('⚓ Altaverde: ' + msg);
  }

  updateComplianceHUD();
}