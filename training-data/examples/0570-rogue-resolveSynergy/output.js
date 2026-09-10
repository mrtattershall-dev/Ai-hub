function resolveSynergy(){
  const p=G.grafts[0], s=G.grafts[1];
  G.synergy=null;
  if(!p||!s) return;
  for(const syn of SYNERGIES){
    if(syn.p===p && syn.s===s){ G.synergy=syn.id; return; }
    // also allow reverse secondary slot
    if(syn.p===s && syn.s===p){ G.synergy=syn.id; return; }
  }
}