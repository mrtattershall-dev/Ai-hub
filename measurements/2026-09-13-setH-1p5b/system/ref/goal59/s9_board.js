// POSITIVE WITNESS for probe goal59.doinglimit - the canonical seed board plus goal 59 only.
// Used to prove the probe accepts a correct implementation. Never shown to the model.
//
// goal 59: Doing holds at most 3 cards. Moving a 4th in does NOTHING except show "Doing is full"
// in #s9-msg, and the next action that SUCCEEDS empties that message. Goal 49 (persistence) stays
// deliberately absent, and only Doing is capped.
(function () {
  var COLUMNS = ['s9-todo', 's9-doing', 's9-done'];
  var DOING = 's9-doing';
  var LIMIT = 3;

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

  function columnIndexOf(card) {
    for (var i = 0; i < COLUMNS.length; i++) {
      if (listOf(COLUMNS[i]).contains(card)) return i;
    }
    return -1;
  }

  function move(card, delta) {
    var i = columnIndexOf(card);
    var j = i + delta;
    if (i < 0 || j < 0 || j >= COLUMNS.length) return;      // off either end: no action, no message
    if (COLUMNS[j] === DOING && countIn(DOING) >= LIMIT) {
      message('Doing is full');                             // rejected: nothing else changes
      return;
    }
    listOf(COLUMNS[j]).appendChild(card);
    updateCounts();
    message('');                                            // a successful action clears it
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
    });
    li.appendChild(del);

    return li;
  }

  function add() {
    var input = document.getElementById('s9-new');
    var text = input.value.trim();
    if (!text) return;                                      // blank is not a successful action
    listOf('s9-todo').appendChild(makeCard(text));           // To Do is NOT capped
    input.value = '';
    updateCounts();
    message('');
  }

  document.getElementById('s9-add').addEventListener('click', add);
  updateCounts();
})();
