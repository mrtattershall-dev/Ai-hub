// 以撒《Rebirth》GBA 风格调色板：暖黑描边、脏兮兮的肉色与土色、
// 高饱和的血红与眼泪蓝作为唯一的强对比色。
export const PAL = {
  ink: '#1a0d0a',        // 统一描边色（暖黑，不用纯黑）
  inkSoft: '#2b1a12',

  // 皮肤 / 肉
  skin: '#f0d2a8',
  skinLit: '#fff0d4',
  skinDark: '#cfa87c',
  flesh: '#e8a2a2',
  fleshLit: '#f7c8c8',
  fleshDark: '#b46b6b',

  // 血
  blood: '#b21f24',
  bloodLit: '#e04a45',
  bloodDark: '#6d0f14',

  // 眼泪
  tear: '#cdeeff',
  tearLit: '#ffffff',
  tearDark: '#74b6e0',

  // 地下室地形
  floor: '#8a6a49',
  floorLit: '#9d7c58',
  floorDark: '#71563a',
  wall: '#5a412c',
  wallLit: '#6f533a',
  wallDark: '#3d2b1c',

  // 石头
  rock: '#8d8f86',
  rockLit: '#adaea4',
  rockDark: '#5f6159',

  // 便便
  poop: '#8a6034',
  poopLit: '#a87944',
  poopDark: '#5d3f21',

  // 金属 / 门
  metal: '#9aa0a8',
  metalLit: '#c3c8ce',
  metalDark: '#5c626a',
  gold: '#e8c04a',
  goldLit: '#ffe694',
  goldDark: '#9c7a18',

  // 特殊房
  devil: '#7d1f2b',
  angel: '#f2eecb',
  shadow: 'rgba(0,0,0,0.32)',

  // 虫子
  fly: '#2f2f33',
  flyLit: '#55555c',
  wing: '#d8e6f0',

  white: '#ffffff',
  black: '#000000',
};

/** 关卡章节配色：不同层换一套地面 / 墙面色 */
export const CHAPTERS = [
  {
    name: '地下室', sub: 'BASEMENT',
    floor: '#8a6a49', floorLit: '#9d7c58', floorDark: '#71563a',
    wall: '#5a412c', wallLit: '#6f533a', wallDark: '#3d2b1c',
  },
  {
    name: '洞窟', sub: 'CAVES',
    floor: '#7d6b52', floorLit: '#948062', floorDark: '#5f513d',
    wall: '#4b3f31', wallLit: '#5f5140', wallDark: '#2f2721',
  },
  {
    name: '深渊', sub: 'DEPTHS',
    floor: '#5f5f68', floorLit: '#74747e', floorDark: '#494952',
    wall: '#3b3b44', wallLit: '#4c4c57', wallDark: '#26262d',
  },
  {
    name: '子宫', sub: 'WOMB',
    floor: '#8e3138', floorLit: '#a8434a', floorDark: '#6d2229',
    wall: '#5f1d24', wallLit: '#77272f', wallDark: '#3e1116',
  },
];
