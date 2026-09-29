const { Calendar } = require('./q3_calendar.js');

// Create a test calendar
const calendar = new Calendar();

// Add some test meetings that don't overlap
calendar.add('meeting1', 10, 30);
calendar.add('meeting2', 40, 60);
calendar.add('meeting3', 70, 90);
calendar.add('meeting4', 100, 120);
calendar.add('meeting5', 130, 150);

console.log("All meetings:");
console.log(calendar.list());

console.log("\nConflicts with range [20, 40]:");
console.log(calendar.conflicts(20, 40));

console.log("\nConflicts with range [55, 75]:");
console.log(calendar.conflicts(55, 75));

console.log("\nConflicts with range [80, 90]:");
console.log(calendar.conflicts(80, 90));

console.log("\nConflicts with range [0, 5]:");
console.log(calendar.conflicts(0, 5));

console.log("\nConflicts with range [100, 110]:");
console.log(calendar.conflicts(100, 110));

// Test overlap detection
console.log("\nTesting overlap detection:");
try {
  calendar.add('meeting6', 20, 35); // This should overlap with meeting1 (10-30)
  console.log("ERROR: Should have thrown an overlap error");
} catch (e) {
  console.log("SUCCESS: Overlap error caught - " + e.message);
}

try {
  calendar.add('meeting7', 50, 75); // This should overlap with meeting2 (40-60)
  console.log("ERROR: Should have thrown an overlap error");
} catch (e) {
  console.log("SUCCESS: Overlap error caught - " + e.message);
}

// Test that adding a non-overlapping meeting still works
try {
  calendar.add('meeting8', 160, 180); // This should not overlap
  console.log("SUCCESS: Non-overlapping meeting added");
  console.log("All meetings after adding non-overlapping meeting:");
  console.log(calendar.list());
} catch (e) {
  console.log("ERROR: Non-overlapping meeting should have been added - " + e.message);
}
// Test remove method
console.log("\nTesting remove method:");
console.log("Removing meeting1:");
console.log("Result:", calendar.remove('meeting1'));

console.log("All meetings after removing meeting1:");
console.log(calendar.list());

console.log("Removing non-existent meeting:");
console.log("Result:", calendar.remove('nonexistent'));

console.log("All meetings after trying to remove non-existent meeting:");
console.log(calendar.list());

// Test that get returns null for removed meeting
console.log("Getting removed meeting1:");
console.log("Result:", calendar.get('meeting1'));

// Test that get returns meeting2
console.log("Getting meeting2:");
console.log("Result:", calendar.get('meeting2'));
console.log("\nTesting move method:");

// Test valid move
try {
  console.log("Moving meeting2 to start at 200:");
  calendar.move('meeting2', 200);
  console.log("SUCCESS: Meeting moved");
  console.log("All meetings after move:");
  console.log(calendar.list());
} catch (e) {
  console.log("ERROR: Valid move failed - " + e.message);
}

// Test move with unknown ID
try {
  console.log("Moving unknown meeting:");
  calendar.move('unknown', 100);
  console.log("ERROR: Should have thrown an error for unknown ID");
} catch (e) {
  console.log("SUCCESS: Unknown ID error caught - " + e.message);
}

// Test move with out-of-range start
try {
  console.log("Moving meeting3 to out-of-range start:");
  calendar.move('meeting3', 1500);
  console.log("ERROR: Should have thrown an error for out-of-range start");
} catch (e) {
  console.log("SUCCESS: Out-of-range error caught - " + e.message);
}

// Test move that creates overlap
try {
  console.log("Moving meeting4 to overlap with meeting3:");
  calendar.move('meeting4', 80);
  console.log("ERROR: Should have thrown an overlap error");
} catch (e) {
  console.log("SUCCESS: Overlap error caught - " + e.message);
}

// Test move that keeps duration and doesn't change other meetings
try {
  console.log("Moving meeting5 to start at 180 (should keep duration):");
  calendar.move('meeting5', 180);
  console.log("SUCCESS: Meeting moved with correct duration");
  console.log("All meetings after move:");
  console.log(calendar.list());
} catch (e) {
  console.log("ERROR: Duration preservation failed - " + e.message);
}
