// Test file for TextBuffer class only
const { TextBuffer } = require('./q7_buffer.js');

console.log("Testing TextBuffer class...");

// Test lines() method
const buffer1 = new TextBuffer("Hello\nWorld\nTest");
const lines = buffer1.lines();
console.assert(lines.length === 3, "lines() should return correct number of lines");
console.assert(lines[0] === "Hello", "lines() should return first line");
console.assert(lines[1] === "World", "lines() should return second line");
console.assert(lines[2] === "Test", "lines() should return third line");
console.log("✓ lines() method works correctly");

// Test lineCol() method
const pos1 = buffer1.posOf(0, 0); // First character
const lineCol1 = buffer1.lineCol(pos1);
console.assert(lineCol1.line === 0 && lineCol1.col === 0, "lineCol should return correct position for first character");

const pos2 = buffer1.posOf(1, 2); // Third character on second line
const lineCol2 = buffer1.lineCol(pos2);
console.assert(lineCol2.line === 1 && lineCol2.col === 2, "lineCol should return correct position for third character on second line");

const pos3 = buffer1.posOf(2, 0); // First character on third line
const lineCol3 = buffer1.lineCol(pos3);
console.assert(lineCol3.line === 2 && lineCol3.col === 0, "lineCol should return correct position for first character on third line");
console.log("✓ lineCol() method works correctly");

// Test posOf() method
const pos4 = buffer1.posOf(0, 5); // Position of 'o' in "Hello"
console.assert(pos4 === 4, "posOf should return correct position for 'o' in 'Hello'");

const pos5 = buffer1.posOf(1, 1); // Position of 'o' in "World"
console.assert(pos5 === 7, "posOf should return correct position for 'o' in 'World'");
console.log("✓ posOf() method works correctly");

// Test lineCol() with out of bounds position
try {
  buffer1.lineCol(-1);
  console.assert(false, "lineCol should throw error for negative position");
} catch (e) {
  console.assert(e.message === "Position out of bounds", "lineCol should throw correct error for negative position");
}

try {
  buffer1.lineCol(20);
  console.assert(false, "lineCol should throw error for position beyond text length");
} catch (e) {
  console.assert(e.message === "Position out of bounds", "lineCol should throw correct error for position beyond text length");
}
console.log("✓ lineCol() out of bounds handling works correctly");

// Test posOf() with out of bounds line/column
try {
  buffer1.posOf(-1, 0);
  console.assert(false, "posOf should throw error for negative line");
} catch (e) {
  console.assert(e.message === "Line and column must be non-negative", "posOf should throw correct error for negative line");
}

try {
  buffer1.posOf(0, -1);
  console.assert(false, "posOf should throw error for negative column");
} catch (e) {
  console.assert(e.message === "Line and column must be non-negative", "posOf should throw correct error for negative column");
}

try {
  buffer1.posOf(5, 0);
  console.assert(false, "posOf should throw error for out of bounds line");
} catch (e) {
  console.assert(e.message === "Line out of bounds", "posOf should throw correct error for out of bounds line");
}

try {
  buffer1.posOf(1, 10);
  console.assert(false, "posOf should throw error for out of bounds column");
} catch (e) {
  console.assert(e.message === "Column out of bounds", "posOf should throw correct error for out of bounds column");
}
console.log("✓ posOf() out of bounds handling works correctly");

console.log("All TextBuffer tests passed!");
// Test find() method
const buffer2 = new TextBuffer("Hello world, hello universe, hello everyone");
console.assert(buffer2.find("hello") === 13, "find() should return first occurrence starting from beginning");
console.assert(buffer2.find("hello", 14) === 28, "find() should return second occurrence when starting from position 14");
console.assert(buffer2.find("hello", 30) === -1, "find() should return -1 when no occurrence found after position");
console.assert(buffer2.find("xyz") === -1, "find() should return -1 when string not found");
console.log("✓ find() method works correctly");

