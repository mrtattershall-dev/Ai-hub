// 入口：初始化、固定步长的游戏循环、窗口自适应。

import { Game } from './game.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);

game.renderer.resize();
window.addEventListener('resize', () => game.renderer.resize());

// 首次点击 / 按键才能启动音频（浏览器策略）
const unlockAudio = () => game.audio.ensure();
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

// 固定步长累加器：保证物理与手感不受帧率波动影响
const STEP = 1 / 60;
let acc = 0;
let last = performance.now();

function frame(now) {
  let delta = (now - last) / 1000;
  last = now;
  // 切标签页回来时不要一次性补上几十秒
  if (delta > 0.25) delta = 0.25;
  acc += delta;

  let steps = 0;
  while (acc >= STEP && steps < 5) {
    game.update(STEP);
    acc -= STEP;
    steps++;
  }
  game.draw(STEP);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 调试用
window.game = game;
