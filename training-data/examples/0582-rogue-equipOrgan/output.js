function equipOrgan(id){
  const o=ORGANS[id]; if(!o) return;
  // Fill empty slot first; if both full replace primary
  if(!G.grafts[0]){
    G.grafts[0]=id; G.graftDecay[0]=o.decay;
  } else if(!G.grafts[1]){
    G.grafts[1]=id; G.graftDecay[1]=o.decay;
  } else {
    // Both full — replace whichever has LESS time left
    const replaceIdx = G.graftDecay[0]<=G.graftDecay[1] ? 0 : 1;
    G.grafts[replaceIdx]=id; G.graftDecay[replaceIdx]=o.decay;
  }
  boom(G.px,G.py,25,o.col||C.rouge,{settles:false,spd:200});
  resolveSynergy();
  updateSynergyHUD();
}