// Test findAll() method
const buffer3 = new TextBuffer("abababab");
const indexes1 = buffer3.findAll("ab");
console.assert(indexes1.length === 4, "findAll() should return 4 matches for 'ab' in 'abababab'");
console.assert(indexes1[0] === 0, "findAll() should find first 'ab' at position 0");
console.assert(indexes1[1] === 2, "findAll() should find second 'ab' at position 2");
console.assert(indexes1[2] === 4, "findAll() should find third 'ab' at position 4");
console.assert(indexes1[3] === 6, "findAll() should find fourth 'ab' at position 6");
console.log("✓ findAll() method works correctly");

// Test edge cases for find() and findAll()
const buffer4 = new TextBuffer("aaaa");
console.assert(buffer4.find("aa") === 0, "find() should work with overlapping matches");
console.assert(buffer4.findAll("aa").length === 3, "findAll() should find overlapping matches");
console.log("✓ Edge cases work correctly");
// Test replaceAll() method
const buffer5 = new TextBuffer("hello world, hello universe, hello everyone");
const count1 = buffer5.replaceAll("hello", "hi");
console.assert(count1 === 3, "replaceAll() should return count of replacements made");
console.assert(buffer5.text() === "hi world, hi universe, hi everyone", "replaceAll() should replace all occurrences");

// Test undo after replaceAll
const success1 = buffer5.undo();
console.assert(success1 === true, "undo() should work after replaceAll()");
console.assert(buffer5.text() === "hello world, hello universe, hello everyone", "undo() should restore original text");

// Test replaceAll with no matches
const buffer6 = new TextBuffer("hello world");
const count2 = buffer6.replaceAll("xyz", "abc");
console.assert(count2 === 0, "replaceAll() should return 0 when no matches found");
console.assert(buffer6.text() === "hello world", "replaceAll() should not change text when no matches found");

// Test replaceAll with empty search string
const buffer7 = new TextBuffer("hello world");
const count3 = buffer7.replaceAll("", "abc");
console.assert(count3 === 0, "replaceAll() should return 0 when search string is empty");

// Test replaceAll with overlapping matches
const buffer8 = new TextBuffer("aaaa");
const count4 = buffer8.replaceAll("aa", "b");
console.assert(count4 === 2, "replaceAll() should replace overlapping matches correctly");
console.assert(buffer8.text() === "bb", "replaceAll() should handle overlapping matches correctly");

// Test undo after multiple replaceAll operations
const buffer9 = new TextBuffer("abcabcabc");
buffer9.replaceAll("abc", "X");
const count5 = buffer9.replaceAll("X", "Y");
console.assert(count5 === 3, "replaceAll() should work correctly after previous replaceAll");
console.assert(buffer9.text() === "YYY", "replaceAll() should work correctly after previous replaceAll");

// Undo all changes
buffer9.undo(); // Should undo the last replaceAll
console.assert(buffer9.text() === "abcabcabc", "undo() should restore text after multiple replaceAll operations");
buffer9.undo(); // Should undo the first replaceAll
console.assert(buffer9.text() === "abcabcabc", "undo() should restore text after multiple replaceAll operations");

console.log("✓ replaceAll() method works correctly");
// Test beginGroup() and endGroup() functionality
const buffer10 = new TextBuffer("hello world");
buffer10.beginGroup();
buffer10.insert(6, " beautiful");
buffer10.remove(11, 5); // Remove "world"
buffer10.endGroup();

// Test that undo undoes the entire group
const success2 = buffer10.undo();
console.assert(success2 === true, "undo() should work after grouped operations");
console.assert(buffer10.text() === "hello world", "undo() should restore original text after grouped operations");

// Test redo
const success3 = buffer10.redo();
console.assert(success3 === true, "redo() should work after undoing grouped operations");
console.assert(buffer10.text() === "hello beautiful", "redo() should restore grouped operations");

// Test nested groups (should not interfere)
const buffer11 = new TextBuffer("test");
buffer11.beginGroup();
buffer11.insert(4, "1");
buffer11.beginGroup();
buffer11.insert(5, "2");
buffer11.endGroup(); // Inner group
buffer11.insert(6, "3");
buffer11.endGroup(); // Outer group

// Undo should undo the entire outer group
const success4 = buffer11.undo();
console.assert(success4 === true, "undo() should work with nested groups");
console.assert(buffer11.text() === "test", "undo() should restore original text with nested groups");

console.log("✓ beginGroup() and endGroup() methods work correctly");
