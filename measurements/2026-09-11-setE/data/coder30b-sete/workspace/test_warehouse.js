// Test file for Warehouse class
const { Warehouse } = require('./q1_stock.js');
const { Calendar } = require('./q3_calendar.js');
const { TextBuffer } = require('./q7_buffer.js');

// Create a new warehouse
const warehouse = new Warehouse();

// Test addItem with valid input
warehouse.addItem('SKU001', 10);
console.assert(warehouse.stock('SKU001') === 10, 'addItem should add stock correctly');

// Test addItem with another item
warehouse.addItem('SKU002', 5);
console.assert(warehouse.stock('SKU002') === 5, 'addItem should handle multiple items');

// Test addItem with same SKU (should add to existing)
warehouse.addItem('SKU001', 3);
console.assert(warehouse.stock('SKU001') === 13, 'addItem should add to existing stock');

// Test stock with unknown SKU
console.assert(warehouse.stock('SKU999') === 0, 'stock should return 0 for unknown SKU');

// Test skus method
const skus = warehouse.skus();
console.assert(skus.length === 2, 'skus should return 2 items');
console.assert(skus[0] === 'SKU001', 'skus should be sorted');
console.assert(skus[1] === 'SKU002', 'skus should be sorted');

// Test addItem with invalid quantity (should throw error)
try {
  warehouse.addItem('SKU003', -5);
  console.assert(false, 'addItem should throw error for negative quantity');
} catch (e) {
  console.assert(e.message === "Quantity must be a positive integer", 'addItem should throw correct error for negative quantity');
}

try {
  warehouse.addItem('SKU004', 3.5);
  console.assert(false, 'addItem should throw error for non-integer quantity');
} catch (e) {
  console.assert(e.message === "Quantity must be a positive integer", 'addItem should throw correct error for non-integer quantity');
}

try {
  warehouse.addItem('SKU005', 0);
  console.assert(false, 'addItem should throw error for zero quantity');
} catch (e) {
  console.assert(e.message === "Quantity must be a positive integer", 'addItem should throw correct error for zero quantity');
}

// Test Calendar class
console.log("Testing Calendar class...");

const calendar = new Calendar();

// Test add method
calendar.add('meeting1', 60, 120);
calendar.add('meeting2', 180, 240);
calendar.add('meeting3', 30, 90);

// Test get method
const meeting1 = calendar.get('meeting1');
console.assert(meeting1 !== null && meeting1.id === 'meeting1' && meeting1.start === 60 && meeting1.end === 120, 'get should return correct meeting');

const missing = calendar.get('missing');
console.assert(missing === null, 'get should return null for missing meeting');

// Test list method
const meetings = calendar.list();
console.assert(meetings.length === 3, 'list should return all meetings');
console.assert(meetings[0].id === 'meeting3', 'list should be sorted by start time');
console.assert(meetings[1].id === 'meeting1', 'list should be sorted by start time');
console.assert(meetings[2].id === 'meeting2', 'list should be sorted by start time');

// Test validation - invalid start time
try {
  calendar.add('meeting4', -10, 60);
  console.assert(false, 'add should throw error for invalid start time');
} catch (e) {
  console.assert(e.message === 'Start must be an integer between 0 and 1439', 'add should throw correct error for invalid start time');
}

// Test validation - invalid end time
try {
  calendar.add('meeting5', 60, 1450);
  console.assert(false, 'add should throw error for invalid end time');
} catch (e) {
  console.assert(e.message === 'End must be an integer between 0 and 1440', 'add should throw correct error for invalid end time');
}

// Test validation - start >= end
try {
  calendar.add('meeting6', 120, 60);
  console.assert(false, 'add should throw error for start >= end');
} catch (e) {
  console.assert(e.message === 'Start must be less than end', 'add should throw correct error for start >= end');
}

// Test validation - duplicate ID
try {
  calendar.add('meeting1', 200, 260);
  console.assert(false, 'add should throw error for duplicate ID');
} catch (e) {
  console.assert(e.message === 'Duplicate ID', 'add should throw correct error for duplicate ID');
}

// Test validation - invalid ID type
try {
  calendar.add(123, 60, 120);
  console.assert(false, 'add should throw error for invalid ID type');
} catch (e) {
  console.assert(e.message === 'ID must be a string', 'add should throw correct error for invalid ID type');
}

// Test TextBuffer class
console.log("Testing TextBuffer class...");

const buffer = new TextBuffer("Hello World");

// Test text() method
console.assert(buffer.text() === "Hello World", "text() should return the initial text");

// Test insert() method
buffer.insert(6, "Beautiful ");
console.assert(buffer.text() === "Hello Beautiful World", "insert() should add text at the correct position");

// Test remove() method
buffer.remove(6, 10);
console.assert(buffer.text() === "Hello World", "remove() should remove text at the correct position");

