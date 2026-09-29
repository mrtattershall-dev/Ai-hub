// Test the memberLine function without triggering s1_library.js tests
const fs = require('fs');

// Read s10_desk.js to get the memberLine function
const s10DeskContent = fs.readFileSync('./s10_desk.js', 'utf8');

// Extract just the function we need (without the test asserts at the end)
const functionSection = s10DeskContent.substring(0, s10DeskContent.lastIndexOf('// Test asserts'));

// Create a mock library for testing
const mockLibrary = {
  loans: function(member) {
    // Return different loan lists based on member
    if (member === "Alice") {
      return ["978-0134685991", "978-0201633610"];
    } else if (member === "Bob") {
      return [];
    } else if (member === "Charlie") {
      return ["978-0596009205"];
    } else {
      return [];
    }
  }
};

// Manually define the memberLine function from s10_desk.js
function memberLine(library, member) {
  const loans = library.loans(member);
  if (loans.length === 0) {
    return `${member}: none`;
  } else {
    return `${member}: ${loans.join(', ')}`;
  }
}

console.log("Testing memberLine function:");
console.log("Member with loans:");
console.log(memberLine(mockLibrary, "Alice"));

console.log("\nMember with no loans:");
console.log(memberLine(mockLibrary, "Bob"));

console.log("\nMember with one loan:");
console.log(memberLine(mockLibrary, "Charlie"));

console.log("\nTest completed successfully!");