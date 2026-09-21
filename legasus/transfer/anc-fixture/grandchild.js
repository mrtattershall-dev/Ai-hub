// A-3: spawned by a child that exits immediately afterwards. By the time this loads the
// target, its recorded ppid names a process that no longer exists.
const path = require('node:path');
setTimeout(() => {
  require(path.join(__dirname, 'target.js'));
  console.log(`PASS grandchild loaded (pid ${process.pid}, ppid ${process.ppid})`);
  process.exit(0);
}, 400);
