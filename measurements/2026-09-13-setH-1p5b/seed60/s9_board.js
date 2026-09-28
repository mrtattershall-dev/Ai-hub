// CANONICAL REFERENCE - cumulative state after setH goals 9, 19, 29, 39, 49, 59.
// Goals 61+ are HELD OUT and deliberately absent.
//
//   goal  9  add the input text as <li class="s9-card"> at the END of To Do, clear the input;
//            blank adds nothing
//   goal 19  .s9-right / .s9-left move a card to the END of the next/previous column; off either
//            end does nothing
//   goal 29  #s9-count-todo / -doing / -done always show the number of cards in that column
//   goal 39  .s9-del removes the card
//   goal 49  cards are saved in localStorage under "s9-board"; a reload shows the same cards in the
//            same columns and order
//   goal 59  Doing holds at most 3; moving a 4th in does NOTHING except show "Doing is full" in
//            #s9-msg, and the next action that SUCCEEDS empties that message
//
// CROSS-GOAL NOTE - 49 and 59 interact, and this is the invariant that two independently correct
// per-goal implementations would miss:
//
//     A REJECTED OPERATION MUST NOT BECOME PERSISTED STATE.
//
// So save() is called only on paths that actually changed the board. A rejected move shows the
// message and returns without saving, which means a reload after a rejected move restores the board
// as it was BEFORE the rejected attempt - not some half-applied version of it.
(function () {
  var COLUMNS = ['s9-todo', 's9-doing', 's9-done'];
  var DOING = 's9-doing';
  var LIMIT = 3;
  var KEY = 's9-board';

  function listOf(columnId) {
    return document.querySelector('#' + columnId + ' ul');
  }

  function countIn(columnId) {
    return listOf(columnId).querySelectorAll('.s9-card').length;
  }

  function message(text) {
    var el = document.getElementById('s9-msg');
    if (el) el.textContent = text;
  }

  function updateCounts() {
    COLUMNS.forEach(function (id) {
      var label = document.getElementById('s9-count-' + id.replace('s9-', ''));
      if (label) label.textContent = String(countIn(id));
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
    if (i < 0 || j < 0 || j >= COLUMNS.length) return;    // off either end: not an action at all
    if (COLUMNS[j] === DOING && countIn(DOING) >= LIMIT) {
      message('Doing is full');
      return;                                             // REJECTED - no move, and NO SAVE
    }
    listOf(COLUMNS[j]).appendChild(card);
    updateCounts();
    message('');
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
      message('');
      save();
    });
    li.appendChild(del);

    return li;
  }

  function add() {
    var input = document.getElementById('s9-new');
    var text = input.value.trim();
    if (!text) return;                                    // blank is not a successful action
    listOf('s9-todo').appendChild(makeCard(text));          // To Do is NOT capped
    input.value = '';
    updateCounts();
    message('');
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
