const { Calendar } = require('./q3_calendar.js');

// Create a calendar instance
const calendar = new Calendar();

// Add some meetings
calendar.add('meeting1', 100, 200);
calendar.add('meeting2', 300, 400);
calendar.add('meeting3', 500, 600);

console.log("Meetings:");
console.log(calendar.list());

// Test freeSlots method
console.log("\nFree slots (0-720, min 50):");
console.log(calendar.freeSlots(0, 720, 50));

console.log("\nFree slots (0-720, min 100):");
console.log(calendar.freeSlots(0, 720, 100));

console.log("\nFree slots (150-550, min 50):");
console.log(calendar.freeSlots(150, 550, 50));

console.log("\nFree slots (0-720, min 200):");
console.log(calendar.freeSlots(0, 720, 200));