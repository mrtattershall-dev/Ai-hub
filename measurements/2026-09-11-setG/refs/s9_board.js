// Reference solution (final state of chain s9) - used only to prove checks-F.mjs can pass.
const COLS = ['todo', 'doing', 'done'];
let board = { todo: [], doing: [], done: [] };
try {
  const saved = JSON.parse(localStorage.getItem('s9-board'));
  if (saved && COLS.every((c) => Array.isArray(saved[c]))) board = saved;
} catch (e) { /* start empty */ }

const $ = (id) => document.getElementById(id);
const msg = (t) => { $('s9-msg').textContent = t; };
const save = () => localStorage.setItem('s9-board', JSON.stringify(board));

function render() {
  const f = ($('s9-filter').value || '').toLowerCase();
  for (const c of COLS) {
    const ul = $('s9-' + c).querySelector('ul');
    ul.innerHTML = '';
    board[c].forEach((text, i) => {
      const li = document.createElement('li');
      li.className = 's9-card';
      const span = document.createElement('span');
      span.textContent = text;
      li.appendChild(span);
      for (const [cls, label, fn] of [['s9-left', '<', () => move(c, i, -1)], ['s9-right', '>', () => move(c, i, 1)], ['s9-del', 'x', () => del(c, i)]]) {
        const b = document.createElement('button');
        b.className = cls;
        b.textContent = label;
        b.addEventListener('click', fn);
        li.appendChild(b);
      }
      if (f && !text.toLowerCase().includes(f)) li.style.display = 'none';
      ul.appendChild(li);
    });
    $('s9-count-' + c).textContent = String(board[c].length);
  }
}

function add() {
  const text = $('s9-new').value.trim();
  if (!text) return;
  if (COLS.some((c) => board[c].some((t) => t.trim().toLowerCase() === text.toLowerCase()))) { msg('Card already exists'); return; }
  board.todo.push(text);
  $('s9-new').value = '';
  msg('');
  save();
  render();
}

function move(c, i, d) {
  const to = COLS[COLS.indexOf(c) + d];
  if (!to) return;
  if (to === 'doing' && board.doing.length >= 3) { msg('Doing is full'); return; }
  const [card] = board[c].splice(i, 1);
  board[to].push(card);
  msg('');
  save();
  render();
}

function del(c, i) {
  board[c].splice(i, 1);
  msg('');
  save();
  render();
}

$('s9-add').addEventListener('click', add);
$('s9-new').addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
$('s9-filter').addEventListener('input', render);
$('s9-clear-done').addEventListener('click', () => { board.done = []; msg(''); save(); render(); });
render();
