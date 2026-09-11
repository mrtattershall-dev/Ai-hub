// Reference solution (final state of chain r9) - used only to prove checks-D.mjs can pass.
(function () {
  const input = document.getElementById('r9-input');
  const list = document.getElementById('r9-list');
  const count = document.getElementById('r9-count');
  const empty = document.getElementById('r9-empty');
  let items = [];
  let filter = 'all';
  try { items = JSON.parse(localStorage.getItem('r9-items') || '[]'); } catch (e) { items = []; }
  function save() { localStorage.setItem('r9-items', JSON.stringify(items)); }
  function render() {
    list.innerHTML = '';
    items.forEach((it, i) => {
      const li = document.createElement('li');
      if (it.done) li.classList.add('done');
      if ((filter === 'active' && it.done) || (filter === 'done' && !it.done)) li.classList.add('hidden');
      const span = document.createElement('span');
      span.textContent = it.text;
      span.addEventListener('click', () => { it.done = !it.done; save(); render(); });
      const del = document.createElement('button');
      del.className = 'r9-del';
      del.textContent = 'x';
      del.addEventListener('click', () => { items.splice(i, 1); save(); render(); });
      li.append(span, ' ', del);
      list.appendChild(li);
    });
    const left = items.filter((it) => !it.done).length;
    count.textContent = left + (left === 1 ? ' item left' : ' items left');
    empty.style.display = items.length ? 'none' : '';
  }
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const text = input.value.trim();
    input.value = '';
    if (!text) return;
    if (items.some((it) => it.text.toLowerCase() === text.toLowerCase())) return;
    items.push({ text, done: false });
    save();
    render();
  });
  for (const f of ['all', 'active', 'done']) document.getElementById('r9-' + f).addEventListener('click', () => { filter = f; render(); });
  document.getElementById('r9-clear').addEventListener('click', () => { items = items.filter((it) => !it.done); save(); render(); });
  render();
})();