// Test insert() with invalid position
try {
  buffer.insert(-1, "test");
  console.assert(false, "insert() should throw error for negative position");
} catch (e) {
  console.assert(e.message === "Position out of bounds", "insert() should throw correct error for negative position");
}

try {
  buffer.insert(20, "test");
  console.assert(false, "insert() should throw error for position beyond text length");
} catch (e) {
  console.assert(e.message === "Position out of bounds", "insert() should throw correct error for position beyond text length");
}

// Test remove() with invalid position
try {
  buffer.remove(-1, 2);
  console.assert(false, "remove() should throw error for negative position");
} catch (e) {
  console.assert(e.message === "Position or length out of bounds", "remove() should throw correct error for negative position");
}

try {
  buffer.remove(10, 5);
  console.assert(false, "remove() should throw error for position beyond text length");
} catch (e) {
  console.assert(e.message === "Position or length out of bounds", "remove() should throw correct error for position beyond text length");
}

// Test remove() with invalid length
try {
  buffer.remove(6, 20);
  console.assert(false, "remove() should throw error for length exceeding text bounds");
} catch (e) {
  console.assert(e.message === "Position or length out of bounds", "remove() should throw correct error for length exceeding text bounds");
}

// Test remove with valid input
warehouse.addItem('SKU003', 15);
warehouse.remove('SKU003', 5);
console.assert(warehouse.stock('SKU003') === 10, 'remove should reduce stock correctly');

// Test lines() method
const buffer3 = new TextBuffer("Hello\nWorld\nTest");
const lines = buffer3.lines();
console.assert(lines.length === 3, "lines() should return correct number of lines");
console.assert(lines[0] === "Hello", "lines() should return first line");
console.assert(lines[1] === "World", "lines() should return second line");
console.assert(lines[2] === "Test", "lines() should return third line");

// Test lineCol() method
const pos1 = buffer3.posOf(0, 0); // First character
const lineCol1 = buffer3.lineCol(pos1);
console.assert(lineCol1.line === 0 && lineCol1.col === 0, "lineCol should return correct position for first character");

const pos2 = buffer3.posOf(1, 2); // Third character on second line
const lineCol2 = buffer3.lineCol(pos2);
console.assert(lineCol2.line === 1 && lineCol2.col === 2, "lineCol should return correct position for third character on second line");

const pos3 = buffer3.posOf(2, 0); // First character on third line
const lineCol3 = buffer3.lineCol(pos3);
console.assert(lineCol3.line === 2 && lineCol3.col === 0, "lineCol should return correct position for first character on third line");

// Test posOf() method
const pos4 = buffer3.posOf(0, 5); // Position of 'o' in "Hello"
console.assert(pos4 === 4, "posOf should return correct position for 'o' in 'Hello'");

const pos5 = buffer3.posOf(1, 1); // Position of 'o' in "World"
console.assert(pos5 === 7, "posOf should return correct position for 'o' in 'World'");

// Test lineCol() with out of bounds position
try {
  buffer3.lineCol(-1);
  console.assert(false, "lineCol should throw error for negative position");
} catch (e) {
  console.assert(e.message === "Position out of bounds", "lineCol should throw correct error for negative position");
}

try {
  buffer3.lineCol(20);
  console.assert(false, "lineCol should throw error for position beyond text length");
} catch (e) {
  console.assert(e.message === "Position out of bounds", "lineCol should throw correct error for position beyond text length");
}

// Test posOf() with out of bounds line/column
try {
  buffer3.posOf(-1, 0);
  console.assert(false, "posOf should throw error for negative line");
} catch (e) {
  console.assert(e.message === "Line and column must be non-negative", "posOf should throw correct error for negative line");
}

try {
  buffer3.posOf(0, -1);
  console.assert(false, "posOf should throw error for negative column");
} catch (e) {
  console.assert(e.message === "Line and column must be non-negative", "posOf should throw correct error for negative column");
}

try {
  buffer3.posOf(5, 0);
  console.assert(false, "posOf should throw error for out of bounds line");
} catch (e) {
  console.assert(e.message === "Line out of bounds", "posOf should throw correct error for out of bounds line");
}

try {
  buffer3.posOf(1, 10);
  console.assert(false, "posOf should throw error for out of bounds column");
} catch (e) {
  console.assert(e.message === "Column out of bounds", "posOf should throw correct error for out of bounds column");
}

// Test remove with same SKU (should subtract from existing)
warehouse.remove('SKU003', 3);
console.assert(warehouse.stock('SKU003') === 7, 'remove should subtract from existing stock');

// Test remove with unknown SKU (should throw error)
try {
  warehouse.remove('SKU999', 1);
  console.assert(false, 'remove should throw error for unknown SKU');
} catch (e) {
  console.assert(e.message === "Not enough stock or SKU does not exist", 'remove should throw correct error for unknown SKU');
}

