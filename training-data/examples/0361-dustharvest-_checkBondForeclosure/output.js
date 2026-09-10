function _checkBondForeclosure() {
  if (_bondForeclosureFired) return;
  if (typeof gameState._jgDebt === 'undefined') return;
  if (gameState._jgDebtFree) return;

  const overdueWeeks = jgWeeklyBills.filter(b =>
    !b.paid && (b.due + JG_DEBT_WEEK_LENGTH * 4) <= gameState.day
  ).length;
  if (overdueWeeks < 2) return;

  _bondForeclosureFired = true;
  gameState._complianceLevel = Math.min(JG_COMPLIANCE_MAX, (gameState._complianceLevel || 0) + 2.0);
  updateComplianceHUD();
  showMsg('⚓ ALTAVERDE NOTICE: "Due to sustained non-payment, Bond Charter Article 14 has been invoked. Enforcement personnel are authorised to reclaim territorial assets. This notice is legally binding."');
  // Reset foreclosure flag after a week so it can fire again if still unpaid
  setTimeout(() => { _bondForeclosureFired = false; }, JG_DEBT_WEEK_LENGTH * 86400 * 1000);
}