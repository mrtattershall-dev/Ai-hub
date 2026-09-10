function getWeeklyBillAmount(week) {
  const dm = getDifficultyConfig().debtMult || 1.0;
  const base = Math.round((DEBT_WEEKLY_BASE + (week - 1) * DEBT_WEEKLY_STEP) * dm);
  // Vera's case: mineral rights complaint reduces each bill by $50
  return player._veraDebtReduction ? Math.max(0, base - 50) : base;
}