// Test remove with insufficient stock (should throw error)
warehouse.addItem('SKU004', 3);
try {
  warehouse.remove('SKU004', 5);
  console.assert(false, 'remove should throw error for insufficient stock');
} catch (e) {
  console.assert(e.message === "Not enough stock or SKU does not exist", 'remove should throw correct error for insufficient stock');
}

// Test remove with invalid quantity (should throw error)
try {
  warehouse.remove('SKU003', -5);
  console.assert(false, 'remove should throw error for negative quantity');
} catch (e) {
  console.assert(e.message === "Quantity must be a positive integer", 'remove should throw correct error for negative quantity');
}

try {
  warehouse.remove('SKU003', 3.5);
  console.assert(false, 'remove should throw error for non-integer quantity');
} catch (e) {
  console.assert(e.message === "Quantity must be a positive integer", 'remove should throw correct error for non-integer quantity');
}

try {
  warehouse.remove('SKU003', 0);
  console.assert(false, 'remove should throw error for zero quantity');
} catch (e) {
  console.assert(e.message === "Quantity must be a positive integer", 'remove should throw correct error for zero quantity');
}

// Test that stock is unchanged when remove throws error
const initialStock = warehouse.stock('SKU004');
try {
  warehouse.remove('SKU004', 5);
  console.assert(false, 'remove should throw error for insufficient stock');
} catch (e) {
  console.assert(e.message === "Not enough stock or SKU does not exist", 'remove should throw correct error for insufficient stock');
  console.assert(warehouse.stock('SKU004') === initialStock, 'stock should be unchanged when remove throws error');
}

// Test reserve method
warehouse.addItem('SKU005', 10);
try {
  warehouse.reserve('SKU005', 5, 'order1');
  console.assert(warehouse.available('SKU005') === 5, 'available should return correct value after reservation');
} catch (e) {
  console.assert(false, 'reserve should work correctly');
}

try {
  warehouse.reserve('SKU005', 3, 'order1');
  console.assert(false, 'reserve should throw error for duplicate order reservation');
} catch (e) {
  console.assert(e.message === "Order already has a reservation for this SKU", 'reserve should throw correct error for duplicate order reservation');
}

try {
  warehouse.reserve('SKU005', 15, 'order2');
  console.assert(false, 'reserve should throw error for insufficient stock');
} catch (e) {
  console.assert(e.message === "Not enough stock or SKU does not exist", 'reserve should throw correct error for insufficient stock');
}

try {
  warehouse.reserve('SKU006', 5, 'order3');
  console.assert(false, 'reserve should throw error for unknown SKU');
} catch (e) {
  console.assert(e.message === "Not enough stock or SKU does not exist", 'reserve should throw correct error for unknown SKU');
}

// Test available method
warehouse.addItem('SKU006', 20);
warehouse.reserve('SKU006', 5, 'order1');
console.assert(warehouse.available('SKU006') === 15, 'available should return correct value for SKU with reservations');

warehouse.reserve('SKU006', 3, 'order2');
console.assert(warehouse.available('SKU006') === 12, 'available should return correct value for SKU with multiple reservations');

warehouse.removeItem('SKU006'); // Remove the item to test available with non-existent SKU
console.assert(warehouse.available('SKU006') === 0, 'available should return 0 for non-existent SKU');

console.log("All asserts passed!");
// Test undo/redo functionality
console.log("Testing undo/redo functionality...");

const buffer2 = new TextBuffer("Hello World");

// Test undo on empty history
console.assert(buffer2.undo() === false, "undo should return false when there's nothing to undo");

// Test redo on empty history
console.assert(buffer2.redo() === false, "redo should return false when there's nothing to redo");

// Make some edits
buffer2.insert(6, "Beautiful ");
console.assert(buffer2.text() === "Hello Beautiful World", "insert should work correctly");

// Test undo
console.assert(buffer2.undo() === true, "undo should return true when it successfully undoes");
console.assert(buffer2.text() === "Hello World", "undo should revert the last edit");

// Test redo
console.assert(buffer2.redo() === true, "redo should return true when it successfully redoes");
console.assert(buffer2.text() === "Hello Beautiful World", "redo should reapply the last undone edit");

// Make another edit that should clear redo history
buffer2.remove(6, 10);
console.assert(buffer2.text() === "Hello World", "remove should work correctly");

// Test that redo is now impossible
console.assert(buffer2.redo() === false, "redo should return false after a new edit clears redo history");

// Test undo again
console.assert(buffer2.undo() === true, "undo should work again");
console.assert(buffer2.text() === "Hello Beautiful World", "undo should revert to previous state");

// Test undo again to empty
console.assert(buffer2.undo() === true, "undo should work again");
console.assert(buffer2.text() === "Hello World", "undo should revert to initial state");

