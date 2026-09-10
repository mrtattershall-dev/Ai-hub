function _handleTownBuilding(ptx, pty) {
  const checks = [[ptx,pty],[ptx,pty+1],[ptx,pty-1],[ptx+1,pty],[ptx-1,pty],[ptx+2,pty],[ptx-2,pty],[ptx,pty+2]];
  for (const [cx,cy] of checks) {
    if (cy>=MARKET_TY_MIN&&cy<=MARKET_TY_MAX && cx>=MARKET_TX_MIN&&cx<=MARKET_TX_MAX) { openMarket(); setMktTab('buysell'); return true; }
    if (cy>=STORE_TY_MIN&&cy<=STORE_TY_MAX   && cx>=STORE_TX_MIN&&cx<=STORE_TX_MAX)   { openMarket(); setMktTab('buysell'); return true; }
  }
  return false;
}