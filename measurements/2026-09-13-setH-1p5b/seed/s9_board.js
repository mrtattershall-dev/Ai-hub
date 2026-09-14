// CANONICAL REFERENCE - cumulative state after setH goals 9, 19, 29, 39.
//
//   goal  9  add the input's text as <li class="s9-card"> at the END of To Do, then clear the
//            input; blank text adds nothing
//   goal 19  every card gets .s9-right and .s9-left buttons moving it to the END of the next or
//            previous column; right from Done and left from To Do do nothing
//   goal 29  #s9-count-todo / -doing / -done always show just the number of cards in that column
//   goal 39  every card gets a .s9-del button that removes it
//
// HELD OUT and deliberately absent: goal 49 (localStorage under "s9-board") and goal 59 (Doing
// limited to 3 with an #s9-msg element). The seed must not implement or depend on either.
(function () {
  var COLUMNS = ['s9-todo', 's9-doing', 's9-done'];

  function listOf(columnId) {
    return document.querySelector('#' + columnId + ' ul');
  }

  function updateCounts() {
    COLUMNS.forEach(function (id) {
      var label = document.getElementById('s9-count-' + id.replace('s9-', ''));
      if (label) label.textContent = String(listOf(id).querySelectorAll('.s9-card').length);
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
    if (i < 0 || j < 0 || j >= COLUMNS.length) return;   // off either end does nothing
    listOf(COLUMNS[j]).appendChild(card);                // always to the END of the target column
    updateCounts();
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
    });
    li.appendChild(del);

    return li;
  }

  function add() {
    var input = document.getElementById('s9-new');
    var text = input.value.trim();
    if (!text) return;                                   // blank adds nothing
    listOf('s9-todo').appendChild(makeCard(text));
    input.value = '';
    updateCounts();
  }

  document.getElementById('s9-add').addEventListener('click', add);
  updateCounts();
})();
