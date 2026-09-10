function _updateCCSelections() {
  const d = window._ccDraft;

  // Gender buttons
  ['male','female'].forEach(g => {
    const btn = document.getElementById('ccg-'+g);
    if (btn) btn.classList.toggle('sel', d.gender===g);
  });
  // Skin
  for (let i=0;i<CC_SKIN_TONES.length;i++) {
    const el = document.getElementById('ccs-skin-'+i);
    if (el) el.classList.toggle('sel', d.skinTone===i);
  }
  // Hair style
  const hsCount = (d.gender==='female'?CC_HAIR_STYLES_FEMALE:CC_HAIR_STYLES_MALE).length;
  for (let i=0;i<hsCount;i++) {
    const el = document.getElementById('ccs-hs-'+i);
    if (el) el.classList.toggle('sel', d.hairStyle===i);
  }
  // Hair colour
  for (let i=0;i<CC_HAIR_COLORS.length;i++) {
    const el = document.getElementById('ccs-hc-'+i);
    if (el) el.classList.toggle('sel', d.hairColor===i);
  }
  // Shirt style
  const ssCount = (d.gender==='female'?CC_SHIRT_STYLES_FEMALE:CC_SHIRT_STYLES_MALE).length;
  for (let i=0;i<ssCount;i++) {
    const el = document.getElementById('ccs-ss-'+i);
    if (el) el.classList.toggle('sel', d.shirtStyle===i);
  }
  // Shirt colour
  for (let i=0;i<CC_SHIRT_COLORS.length;i++) {
    const el = document.getElementById('ccs-sc-'+i);
    if (el) el.classList.toggle('sel', d.shirtColor===i);
  }
  // Pants
  for (let i=0;i<CC_PANTS_COLORS.length;i++) {
    const el = document.getElementById('ccs-pc-'+i);
    if (el) el.classList.toggle('sel', d.pantsColor===i);
  }
  // Hat
  for (let i=0;i<CC_HAT_COLORS.length;i++) {
    const el = document.getElementById('ccs-hat-'+i);
    if (el) el.classList.toggle('sel', d.hatColor===i);
  }
}