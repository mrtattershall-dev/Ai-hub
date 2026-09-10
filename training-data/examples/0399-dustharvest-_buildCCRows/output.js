function _buildCCRows() {
  const d = window._ccDraft;

  // Skin swatches
  const skinRow = document.getElementById('ccSkinRow');
  if (skinRow) {
    skinRow.innerHTML = CC_SKIN_TONES.map((ramp,i) =>
      `<div class="cc-swatch" id="ccs-skin-${i}" style="background:${ramp[1]}" onclick="ccSet('skinTone',${i})" title="Tone ${i+1}"></div>`
    ).join('');
  }

  // Hair styles
  const styles = d.gender === 'female' ? CC_HAIR_STYLES_FEMALE : CC_HAIR_STYLES_MALE;
  const hsRow = document.getElementById('ccHairStyleRow');
  if (hsRow) {
    hsRow.innerHTML = styles.map((name,i) =>
      `<button class="cc-tag" id="ccs-hs-${i}" onclick="ccSet('hairStyle',${i})">${name}</button>`
    ).join('');
  }

  // Hair colours
  const hcRow = document.getElementById('ccHairColorRow');
  if (hcRow) {
    hcRow.innerHTML = CC_HAIR_COLORS.map((ramp,i) =>
      `<div class="cc-swatch" id="ccs-hc-${i}" style="background:${ramp[1]};margin:2px" onclick="ccSet('hairColor',${i})"></div>`
    ).join('');
  }

  // Shirt styles
  const sstyles = d.gender === 'female' ? CC_SHIRT_STYLES_FEMALE : CC_SHIRT_STYLES_MALE;
  const ssRow = document.getElementById('ccShirtStyleRow');
  if (ssRow) {
    ssRow.innerHTML = sstyles.map((name,i) =>
      `<button class="cc-tag" id="ccs-ss-${i}" onclick="ccSet('shirtStyle',${i})">${name}</button>`
    ).join('');
  }

  // Shirt colours
  const scRow = document.getElementById('ccShirtColorRow');
  if (scRow) {
    scRow.innerHTML = CC_SHIRT_COLORS.map((ramp,i) =>
      `<div class="cc-swatch" id="ccs-sc-${i}" style="background:${ramp[1]};margin:2px" onclick="ccSet('shirtColor',${i})"></div>`
    ).join('');
  }

  // Pants colours
  const pcRow = document.getElementById('ccPantsColorRow');
  if (pcRow) {
    pcRow.innerHTML = CC_PANTS_COLORS.map((ramp,i) =>
      `<div class="cc-swatch" id="ccs-pc-${i}" style="background:${ramp[1]};margin:2px" onclick="ccSet('pantsColor',${i})"></div>`
    ).join('');
  }

  // Hat colours
  const hatRow = document.getElementById('ccHatColorRow');
  if (hatRow) {
    hatRow.innerHTML = CC_HAT_COLORS.map((ramp,i) =>
      ramp === null
        ? `<div class="cc-swatch" id="ccs-hat-${i}" style="background:#222;color:#888;font-size:10px;display:flex;align-items:center;justify-content:center;margin:2px" onclick="ccSet('hatColor',${i})">✕</div>`
        : `<div class="cc-swatch" id="ccs-hat-${i}" style="background:${ramp[1]};margin:2px" onclick="ccSet('hatColor',${i})"></div>`
    ).join('');
  }
}