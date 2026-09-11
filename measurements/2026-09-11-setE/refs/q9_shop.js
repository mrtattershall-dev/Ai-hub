// Reference solution (final state of chain q9) - used only to prove checks-E.mjs can pass.
(function () {
  const $ = (id) => document.getElementById(id);
  let cart = [];
  let code = '';
  try { cart = JSON.parse(localStorage.getItem('q9-cart') || '[]'); } catch (e) { cart = []; }
  try { code = localStorage.getItem('q9-code') || ''; } catch (e) { code = ''; }
  const save = () => {
    localStorage.setItem('q9-cart', JSON.stringify(cart));
    if (code) localStorage.setItem('q9-code', code); else localStorage.removeItem('q9-code');
  };
  const money = (c) => '$' + (c / 100).toFixed(2);
  const subtotal = () => cart.reduce((a, i) => a + i.price * i.qty, 0);
  const total = () => (code === 'SAVE10' ? Math.round(subtotal() * 0.9) : subtotal());
  function render() {
    const ul = $('q9-cart');
    ul.innerHTML = '';
    for (const it of cart) {
      const li = document.createElement('li');
      const span = document.createElement('span');
      span.textContent = `${it.name} x${it.qty}`;
      const inc = document.createElement('button'); inc.className = 'q9-inc'; inc.textContent = '+';
      inc.addEventListener('click', () => { it.qty++; save(); render(); });
      const dec = document.createElement('button'); dec.className = 'q9-dec'; dec.textContent = '-';
      dec.addEventListener('click', () => { it.qty--; if (it.qty <= 0) cart = cart.filter((x) => x !== it); save(); render(); });
      li.append(span, ' ', inc, ' ', dec);
      ul.appendChild(li);
    }
    const t = total();
    $('q9-total').textContent = money(t);
    const n = cart.reduce((a, i) => a + i.qty, 0);
    $('q9-count').textContent = n + (n === 1 ? ' item' : ' items');
    $('q9-empty').style.display = cart.length ? 'none' : '';
    $('q9-delivery').textContent = t >= 1000 ? 'Free delivery' : `Add ${money(1000 - t)} for free delivery`;
  }
  document.querySelectorAll('.q9-add').forEach((b) => b.addEventListener('click', () => {
    const name = b.dataset.name, price = Number(b.dataset.price);
    const it = cart.find((x) => x.name === name);
    if (it) it.qty++; else cart.push({ name, price, qty: 1 });
    save(); render();
  }));
  function apply() {
    const c = $('q9-code').value.trim();
    if (c === 'SAVE10') { code = c; $('q9-msg').textContent = ''; } else { $('q9-msg').textContent = 'Invalid code'; }
    save(); render();
  }
  $('q9-apply').addEventListener('click', apply);
  $('q9-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(); });
  $('q9-clear').addEventListener('click', () => { cart = []; save(); render(); });
  render();
})();
