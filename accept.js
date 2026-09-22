// Acceptance script for the jungle-debt restore repair.
//
// Paste into the browser console with the game running, then: await __DH_ACCEPT()
// Runs identically against the patched and unpatched builds — that is the point.
//
// Requirement under test:
//   loading the same save must produce the same persisted debt state, regardless of
//   what happened in the session before the load.
//
// Note on `gameState.day = 1` in fresh(): startNewGame() does not itself reset the day.
// In normal play that is guaranteed by the page reload on Return to Title (game.html:753)
// and on foreclosure new-game (19386), so this line only reproduces what a real new game
// gets for free. See REPAIR-REPORT.md, "A latent thing found on the way".
window.__DH_ACCEPT = async function () {
  const KEY = 'dustAndHarvest_save_1';
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function fresh() {
    window._activeSaveSlot = 1;
    localStorage.removeItem(KEY); localStorage.removeItem(KEY + '_backup');
    startNewGame(); await sleep(700);
    gameState.day = 1;
  }

  // save:    what the save file will contain
  // session: what the live session is changed to before the load
  // mutate:  optional surgery on the save JSON (used to simulate an older save)
  async function caseRun(save, session, mutate) {
    await fresh();
    initJGDebt();
    gameState._jgDebt = save.debt;
    gameState._jgDebtFree = save.free;
    gameState._jgAltaverdeWarned = save.warned;
    saveGame(true);
    if (mutate) {
      const d = JSON.parse(localStorage.getItem(KEY));
      mutate(d);
      localStorage.setItem(KEY, JSON.stringify(d));
    }
    gameState._jgDebtFree = session.free;
    gameState._jgAltaverdeWarned = session.warned;
    gameState._jgDebt = session.debt;
    loadGame(); await sleep(700);
    return { free: gameState._jgDebtFree, warned: gameState._jgAltaverdeWarned, debt: gameState._jgDebt };
  }

  const c1 = await caseRun({ debt: 145000, free: false, warned: false }, { debt: 0, free: true, warned: true });
  const c2 = await caseRun({ debt: 0, free: true, warned: true }, { debt: 145000, free: false, warned: false });
  const c3 = await caseRun({ debt: 145000, free: false, warned: false }, { debt: 0, free: true, warned: true },
    d => { delete d.jgDebtFree; delete d.jgAltaverdeWarned; });

  // The gameplay consequence: $145k owed, three qualifying overdue weeks — Altaverde
  // enforcement must fire. _checkBondForeclosure() returns early on _jgDebtFree.
  gameState.day = 400;
  jgWeeklyBills.length = 0;
  jgWeeklyBills.push(
    { week: 1, due: 10, minPayment: 5000, paidAmount: 0, paid: false },
    { week: 2, due: 17, minPayment: 5000, paidAmount: 0, paid: false },
    { week: 3, due: 24, minPayment: 5000, paidAmount: 0, paid: false });
  const cb = gameState._complianceLevel || 0;
  _checkBondForeclosure();
  const ca = gameState._complianceLevel || 0;

  const cases = {
    'case1 save=false session=true  -> expect free:false': { got: c1, pass: c1.free === false && c1.warned === false },
    'case2 save=true  session=false -> expect free:true ': { got: c2, pass: c2.free === true && c2.warned === true },
    'case3 fields ABSENT            -> expect free:false': { got: c3, pass: c3.free === false && c3.warned === false },
  };
  return {
    ...cases,
    consequence: {
      owes: gameState._jgDebt, debtFree: gameState._jgDebtFree,
      contradiction: gameState._jgDebt > 0 && gameState._jgDebtFree === true,
      complianceBefore: cb, complianceAfter: ca, enforcementFired: ca > cb,
    },
    allCasesPass: Object.values(cases).every(c => c.pass),
  };
};
console.log('loaded — run:  await __DH_ACCEPT()');
