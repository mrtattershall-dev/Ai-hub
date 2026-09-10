// Default Phaser scene shown in the Game tab. It's an immediately-playable proof
// (arrow keys move a box with gravity onto a floor) so the preview shows something
// on first load and confirms Phaser is wired up correctly.
export const PHASER_STARTER = `const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#1d1d2b',
  physics: { default: 'arcade', arcade: { gravity: { y: 600 } } },
  scene: { preload, create, update }
};

let player, cursors;

function preload() {}

function create() {
  this.add.text(16, 16, 'Arrow keys: move + jump', { color: '#ffffff', fontFamily: 'monospace' });

  // floor
  const ground = this.add.rectangle(400, 580, 800, 40, 0x3a3a52);
  this.physics.add.existing(ground, true);

  // player
  player = this.add.rectangle(400, 100, 40, 40, 0x57c7ff);
  this.physics.add.existing(player);
  player.body.setCollideWorldBounds(true);
  this.physics.add.collider(player, ground);

  cursors = this.input.keyboard.createCursorKeys();
}

function update() {
  const speed = 240;
  player.body.setVelocityX(0);
  if (cursors.left.isDown)  player.body.setVelocityX(-speed);
  if (cursors.right.isDown) player.body.setVelocityX(speed);
  if (cursors.up.isDown && player.body.blocked.down) player.body.setVelocityY(-420);
}

new Phaser.Game(config);
`;

// Default PixiJS scene (Pixi v7 synchronous API) — a spinning box, so the preview
// shows something immediately and confirms Pixi loaded.
export const PIXI_STARTER = `const app = new PIXI.Application({
  width: 800,
  height: 600,
  background: '#1d1d2b',
  antialias: true,
});
document.body.appendChild(app.view);

const label = new PIXI.Text('PixiJS — spinning box', {
  fill: '#ffffff', fontFamily: 'monospace', fontSize: 16,
});
label.x = 16; label.y = 16;
app.stage.addChild(label);

const box = new PIXI.Graphics();
box.beginFill(0x57c7ff).drawRoundedRect(-40, -40, 80, 80, 12).endFill();
box.x = 400; box.y = 300;
app.stage.addChild(box);

app.ticker.add((delta) => {
  box.rotation += 0.02 * delta;
});
`;

// Default Three.js scene (UMD global THREE) — a lit, rotating cube, so the preview
// shows something immediately and confirms Three loaded + WebGL works.
export const THREE_STARTER = `const scene = new THREE.Scene();
scene.background = new THREE.Color('#1d1d2b');

const camera = new THREE.PerspectiveCamera(70, 800 / 600, 0.1, 1000);
camera.position.z = 3;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(800, 600);
document.body.appendChild(renderer.domElement);

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0x57c7ff })
);
scene.add(cube);

const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(2, 3, 4);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.4));

function animate() {
  requestAnimationFrame(animate);
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.013;
  renderer.render(scene, camera);
}
animate();
`;
