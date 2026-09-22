// Acceptance script for the jungle-debt restore repair.
//
//   In the browser console, with the game running:
//     await (await fetch('/accept.js')).text().then(eval); await __DH_ACCEPT()
//
// Runs identically against the patched and unpatched builds — that is the point.
//
// REQUIREMENT UNDER TEST
//   The three repaired flags restore to their saved values independently of the values the
//   session held before the load. (This is a claim about these three flags, not about all
//   persisted debt state — see REPAIR-REPORT.md, "Still unrepaired".)
//
//     gameState._jgDebtFree          main loader,  game.html:25729
//     gameState._jgAltaverdeWarned   main loader,  game.html:25730
//     _bondForeclosureFired          jungle wrapper, game.html:32778
//
// Note on `gameState.day = 1` in fresh(): startNewGame() does not itself reset the day. In normal
// play that is guaranteed by the page reload on Return to Title (game.html:753) and on foreclosure
// new-game (19386), so this line only reproduces what a real new game gets for free.
window.__DH_ACCEPT = async function () {
  const KEY = 'dustAndHarvest_save_1';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // _bondForeclosureFired is a top-level `let`, not a window property.
  const readLatch = () => eval('_bondForeclosureFired');
  const setLatch = v => eval('_bondForeclosureFired = ' + (v ? 'true' : 'false'));

  async function fresh() {
    window._activeSaveSlot = 1;
    localStorage.removeItem(KEY); localStorage.removeItem(KEY + '_backup');
    startNewGame(); await sleep(700);
    gameState.day = 1;
  }

  // Make three weeks genuinely overdue, so Altaverde enforcement SHOULD fire.
  function makeOverdue() {
    gameState.day = 400;
    jgWeeklyBills.length = 0;
    jgWeeklyBills.push(
      { week: 1, due: 10, minPayment: 5000, paidAmount: 0, paid: false },
      { week: 2, due: 17, minPayment: 5000, paidAmount: 0, paid: false },
      { week: 3, due: 24, minPayment: 5000, paidAmount: 0, paid: false });
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
    setLatch(save.latch);
    saveGame(true);
    if (mutate) {
      const d = JSON.parse(localStorage.getItem(KEY));
      mutate(d);
      localStorage.setItem(KEY, JSON.stringify(d));
    }
    gameState._jgDebtFree = session.free;
    gameState._jgAltaverdeWarned = session.warned;
    gameState._jgDebt = session.debt;
    setLatch(session.latch);
    loadGame(); await sleep(800);
    return { free: gameState._jgDebtFree, warned: gameState._jgAltaverdeWarned,
             debt: gameState._jgDebt, latch: readLatch() };
  }

  const eq = (got, want) => got.free === want.free && got.warned === want.warned && got.latch === want.latch;

  // 1. the originally reported defect: an indebted save loaded while the session is debt-free
  const c1 = await caseRun({ debt: 145000, free: false, warned: false, latch: false },
                           { debt: 0, free: true, warned: true, latch: true });
  // 2. the direction that already worked — must not regress
  const c2 = await caseRun({ debt: 0, free: true, warned: true, latch: true },
                           { debt: 145000, free: false, warned: false, latch: false });
  // 3. an older save with the fields absent entirely — must be deterministic, not inherited
  const c3 = await caseRun({ debt: 145000, free: false, warned: false, latch: false },
                           { debt: 0, free: true, warned: true, latch: true },
                           d => { delete d.jgDebtFree; delete d.jgAltaverdeWarned; delete d.jgBondForeclosureFired; });

  // CONSEQUENCE A — via _jgDebtFree: _checkBondForeclosure returns early when it is true.
  await caseRun({ debt: 145000, free: false, warned: false, latch: false },
                { debt: 0, free: true, warned: true, latch: false });
  makeOverdue();
  const a0 = gameState._complianceLevel || 0; _checkBondForeclosure(); const a1 = gameState._complianceLevel || 0;
  const consequenceA = { route: '_jgDebtFree stale true', owes: gameState._jgDebt,
    contradiction: gameState._jgDebt > 0 && gameState._jgDebtFree === true,
    compliance: `${a0} -> ${a1}`, enforcementFired: a1 > a0 };

  // CONSEQUENCE B — via the latch alone, with _jgDebtFree correct. An independent second route.
  await caseRun({ debt: 145000, free: false, warned: false, latch: false },
                { debt: 145000, free: false, warned: false, latch: true });
  makeOverdue();
  const b0 = gameState._complianceLevel || 0; _checkBondForeclosure(); const b1 = gameState._complianceLevel || 0;
  const consequenceB = { route: '_bondForeclosureFired stale true', owes: gameState._jgDebt,
    jgDebtFreeCorrect: gameState._jgDebtFree === false,
    compliance: `${b0} -> ${b1}`, enforcementFired: b1 > b0 };

  // THE INVARIANT — the same save, loaded from four different prior session states.
  await fresh();
  initJGDebt();
  gameState._jgDebt = 145000; gameState._jgDebtFree = false; gameState._jgAltaverdeWarned = false;
  setLatch(false); saveGame(true);
  const theSave = localStorage.getItem(KEY);
  const seen = [];
  for (const p of [{ f: true, w: true, l: true }, { f: false, w: false, l: false },
                   { f: true, w: false, l: true }, { f: false, w: true, l: false }]) {
    localStorage.setItem(KEY, theSave);
    gameState._jgDebtFree = p.f; gameState._jgAltaverdeWarned = p.w; gameState._jgDebt = p.f ? 0 : 999;
    setLatch(p.l);
    loadGame(); await sleep(700);
    seen.push(JSON.stringify({ free: gameState._jgDebtFree, warned: gameState._jgAltaverdeWarned,
                               debt: gameState._jgDebt, latch: readLatch() }));
  }

  const cases = {
    'case1 save=false session=true  -> expect all false':
      { got: c1, pass: eq(c1, { free: false, warned: false, latch: false }) },
    'case2 save=true  session=false -> expect all true ':
      { got: c2, pass: eq(c2, { free: true, warned: true, latch: true }) },
    'case3 fields ABSENT            -> expect all false':
      { got: c3, pass: eq(c3, { free: false, warned: false, latch: false }) },
  };
  return {
    ...cases,
    consequenceA, consequenceB,
    invariantHolds: new Set(seen).size === 1,
    invariantResult: JSON.parse(seen[0]),
    allCasesPass: Object.values(cases).every(c => c.pass),
  };
};
console.log('loaded — run:  await __DH_ACCEPT()');
