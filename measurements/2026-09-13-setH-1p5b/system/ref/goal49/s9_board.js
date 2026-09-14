// POSITIVE WITNESS for probe goal49.persistence - the canonical seed board plus goal 49 only.
// Used to prove the probe accepts a correct implementation. Never shown to the model.
//
// goal 49: save the cards in localStorage under the key "s9-board", so reloading shows the same
// cards in the same columns and order. Goal 59 (Doing limit) stays deliberately absent.
(function () {
  var COLUMNS = ['s9-todo', 's9-doing', 's9-done'];
  var KEY = 's9-board';

  function listOf(columnId) {
    return document.querySelector('#' + columnId + ' ul');
  }

  function updateCounts() {
    COLUMNS.forEach(function (id) {
      var label = document.getElementById('s9-count-' + id.replace('s9-', ''));
      if (label) label.textContent = String(listOf(id).querySelectorAll('.s9-card').length);
    });
  }

  function labelOf(card) {
    var span = card.querySelector('span');
    return span ? span.textContent : '';
  }

  function save() {
    var state = COLUMNS.map(function (id) {
      return [].slice.call(listOf(id).querySelectorAll('.s9-card')).map(labelOf);
    });
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  function columnIndexOf(card) {
    for (var i = 0; i < COLUMNS.length; i++) {
      if (listOf(COLUMNS[i]).contains(card)) return i;
    }
    return -1;
  }

  function move(card, delta) {
    var i = columnIndexOf(card);
    var j = i + delta;
    if (i < 0 || j < 0 || j >= COLUMNS.length) return;
    listOf(COLUMNS[j]).appendChild(card);
    updateCounts();
    save();
  }

  function makeCard(text) {
    var li = document.createElement('li');
    li.className = 's9-card';

    var label = document.createElement('span');
    label.textContent = text;
    li.appendChild(label);

    var left = document.createElement('button');
    left.className = 's9-left';
    left.textContent = '<';
    left.addEventListener('click', function () { move(li, -1); });
    li.appendChild(left);

    var right = document.createElement('button');
    right.className = 's9-right';
    right.textContent = '>';
    right.addEventListener('click', function () { move(li, 1); });
    li.appendChild(right);

    var del = document.createElement('button');
    del.className = 's9-del';
    del.textContent = 'x';
    del.addEventListener('click', function () {
      if (li.parentNode) li.parentNode.removeChild(li);
      updateCounts();
      save();
    });
    li.appendChild(del);

    return li;
  }

  function add() {
    var input = document.getElementById('s9-new');
    var text = input.value.trim();
    if (!text) return;
    listOf('s9-todo').appendChild(makeCard(text));
    input.value = '';
    updateCounts();
    save();
  }

  function restore() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { return; }
    if (!raw) return;
    var state;
    try { state = JSON.parse(raw); } catch (e) { return; }
    if (!Array.isArray(state)) return;
    state.forEach(function (labels, i) {
      if (!Array.isArray(labels) || !COLUMNS[i]) return;
      labels.forEach(function (text) { listOf(COLUMNS[i]).appendChild(makeCard(text)); });
    });
  }

  document.getElementById('s9-add').addEventListener('click', add);
  restore();
  updateCounts();
})();
