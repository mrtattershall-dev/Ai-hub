const { Calendar } = require('./q3_calendar.js');

// Create a calendar instance
const calendar = new Calendar();

// Add meetings as in the test
calendar.add('meeting1', 100, 200);
calendar.add('meeting2', 300, 400);
calendar.add('meeting3', 500, 600);

console.log("Meetings:");
calendar.meetings.forEach(m => console.log(`  ${m.id}: ${m.start}-${m.end}`));

console.log("\nTesting firstFree(100, 150):");
console.log("Expected: 400");
console.log("Actual:", calendar.firstFree(100, 150));

// Let's also test what freeSlots returns
console.log("\nFree slots from 150 to 1440 with duration 100:");
const gaps = calendar.freeSlots(150, 1440, 100);
console.log(gaps);