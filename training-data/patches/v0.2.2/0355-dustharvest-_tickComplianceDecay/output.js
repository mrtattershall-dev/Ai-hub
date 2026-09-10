function _tickComplianceDecay(dt) {
  if (!gameState.inJungle) return;
  if ((gameState._complianceLevel || 0) <= 0) return;
  const elapsed = (gameState.totalSeconds || 0) - (gameState._complianceLastContact || 0);
  if (elapsed < JG_COMPLIANCE_DECAY_DELAY) return;
  const prevTier = getComplianceTier();
  gameState._complianceLevel = Math.max(0, gameState._complianceLevel - JG_COMPLIANCE_DECAY_RATE * dt);
  const newTier = getComplianceTier();
  if (newTier.level < prevTier.level) {
    showMsg('📄 Compliance Level dropped — "Administrative delays in processing your file."');
  }
  updateComplianceHUD();
}