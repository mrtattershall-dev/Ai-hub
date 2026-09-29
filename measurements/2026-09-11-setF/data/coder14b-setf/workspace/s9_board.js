// Initialize counters
let countTodo = 0;
let countDoing = 0;
let countDone = 0;

// Function to update counters
function updateCounters() {
  countTodo = document.querySelectorAll('#todo .card').length;
  countDoing = document.querySelectorAll('#doing .card').length;
  countDone = document.querySelectorAll('#done .card').length;

  document.getElementById('s9-count-todo').textContent = countTodo;
  document.getElementById('s9-count-doing').textContent = countDoing;
  document.getElementById('s9-count-done').textContent = countDone;
}

// Call updateCounters on page load
window.onload = updateCounters;

// Add event listeners to update counters when cards are moved
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('todo').addEventListener('dragend', updateCounters);
  document.getElementById('doing').addEventListener('dragend', updateCounters);
  document.getElementById('done').addEventListener('dragend', updateCounters);
  document.getElementById('todo').addEventListener('click', removeCard);
  document.getElementById('doing').addEventListener('click', removeCard);
  document.getElementById('done').addEventListener('click', removeCard);
});
document.addEventListener('DOMContentLoaded', function() {
  const todoList = document.querySelector('#todo ul');
  const doingList = document.querySelector('#s9-doing ul');
  const doneList = document.querySelector('#s9-done ul');

  function removeCard(event) {
    if (event.target.classList.contains('s9-del')) {
      const card = event.target.closest('.card');
      card.remove();
    }
  }

  todoList.addEventListener('click', removeCard);
  doingList.addEventListener('click', removeCard);
  doneList.addEventListener('click', removeCard);
});
document.addEventListener('DOMContentLoaded', function() {
  const todoList = document.querySelector('#todo ul');
  const doingList = document.querySelector('#s9-doing ul');
  const doneList = document.querySelector('#s9-done ul');

  function removeCard(event) {
    if (event.target.classList.contains('s9-del')) {
      const card = event.target.closest('.card');
      card.remove();
    }
  }

  todoList.addEventListener('click', removeCard);
  doingList.addEventListener('click', removeCard);
  doneList.addEventListener('click', removeCard);
});
function saveCards() {
  const todoCards = Array.from(document.querySelectorAll('#todo .card')).map(card => card.outerHTML);
  const doingCards = Array.from(document.querySelectorAll('#s9-doing .card')).map(card => card.outerHTML);
  const doneCards = Array.from(document.querySelectorAll('#s9-done .card')).map(card => card.outerHTML);
  localStorage.setItem('s9-board', JSON.stringify({ todo: todoCards, doing: doingCards, done: doneCards }));
}
function loadCards() {
  const savedData = localStorage.getItem('s9-board');
  if (savedData) {
    const { todo, doing, done } = JSON.parse(savedData);
    const todoList = document.querySelector('#todo ul');
    const doingList = document.querySelector('#s9-doing ul');
    const doneList = document.querySelector('#s9-done ul');
    todo.forEach(card => todoList.innerHTML += card);
    doing.forEach(card => doingList.innerHTML += card);
    done.forEach(card => doneList.innerHTML += card);
  }
}
document.addEventListener('DOMContentLoaded', function() {
  loadCards();
});
document.getElementById('s9-filter').addEventListener('input', function() {
    const filterText = this.value.toLowerCase();
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        const cardText = card.textContent.toLowerCase();
        if (cardText.includes(filterText)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
});
function cardExists(text) {
  const cards = document.querySelectorAll('.card');
  for (let card of cards) {
    if (card.textContent.trim().toLowerCase() === text.trim().toLowerCase()) {
      return true;
    }
  }
  return false;
}
document.getElementById('s9-clear-done').addEventListener('click', function() {
    const doneSection = document.getElementById('done');
    while (doneSection.firstChild) {
        doneSection.removeChild(doneSection.firstChild);
    }
    saveBoardState();
});