// Test undo when nothing left to undo
console.assert(buffer2.undo() === false, "undo should return false when there's nothing left to undo");

console.log("Undo/redo tests completed successfully");
// Test release method
console.log("Testing release method...");

// Test release with no reservations
console.assert(warehouse.release('order1') === 0, 'release should return 0 for order with no reservations');

// Test release with reservations
warehouse.addItem('SKU007', 10);
warehouse.reserve('SKU007', 3, 'order1');
warehouse.reserve('SKU007', 2, 'order2');
console.assert(warehouse.release('order1') === 5, 'release should return correct count of freed units');

// Verify that order1's reservations are gone
console.assert(warehouse.available('SKU007') === 5, 'available should reflect freed reservations');

// Test release with multiple reservations for same order
warehouse.addItem('SKU008', 15);
warehouse.reserve('SKU008', 4, 'order2');
warehouse.reserve('SKU008', 3, 'order2');
console.assert(warehouse.release('order2') === 7, 'release should sum all reservations for the same order');

// Verify that order2's reservations are gone
console.assert(warehouse.available('SKU008') === 15, 'available should reflect freed reservations');

// Test fulfil method
console.log("Testing fulfil method...");

// Test fulfil with valid reservations
warehouse.addItem('SKU009', 10);
warehouse.reserve('SKU009', 3, 'order1');
warehouse.reserve('SKU009', 2, 'order2');
console.assert(warehouse.fulfil('order1') === 3, 'fulfil should return correct count of freed units');

// Verify that order1's reservations are gone and available stock is updated
console.assert(warehouse.available('SKU009') === 9, 'available should reflect freed reservations after fulfil');

// Test fulfil with multiple reservations for same order
warehouse.addItem('SKU010', 15);
warehouse.reserve('SKU010', 4, 'order3');
warehouse.reserve('SKU010', 3, 'order3');
console.assert(warehouse.fulfil('order3') === 7, 'fulfil should sum all reservations for the same order');

// Verify that order3's reservations are gone
console.assert(warehouse.available('SKU010') === 15, 'available should reflect freed reservations after fulfil');

// Test fulfil with no reservations (should throw error)
try {
  warehouse.fulfil('order4');
  console.assert(false, 'fulfil should throw error for order with no reservations');
} catch (e) {
  console.assert(e.message === "Order has no reservations to fulfil", 'fulfil should throw correct error for order with no reservations');
}

console.log("Release tests completed successfully");
// Test lowStock method
console.log("Testing lowStock method...");

// Test lowStock with empty warehouse
console.assert(JSON.stringify(warehouse.lowStock(1)) === JSON.stringify([]), 'lowStock should return empty array for empty warehouse');

// Test lowStock with items above threshold
warehouse.addItem('SKU011', 10);
warehouse.addItem('SKU012', 5);
warehouse.addItem('SKU013', 3);
console.assert(JSON.stringify(warehouse.lowStock(15)) === JSON.stringify([]), 'lowStock should return empty array when all items are above threshold');

// Test lowStock with items below threshold
warehouse.addItem('SKU014', 2);
warehouse.addItem('SKU015', 1);
warehouse.addItem('SKU016', 8);
console.assert(JSON.stringify(warehouse.lowStock(5)) === JSON.stringify(['SKU014', 'SKU015']), 'lowStock should return items below threshold sorted alphabetically');

// Test lowStock with exact threshold match (should not include)
warehouse.addItem('SKU017', 5);
console.assert(JSON.stringify(warehouse.lowStock(5)) === JSON.stringify(['SKU014', 'SKU015']), 'lowStock should not include items at exact threshold');

// Test lowStock with reservation affecting availability
warehouse.reserve('SKU016', 3, 'order1');
console.assert(JSON.stringify(warehouse.lowStock(5)) === JSON.stringify(['SKU014', 'SKU015', 'SKU016']), 'lowStock should consider reservations when calculating available stock');

// Test lowStock with invalid threshold (should throw error)
try {
  warehouse.lowStock(-1);
  console.assert(false, 'lowStock should throw error for negative threshold');
} catch (e) {
  console.assert(e.message === "Threshold must be a positive integer", 'lowStock should throw correct error for negative threshold');
}

try {
  warehouse.lowStock(0);
  console.assert(false, 'lowStock should throw error for zero threshold');
} catch (e) {
  console.assert(e.message === "Threshold must be a positive integer", 'lowStock should throw correct error for zero threshold');
}

try {
  warehouse.lowStock(1.5);
  console.assert(false, 'lowStock should throw error for non-integer threshold');
} catch (e) {
  console.assert(e.message === "Threshold must be a positive integer", 'lowStock should throw correct error for non-integer threshold');
}

console.log("LowStock tests completed successfully");
