function initLayerDemo() {
  return {
    dragging: null, dragY: 0,
    layers: [
      { name: 'Player', color: '#7c6bff', correct: 2 },
      { name: 'Background', color: '#333344', correct: 0 },
      { name: 'UI', color: '#3dd68c', correct: 3 },
      { name: 'Enemies', color: '#ff5a5a', correct: 1 }
    ],
    won: false, checked: false, feedback: ''
  };
}