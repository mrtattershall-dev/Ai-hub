const { Calendar } = require('./q3_calendar.js');

// Create a calendar instance
const calendar = new Calendar();

console.log("Testing firstFree method:");

// Test 1: Empty calendar
console.log("\nTest 1: Empty calendar, duration=60, after=0");
console.log("Expected: 0");
console.log("Actual: " + calendar.firstFree(60, 0));

// Test 2: Calendar with meetings
calendar.add('meeting1', 100, 200);
calendar.add('meeting2', 300, 400);
calendar.add('meeting3', 500, 600);

console.log("\nTest 2: Calendar with meetings, duration=50, after=0");
console.log("Expected: 0 (before first meeting)");
console.log("Actual: " + calendar.firstFree(50, 0));

console.log("\nTest 3: Calendar with meetings, duration=50, after=150");
console.log("Expected: 200 (after first meeting)");
console.log("Actual: " + calendar.firstFree(50, 150));

console.log("\nTest 4: Calendar with meetings, duration=100, after=150");
console.log("Expected: 400 (after second meeting)");
console.log("Actual: " + calendar.firstFree(100, 150));

console.log("\nTest 5: Calendar with meetings, duration=200, after=150");
console.log("Expected: null (no slot large enough)");
console.log("Actual: " + calendar.firstFree(200, 150));

console.log("\nTest 6: Calendar with meetings, duration=0, after=100");
console.log("Expected: 100 (zero duration)");
console.log("Actual: " + calendar.firstFree(0, 100));

console.log("\nTest 7: Calendar with meetings, duration=50, after=550");
console.log("Expected: 600 (at end of day)");
console.log("Actual: " + calendar.firstFree(50, 550));

console.log("\nTest 8: Calendar with meetings, duration=50, after=600");
console.log("Expected: null (no slot after after time)");
console.log("Actual: " + calendar.firstFree(50, 600));